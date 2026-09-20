# Phase 11-2: SQLite To PostgreSQL Compatibility

## Scope And Result

This phase prepares the existing FastAPI, SQLModel, and Alembic code for a future PostgreSQL connection while keeping SQLite as the active development and test database.

Completed in this phase:

- added the Psycopg 3 driver without connecting to a PostgreSQL server;
- separated SQLite-only engine options and PRAGMA handling behind an engine factory;
- restricted `DATABASE_URL` to SQLite or explicit `postgresql+psycopg` URLs;
- normalized application timestamps to timezone-aware UTC at the SQLAlchemy boundary;
- added deterministic session and recommendation-token expiry boundary tests;
- corrected a PostgreSQL-incompatible Boolean default in the migration chain;
- prevented the compatibility development user from being created outside development;
- generated the full Alembic upgrade and downgrade SQL with the PostgreSQL dialect;
- kept the SQLite suite and migration path green.

Not completed here:

- no PostgreSQL server, container, database, schema, or data was created;
- no PostgreSQL query or migration was executed against a live server;
- no production connection, deployment manifest, readiness endpoint, or shared rate limiter was added.

## Compatibility Matrix

Classification:

- **A:** usable on PostgreSQL without structural change
- **B:** small compatibility change completed
- **C:** required change completed before PostgreSQL integration
- **D:** still requires a real PostgreSQL integration test

| Item | Previous state | Class | Action in Phase 11-2 | Remaining validation |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Default SQLite URL; no dialect validation | B | Accept SQLite and require `postgresql+psycopg` for PostgreSQL | Provider URL injection in Phase 11-3 |
| Psycopg driver | Missing | C | Added `psycopg[binary]==3.3.5` | Live connection and platform image in Phase 11-3 |
| Engine construction | Module-level engine with `startswith("sqlite")` branching | C | Added dialect parsing, option builder, and engine factory | Pool behavior with a real server |
| `check_same_thread` | Passed only by string-prefix branch | B | Emitted only for the SQLite dialect | None for PostgreSQL |
| SQLite foreign keys | Connection PRAGMA in app and duplicate test fixture code | B | Centralized the listener in the engine factory | PostgreSQL enforces FKs natively |
| SQL logging | Development echo and `hide_parameters=True` | A | Preserved | Production log format remains Phase 11-4 |
| Timestamp columns | `DateTime(timezone=True)`, but SQLite returned naive values | C | Added `UTCDateTime` bind/result normalization | Live `timestamptz` round trip |
| Session expiry | Auth-specific naive/aware normalization | B | Reused the common UTC policy and added exact boundary tests | Live DB round trip |
| Recommendation token TTL | Signed integer epoch seconds, no DB timestamp | A | Added before/at/after expiry tests | Process-local replay limitation remains |
| Boolean model fields | Python `bool` and SQLAlchemy `Boolean` | A | Preserved | Live default/readback |
| Checklist migration default | `Boolean DEFAULT 0` | C | Replaced with dialect-aware `sa.false()` | Full live migration chain |
| Integer primary keys | SQLModel integer PKs; no explicit imported IDs | A/D | PostgreSQL DDL compile confirms generated sequence-style PK | Live sequence behavior after deletes/imports |
| Project import key | Named unique `(user_id, source_local_id)`, nullable source ID | A/D | Preserved; PostgreSQL permits multiple NULLs and rejects duplicate non-NULL pairs | Concurrent live requests |
| Other uniqueness | Canonical email, session digest, project/idea media composites | A/D | Preserved named indexes/constraints and `IntegrityError` recovery | Concurrent live duplicate requests |
| Email comparison | Canonicalized with validation and `casefold()`, then equality | A | No collation dependency | Unicode behavior under selected DB collation |
| Content Idea search | Escaped SQLAlchemy `ILIKE` | A/D | Preserved | Real PostgreSQL wildcard/case behavior |
| Raw upsert/conflict SQL | None | A | No abstraction added | None |
| JSON-like tags | Intentionally serialized JSON text in `Text` | A | Kept as text; no premature JSONB migration | Query/index redesign only if later required |
| Foreign keys | Auth cascade, idea-project `SET NULL`, otherwise explicit cleanup | A/D | Preserved current delete ordering | Live FK enforcement and concurrent deletion |
| Content Idea conversion | `flush`, related inserts, one commit, rollback on failure | A/D | Preserved | Isolation and concurrent conversion |
| Legacy import | Pre-read plus unique constraint, rollback, then lookup | A/D | Preserved | PostgreSQL concurrent import race |
| AI recommendation save | One DB commit after token reservation | A/D | Preserved | Process crash and multi-replica replay policy |
| Auth signup/session | One transaction with `IntegrityError` rollback | A/D | Preserved | Concurrent canonical-email signup |
| Alembic batch mode | URL prefix check; explicit historical batch blocks | B/D | Dialect parsing now enables generated batch mode only for SQLite; offline PostgreSQL chain passes | Live DDL and locks |
| Constraint naming | Important composite constraints named; legacy PK/FK names mostly generated | D | No history-wide naming rewrite | Inspect live PostgreSQL names before future alters |
| `create_all` | Used by pytest fixture only | B | Test fixture now uses the application engine factory; `create_all` remains test-only | Migration-backed PostgreSQL tests in Phase 11-3 |
| Development user seed | Lifespan always invoked compatibility seed | C | Seed call is now development-only | Production startup test with deployed settings |
| Health/readiness | Public liveness-style `/health` only | D | No scope expansion | Add DB readiness in Phase 11-4 |
| Rate limits | Process-local | D | Unchanged | Shared/gateway policy before multiple replicas |

## Database Engine And Configuration

`app.core.database.create_db_engine()` is now the common construction path for both application and SQLite tests.

The factory:

- parses the SQLAlchemy URL rather than relying on a string prefix;
- applies `check_same_thread=False` only to SQLite;
- registers `PRAGMA foreign_keys=ON` only for SQLite connections;
- retains `hide_parameters=True` for every dialect;
- enables SQL echo only when `ENVIRONMENT=development`.

`Settings` accepts the current SQLite format and future Psycopg 3 URLs such as:

```text
postgresql+psycopg://user:password@host/database
```

Other dialects and implicit `psycopg2` URLs fail configuration validation. This makes the selected driver explicit before a connection attempt. SQLite remains the default and no production URL is embedded in source control.

## Datetime And Timezone Policy

Application timestamps use timezone-aware UTC.

The new `UTCDateTime` SQLAlchemy type keeps the physical schema as `DateTime(timezone=True)` and normalizes values at the persistence boundary:

- aware inputs are converted to UTC;
- legacy or SQLite-returned naive values are interpreted as UTC;
- loaded values are always timezone-aware UTC;
- PostgreSQL compiles the type as `TIMESTAMP WITH TIME ZONE`.

The policy applies to users, sessions, Projects, Content Ideas, checklist items, memos, saved media, and optional reference publication timestamps. It does not require a schema revision because the underlying column type has not changed.

SQLite cannot preserve timezone metadata in its native datetime representation. Treating existing naive values as UTC matches the previous auth fallback and current `utc_now()` write policy. Phase 11-3 must confirm live PostgreSQL round trips and serialization.

## Session TTL

Sessions retain a seven-day absolute TTL configured by `AUTH_SESSION_TTL_SECONDS`.

The lookup contract is now tested deterministically:

- one microsecond before `expires_at`: valid;
- exactly at `expires_at`: invalid;
- after `expires_at`: invalid;
- the same expiration instant expressed in UTC+09:00: invalid.

No sleep or wall-clock race is used. The service accepts an injected `now` and normalizes both sides to UTC before comparison. Session creation still derives `created_at` and `expires_at` from the same aware UTC value.

## Recommendation Save Token TTL

The recommendation `save_token` is independent of database datetime types. Its signed payload contains integer Unix epoch `issued_at` and `expires_at` values.

Boundary tests now verify:

- epoch second before expiry: valid;
- exact expiry second: expired;
- after expiry: expired;
- user binding and signature validation remain unchanged;
- the existing replay test still rejects a second save.

Replay reservation and consumption remain process-local. PostgreSQL compatibility does not solve restart or multi-replica replay, so that limitation remains assigned to production scaling work.

## Boolean, Primary Keys, And Unique Values

Application code uses Python `bool` and SQLAlchemy `Boolean`; it does not compare Boolean columns to raw `0` or `1`. Model defaults compile for PostgreSQL.

The one migration-specific issue was the checklist `server_default=sa.text("0")`. It is now `sa.false()`, which compiles as `false` on PostgreSQL and remains `0` on SQLite.

All table primary keys are optional Python integers before insert and database-generated integers afterward. Legacy imports never insert browser IDs into database PKs. PostgreSQL static DDL uses sequence-backed integer PK generation. Sequence advancement and reset behavior still require a live test.

`projects.source_local_id` remains nullable. The named `(user_id, source_local_id)` unique constraint has the intended semantics on PostgreSQL: multiple ordinary Projects with NULL source IDs are allowed, while one non-NULL local source ID per user is enforced.

## Case Sensitivity And Text Storage

Email addresses are validated, normalized, and case-folded before equality lookup and storage. The authentication contract does not depend on SQLite `NOCASE`.

Content Idea text search escapes `%`, `_`, and `\` before SQLAlchemy `ILIKE`, which has a direct PostgreSQL implementation. The real-dialect behavior remains an integration-test item.

Content Idea tags remain JSON-encoded text by design. PostgreSQL compatibility does not require JSONB, and adding it now would change the query and migration surface without a current product need.

## Foreign Keys

SQLite tests enable foreign-key enforcement through the centralized connection listener. PostgreSQL will enforce foreign keys without a PRAGMA.

Current deletion policy:

- auth sessions use `ON DELETE CASCADE` from users;
- `ContentIdea.converted_project_id` uses `ON DELETE SET NULL`;
- Project and Content Idea child rows are otherwise removed explicitly before parent deletion;
- deleting a converted Project explicitly restores the linked Content Idea to `ready` before deleting the Project.

The ordering is compatible in static analysis and existing SQLite FK tests. Live PostgreSQL tests must still cover concurrent delete and conversion behavior.

## Transactions And Concurrency

### Content Idea To Project

Project creation, selected media copying, default checklist, initial memo, and Content Idea relation update share one Session transaction. The service flushes to obtain the Project ID, commits once, and rolls back any exception.

### Legacy Project Import

The import performs an early lookup for normal retries, then relies on the named unique constraint for the race. On `IntegrityError`, it rolls back the failed PostgreSQL-style transaction before querying the winning row. This pattern is compatible with PostgreSQL transaction state, but concurrent live requests remain a Phase 11-3 test.

### AI Recommendation Save

The token is reserved before the Content Idea insert. A DB failure releases the reservation; a successful commit consumes it until expiry. The DB transaction remains single-write, while the replay cache remains process-local.

### Authentication

Signup flushes User before adding AuthSession and commits once. A canonical-email race is mapped through `IntegrityError` after rollback. Login adds a new session and commits it; logout revokes only the current session.

No nested transaction, raw upsert, SQLite `ON CONFLICT`, `INSERT OR`, rowid dependency, or dialect-specific application SQL exists.

## Alembic

Alembic continues to load `DATABASE_URL` from application settings and `SQLModel.metadata` from all model exports.

- generated batch mode is enabled only for the parsed SQLite dialect;
- existing explicit `batch_alter_table` blocks remain because they also emit valid PostgreSQL offline DDL;
- the full upgrade SQL from base to `c4a8d2e91f37` compiled with the PostgreSQL dialect;
- the full downgrade SQL from `c4a8d2e91f37` to base compiled with the PostgreSQL dialect;
- the generated SQL contains `TIMESTAMP WITH TIME ZONE`, `BOOLEAN DEFAULT false`, and `uq_projects_user_source_local_id`;
- `alembic check` reports no new model operations.

No new revision was created. The existing checklist revision was minimally corrected because PostgreSQL has not yet been introduced and the previous numeric Boolean default would make a from-base PostgreSQL migration unsafe. The SQLite meaning is unchanged.

The repository has no global SQLAlchemy naming convention. Important composite unique constraints are explicitly named, while older PK and FK constraints are mostly dropped with their tables. Introducing a convention now could create noisy autogenerate changes, so it is deferred until a real PostgreSQL schema demonstrates a need.

## Development User

`ensure_development_user` creates an inactive, passwordless compatibility user for legacy local data. It is not an authentication bypass, but it was previously called in every environment.

FastAPI lifespan now calls it only when `ENVIRONMENT` is exactly `development`. Tests verify that `test` and `production` do not enable the seed. No active user or administrator is automatically created.

## Test Architecture

The fast API suite continues to use a temporary file-backed SQLite database per test fixture and `SQLModel.metadata.create_all`. The fixture now uses the same engine factory as the application, removing duplicated SQLite connect options and PRAGMA setup.

This remains intentionally different from the future PostgreSQL path:

- fast unit/API suite: temporary SQLite with `create_all`;
- integration subset: disposable PostgreSQL created and migrated with Alembic;
- migration checks: base-to-head and downgrade/re-upgrade against the PostgreSQL integration database.

No skipped placeholder PostgreSQL tests were added.

## Validation Evidence

- focused database/auth/recommendation suite: 80 passed;
- full backend suite: 348 passed, 0 failed, 0 skipped;
- `python -m compileall -q app`: passed;
- `pip check`: passed;
- Alembic current/head: `c4a8d2e91f37`;
- `alembic check`: no new upgrade operations;
- guarded temporary SQLite upgrade, downgrade to `e7b2a9c41d60`, re-upgrade: passed;
- PostgreSQL base-to-head offline SQL generation: passed;
- PostgreSQL head-to-base offline SQL generation: passed;
- actual PostgreSQL execution: not performed;
- live OpenAI, YouTube, and Pexels calls: none.

Known warnings remain the Starlette TestClient/httpx deprecation, existing Pydantic enum serialization warnings, and the Windows pytest cache warning.

## Phase 11-3 Prerequisites

Phase 11-3 can begin with these concrete tasks:

1. Add a development-only Docker Compose PostgreSQL service and persistent volume.
2. Define separate guarded development and test databases using `postgresql+psycopg` URLs.
3. Run the complete Alembic chain against a disposable live PostgreSQL database.
4. Add migration-backed PostgreSQL integration tests for timezone, Boolean defaults, FKs, unique NULL behavior, and sequence generation.
5. Exercise concurrent signup, media duplicate, Content Idea conversion, and legacy import requests.
6. Verify failure recovery after PostgreSQL transaction errors.
7. Keep SQLite fast tests as the default local feedback loop.

Phase 11-3 must not claim compatibility complete until those live database checks pass.
