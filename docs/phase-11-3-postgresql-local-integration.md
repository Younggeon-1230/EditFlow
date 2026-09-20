# Phase 11-3: PostgreSQL Local And Development Integration

## Scope And Result

This phase connects EditFlow to a live local PostgreSQL server and validates the
database contracts prepared in Phase 11-2. It does not deploy a production
database or migrate existing SQLite data.

Result: the local PostgreSQL environment, live Alembic chain, integration suite,
and browser workflow passed. Phase 11-4 can begin.

## Local Environment

- Docker Desktop with the WSL2 Linux backend
- PostgreSQL `17.6-alpine`
- Compose file: `backend/compose.yaml`
- Service: `postgres`
- Development database: `editflow_dev`
- Integration database: `editflow_test`
- Host binding: `127.0.0.1:5432`
- Persistent named volume: `editflow_postgres_data`
- Healthcheck: `pg_isready` against the development database

The init script creates the test database only during first volume
initialization. PostgreSQL data stays in the named Docker volume and is not
written to the repository.

## Environment Policy

Runtime continues to use `DATABASE_URL`. PostgreSQL integration tests read
`TEST_DATABASE_URL` directly so they cannot silently inherit the development
database.

```text
DATABASE_URL=postgresql+psycopg://<user>:<password>@127.0.0.1:5432/editflow_dev
TEST_DATABASE_URL=postgresql+psycopg://<user>:<password>@127.0.0.1:5432/editflow_test
EDITFLOW_POSTGRESQL_QA=1
```

Actual credentials belong in an ignored `.env` or the current shell. The
checked-in example contains local-only placeholders.

## Commands

From `backend/`:

```powershell
docker compose up -d --wait
$env:DATABASE_URL = "postgresql+psycopg://.../editflow_dev"
alembic upgrade head

$env:TEST_DATABASE_URL = "postgresql+psycopg://.../editflow_test"
$env:EDITFLOW_POSTGRESQL_QA = "1"
python -m pytest -m postgresql tests/postgresql
python -m scripts.postgresql_migration_qa
```

Stop the service while preserving data:

```powershell
docker compose down
```

Delete the local databases and volume intentionally:

```powershell
docker compose down --volumes
```

## Destructive QA Guard

Both the integration fixture and migration cycle require:

1. the `postgresql+psycopg` driver;
2. a database name ending in `_test`;
3. explicit `EDITFLOW_POSTGRESQL_QA=1` opt-in.

The migration helper also queries `current_database()` before downgrade. A
negative test using `editflow_dev` was rejected before Alembic ran.

## Alembic Live Migration

The live PostgreSQL test database completed:

1. migration from base to `c4a8d2e91f37`;
2. downgrade from head to base;
3. re-upgrade from base to head;
4. `alembic current --check-heads`;
5. `alembic check` with no pending operations.

The development database received only the non-destructive base-to-head
upgrade. PostgreSQL reported transactional DDL throughout.

No new Alembic revision was required. The Phase 11-2 `sa.false()` correction in
the historical checklist revision executed successfully on the first live
PostgreSQL schema. Once a revision has been deployed outside local development,
future schema changes must use a new revision rather than rewriting history.

## Live Schema Verification

The integration suite inspected the migrated schema and confirmed:

- ten application tables plus `alembic_version`;
- integer sequence-backed primary keys;
- timezone-aware PostgreSQL timestamp columns;
- native Boolean columns with `DEFAULT false`;
- named `uq_projects_user_source_local_id`;
- auth session `ON DELETE CASCADE`;
- Content Idea project relation `ON DELETE SET NULL`;
- model metadata and live schema produce no Alembic diff.

## Datetime And Session TTL

Live round trips cover aware UTC and UTC+09:00 inputs, microsecond precision,
UTC readback, and `AuthSession.expires_at`. After closing and reopening the DB
session:

- one microsecond before expiry is valid;
- exact expiry is invalid;
- one microsecond after expiry is invalid.

No sleep or wall-clock timing is used.

## Boolean, Sequences, Unique Values, And FKs

Live tests confirmed:

- omitted checklist Boolean values use the database default and return Python
  `False`;
- explicit model Boolean values work;
- generated integer IDs increase and are not reused after delete;
- multiple NULL `source_local_id` values are allowed;
- duplicate `(user_id, source_local_id)` non-NULL pairs fail;
- the same source ID is independent across users;
- invalid foreign keys fail;
- auth sessions cascade when their user is deleted;
- Project deletion removes children and restores the linked Content Idea to
  `ready`.

## Transactions And Concurrency

Content Idea conversion was tested for full commit and an injected failure after
partial child writes. The failure left no Project, memo, checklist, or relation.

Legacy import was tested for first create, retry, injected child failure, and two
simultaneous imports. The concurrent result was one created result, one recovered
existing result, and one final Project.

Two simultaneous canonical-email signups produced one `201`, one `409`, and one
User row.

Live PostgreSQL analysis found a real conversion race: the previous read/check
could allow two requests to pass before either updated the Content Idea. The
conversion query now locks the owned Content Idea row with `FOR UPDATE`.
The live concurrency test produces one created conversion, one conflict, and one
Project row.

Recommendation save uses a signed epoch token and a process-local replay guard.
A live PostgreSQL save created one AI Content Idea; reuse was rejected and did
not create another row. The replay guard is still not durable or multi-replica
safe.

## Connection Pool

PostgreSQL uses SQLAlchemy's default `QueuePool`; no production tuning was added.
Live tests cover commit, rollback, a subsequent successful query on reused
connections, and zero checked-out connections after the workflow.

## Test Architecture

- Default `pytest`: 348 SQLite fast/API tests; PostgreSQL tests deselected.
- `pytest -m postgresql tests/postgresql`: 10 live integration tests.
- PostgreSQL fixtures reset only `editflow_test` with `TRUNCATE ... RESTART
  IDENTITY CASCADE`.
- Alembic, rather than `metadata.create_all`, creates the integration schema.
- `scripts.postgresql_migration_qa` owns guarded destructive migration cycling.

## Browser QA

The existing frontend was started on port `5174` with its API base set to the
PostgreSQL backend on port `8001`. A Headless Edge DevTools script exercised the
real browser cookie, CORS, Origin, and CSRF path.

Passed flows:

- signup and authenticated `/me`;
- session restoration after page reload;
- Project create, update, and list;
- checklist and memo creation;
- Content Idea create and conversion;
- legacy Project import;
- logout and login;
- second account isolation with generic `404`.

The PostgreSQL database contained the resulting rows. No OpenAI, YouTube, or
Pexels live request was made.

## Validation Results

- SQLite suite: 348 passed, 10 PostgreSQL tests deselected;
- PostgreSQL suite: 10 passed;
- frontend production build: passed;
- Python compileall: passed;
- `pip check`: passed;
- PostgreSQL base/head cycle: passed;
- PostgreSQL `alembic check`: no pending operations;
- test database safety negative test: passed;
- `git diff --check`: passed with Windows line-ending warnings only.

## Known Limitations

- save-token replay and rate limiting remain process-local;
- readiness is not yet separated from liveness;
- connection-pool sizing and timeouts use SQLAlchemy defaults;
- local placeholder credentials are not a production secret policy;
- existing SQLite development data is not copied to PostgreSQL;
- CI does not yet run the PostgreSQL marker.

## Phase 11-4 Prerequisites

Phase 11-4 should add production configuration validation, Secure cookies,
trusted origins, liveness/readiness separation, sanitized structured logging and
request IDs, provider-managed secrets, a single Alembic release step, startup
failure policy, and an explicit multi-replica rate-limit/replay decision.
