# Phase 11-1: Production And Deployment Architecture

## 1. Decision Summary

EditFlow should deploy as one public HTTPS origin with three managed components behind it:

1. a CDN/static host for the Vite build;
2. a container or application service for FastAPI;
3. a managed PostgreSQL database reachable only by the backend.

The public gateway routes SPA assets and fallback routes to the frontend and routes `/api/*` and health endpoints to FastAPI. This is provider-neutral and preserves the current host-only cookie and browser-readable CSRF cookie design without weakening SameSite.

The first production shape should use one backend replica. A second replica is allowed only after process-local rate limiting is replaced or the limitation is explicitly accepted and compensated at the gateway.

## 2. Hosting Options

| Option | Shape | Advantages | Costs and risks | Decision |
| --- | --- | --- | --- | --- |
| One public origin, separate frontend/backend services behind a gateway | CDN SPA + `/api` reverse proxy + managed PostgreSQL | Preserves current cookies and CSRF; frontend/backend deploy independently; static assets stay cheap | Requires path routing or a small gateway | Recommended |
| FastAPI serves the built SPA | One application service + managed PostgreSQL | Simplest origin and cookie behavior | Couples releases, uses app compute for static files, requires SPA fallback code | Acceptable low-cost fallback |
| Separate frontend and backend subdomains | `app.example` and `api.example` | Easy on providers that expose separate domains | Current frontend cannot read a host-only CSRF cookie set by the API host | Do not use without an explicit CSRF redesign |

### Phase 11-5 final selection

The deployment implementation selected the one-service fallback: FastAPI serves
the Vite production bundle from the same Render Web Service that owns `/api/*`
and `/health/*`. Render does not provide the planned path-routing gateway for
two independently deployed services in this portfolio scope. The selected
topology provides a genuine single origin, preserves host-only cookies and the
existing double-submit CSRF contract, and avoids a custom domain or cookie
redesign. The tradeoff is an intentionally coupled frontend/backend release.
| Unrelated provider domains | Separate sites | Minimal gateway setup | Would pressure `SameSite=None`, widen CORS, and complicate CSRF/cookies | Not recommended |

No provider-specific manifest is added in Phase 11-1. Provider selection should compare support for path routing, managed PostgreSQL, one-off release commands, secret injection, TLS, log retention, and low-cost sleep/cold-start behavior at selection time.

## 3. Public Routing Boundary

Recommended public URL example:

```text
https://editflow.example.com/          -> Vite static frontend
https://editflow.example.com/api/*     -> FastAPI
https://editflow.example.com/health/*  -> FastAPI probes
```

The backend may have a private service hostname, but browsers should not call it directly. Set frontend `VITE_API_BASE_URL` to the public EditFlow origin at build time. It is public configuration, not a secret.

The SPA host must rewrite unknown non-API paths such as `/projects/42`, `/projects/local/local-id`, and `/ideas/7` to `index.html`. The gateway must never rewrite `/api/*` to the SPA.

If a provider cannot supply path routing, serving `dist` from FastAPI is the fallback. That requires a Phase 11-4 static-files and SPA-fallback implementation, with API and health routes registered before the fallback.

## 4. Cookies, HTTPS, CORS, And CSRF

Production requirements:

- HTTPS is mandatory at the public edge.
- `AUTH_COOKIE_SECURE=true` is mandatory.
- Keep both cookies host-only and `Path=/`.
- Keep `SameSite=Lax` for the recommended same-origin topology.
- Keep the session cookie HttpOnly.
- Keep the CSRF cookie readable to frontend JavaScript.
- Keep Fetch `credentials: 'include'`.
- Keep `X-CSRF-Token` and session-bound digest validation.
- Set `FRONTEND_ORIGINS` to exact canonical HTTPS origins; never use `*` with credentials.
- Keep Origin/Referer allowlisting on every unsafe method, including signup and login.

The same-origin topology avoids adding a cookie `Domain`. Broad domain cookies should not be introduced merely for convenience.

With separate subdomains, the host-only API CSRF cookie is not visible to JavaScript running on the frontend host even though the requests may be same-site. Supporting that topology would require a deliberate design such as returning the CSRF token from a bootstrap response or using a narrowly scoped parent-domain CSRF cookie. It is deferred and must receive a security review. Unrelated domains would additionally require `SameSite=None; Secure` and are not the default.

Production proxy configuration must forward the real scheme and client address only from trusted proxies. Trusted-host and forwarded-header policy should be explicit before deployment.

## 5. PostgreSQL Compatibility Inventory

### 5.1 Works Without Structural Change

- SQLModel/SQLAlchemy `select`, joins, updates, deletes, transactions, and `IntegrityError` handling.
- Integer primary keys and foreign keys.
- string-backed status/priority/platform values.
- Boolean, Date, String, Text, and nullable columns.
- unique constraints for saved media and `(user_id, source_local_id)`.
- PostgreSQL, like SQLite, permits multiple NULL values under the current ordinary unique constraint.
- Project import's rollback-then-query race recovery is compatible with PostgreSQL transaction error behavior.

### 5.2 Small Changes Required

- Add a supported PostgreSQL driver, preferably Psycopg 3, and use `postgresql+psycopg://...` in `DATABASE_URL`.
- Refactor engine creation into a testable factory while retaining SQLite-only `check_same_thread` and `PRAGMA foreign_keys=ON` branches.
- Add production pool configuration and connection pre-ping based on measured hosting behavior.
- Add a migration-backed PostgreSQL test database path; current unit fixtures use SQLite `create_all`.
- Document development and test database creation and teardown guards.

### 5.3 Must Change Before Production

- Require a non-default production `DATABASE_URL`; production must not silently use `sqlite:///./editflow.db`.
- Stop unconditional runtime creation of the inactive `dev@editflow.local` user. Gate it to development only or remove it after legacy ownership requirements are confirmed.
- Install and validate every Alembic revision against PostgreSQL before using managed data.
- Define a single release migration job and prevent every application replica from migrating at startup.

### 5.4 Requires Explicit Validation

- `DateTime(timezone=True)` round trips as aware UTC values; SQLite currently returns naive values in some paths and auth compensates for this.
- Boolean defaults generated by `true()` and `false()`.
- quoted string `server_default` expressions used by content and media models.
- unconditional `batch_alter_table` blocks in existing migration files when run on PostgreSQL.
- foreign-key deletion behavior: most Project/child relations are deleted explicitly rather than with `ON DELETE CASCADE`.
- concurrent local import and media duplicate requests under PostgreSQL isolation.
- sequence behavior after delete; tests must never require reuse or non-reuse of an integer ID.
- ordering and case behavior for string filters and canonical email uniqueness.
- DDL downgrade/upgrade behavior on a disposable PostgreSQL database.

No raw application SQL, SQLite upsert, or SQLite conflict clause is currently used. SQLite-specific runtime code is confined to URL detection, `check_same_thread`, and the foreign-key PRAGMA. Alembic enables generated batch mode only for SQLite, although existing explicit batch blocks still need PostgreSQL execution tests.

## 6. DATABASE_URL Strategy

Keep the existing `DATABASE_URL` name.

| Environment | Source | Policy |
| --- | --- | --- |
| Local SQLite | `backend/.env` | Existing default remains during transition |
| Local PostgreSQL | developer-only env or Compose env | Explicit `postgresql+psycopg` URL |
| Tests | fixture-generated URL, later a guarded PostgreSQL test URL | Must refuse non-test database names/hosts before destructive setup |
| Production | hosting secret store | Required managed PostgreSQL URL; never committed or baked into images |

A separate `TEST_DATABASE_URL` should be added only when the PostgreSQL integration harness is implemented and needs it. Unit tests can continue dependency overrides, but PostgreSQL integration tests must run Alembic rather than only `metadata.create_all`.

## 7. Migration And Release Strategy

Recommended deployment order:

1. create a managed backup or verify point-in-time recovery;
2. build immutable frontend/backend artifacts;
3. run exactly one release job: `alembic upgrade head`;
4. abort the release if migration fails;
5. start or roll backend instances only after success;
6. verify readiness and authenticated smoke tests;
7. publish or activate the frontend.

Do not run migrations unconditionally inside FastAPI lifespan. Multiple replicas could race, application startup would own DDL unexpectedly, and failures would be harder to recover. The application should fail readiness when the database is unavailable or not at the expected revision, while the deployment system owns the migration step.

Downgrades remain useful on disposable databases and for rehearsal, but production recovery should prefer a compatible forward fix plus managed database restore when data transformation is involved. Early portfolio deployments can use short maintenance windows; zero-downtime expand/contract migrations become necessary only when continuous availability or multiple versions overlap.

## 8. Health And Readiness

Current `/health` is a no-DB liveness endpoint and returns status, app, version, and environment. It must not be treated as readiness.

Phase 11-4 should provide:

- `/health/live`: process/event-loop liveness, no external dependencies;
- `/health/ready`: a short-timeout `SELECT 1` and optionally an Alembic-head check cached briefly;
- generic `200` or `503` responses without database URLs, credentials, hostnames, stack traces, or provider details;
- `/health` retained temporarily as a compatibility alias if hosting configuration already uses it.

The current environment field is low-risk but unnecessary production metadata and should be removed from public probe output.

## 9. Logging And Observability

Current logging consists of Uvicorn/FastAPI defaults, SQLAlchemy SQL echo in development, parameter hiding, external-provider status/timeout warnings, and structured recommendation metadata. `hide_parameters=True` must remain enabled.

Production policy:

- disable SQL echo outside development;
- write logs to stdout/stderr for platform collection;
- use a consistent timestamp, level, service, environment, event, and request ID shape;
- accept or generate a request ID and return it in response headers;
- record route template, method, status, and duration, not request bodies;
- log DB and migration errors without URLs or bound values;
- log provider failures by provider, status class, retryability, and request ID;
- log auth failures by event and coarse client fingerprint, never credentials or cookies;
- configure retention and redaction at the hosting layer.

Never log passwords, password hashes, raw session tokens, token digests, CSRF values/digests, Cookie or Authorization headers, provider API keys, recommendation signing secrets, recommendation tokens, or full external payloads.

## 10. Environment And Secrets

Frontend build configuration:

- `VITE_API_BASE_URL`: public and required for the chosen production origin; no secrets may use a `VITE_` name.

Backend non-secret configuration:

- `APP_NAME`, `APP_VERSION`, `ENVIRONMENT`;
- `FRONTEND_ORIGINS`;
- timeouts, cache limits, page sizes, model name, and prompt version;
- cookie names, session duration, and rate-limit thresholds.

Backend production-required secrets/configuration:

- `DATABASE_URL`;
- `AUTH_COOKIE_SECURE=true` as a validated security setting;
- `LLM_RECOMMENDATION_SIGNING_SECRET` when recommendation save/generation is enabled.

Feature-optional secrets:

- `LLM_API_KEY` with `LLM_LIVE_CALLS_ENABLED=true`;
- `YOUTUBE_API_KEY`;
- `PEXELS_API_KEY`.

Use provider secret injection, rotate leaked values, and keep `.env` files untracked. `.env.example` files contain placeholders only and remain split between the frontend root and backend directory.

## 11. Startup Behavior

Current behavior:

- Settings and the SQLAlchemy engine are created at module import.
- FastAPI lifespan opens a database Session and calls `ensure_development_user`.
- No `SQLModel.metadata.create_all` or automatic Alembic upgrade runs in application startup.
- A shared outbound `httpx.AsyncClient` is created for YouTube/Pexels requests.
- The OpenAI adapter creates and closes its SDK client per recommendation request.
- Missing or unmigrated DB schema causes startup to fail during the development-user query.

Target behavior:

- deployment runs migrations before application startup;
- startup performs no production seed write;
- optional development seed behavior is explicit and environment-gated;
- startup can initialize clients but must fail clearly without logging secrets;
- readiness, not liveness, reflects database availability;
- test and application engine creation are explicit enough to inject PostgreSQL safely.

## 12. Development User And Seed Policy

`ensure_development_user` creates an inactive, passwordless compatibility user. It cannot log in, so it is not an auth bypass. It is nevertheless an unconditional production database write and must be removed or restricted before deployment.

Production must never auto-create an admin, active user, password, or passwordless login identity. Test users belong only in pytest fixtures. Any future demo seed must be an explicit one-off command that refuses to run in production unless intentionally authorized.

## 13. Process-Local State

Authentication signup/login throttling, recommendation concurrency/rate limits, and some provider caches are in memory. This is deterministic for one process but scales independently per worker/replica.

For the first low-cost deployment, use one backend process/replica and add gateway-level request limits. Before horizontal scaling, move security-sensitive rate limiting to shared storage such as PostgreSQL or Redis. Search caches may remain per-instance because inconsistency affects efficiency rather than authority.

## 14. Deployment Artifact Plan

Phase 11-3 or 11-4 should add, after provider choice:

- a backend container definition with a pinned Python runtime and non-root user;
- a deterministic frontend build command and static hosting output;
- a local PostgreSQL Compose file for development only;
- a release migration command;
- health/readiness probe configuration;
- a production environment variable matrix;
- a minimal CI job for backend tests, frontend smokes/build, and PostgreSQL migrations.

Generated `dist`, virtual environments, databases, coverage, caches, and real environment files remain untracked.

## 15. Phase 11 Execution Plan

### Phase 11-2: SQLite To PostgreSQL Compatibility

1. Add Psycopg 3 and an engine factory with dialect-specific options.
2. Add production settings validation without changing auth semantics.
3. Audit and, only where required, adjust DateTime/default/FK definitions.
4. Run the complete Alembic chain on disposable PostgreSQL.
5. Add migration-backed PostgreSQL ownership, transaction, duplicate, and import-race tests.
6. Keep the existing SQLite suite green during the compatibility phase.

Likely files:

- `backend/requirements.txt`
- `backend/app/core/config.py`
- `backend/app/core/database.py`
- `backend/alembic/env.py`
- selected files under `backend/app/models/`
- selected revisions under `backend/alembic/versions/` only if PostgreSQL execution proves a real incompatibility
- `backend/tests/conftest.py`
- new PostgreSQL integration tests and backend environment documentation

### Phase 11-3: Local PostgreSQL Integration

1. Add a development-only PostgreSQL Compose service and persistent volume.
2. Add guarded local/test database bootstrap commands.
3. Run Alembic from blank to head and exercise downgrade/re-upgrade in PostgreSQL.
4. Run the full backend suite against PostgreSQL or define a documented unit/integration matrix.
5. Validate timezone, boolean, FK, unique NULL, concurrency, and sequence behavior.
6. Remove assumptions that only SQLite exposes.

### Phase 11-4: Production Configuration And Security

1. Enforce production `DATABASE_URL`, HTTPS cookies, exact origins, and safe secret presence.
2. Remove or gate the development-user seed.
3. Add liveness/readiness and production logging/request IDs.
4. Define trusted proxy/host handling and the one-origin routing contract.
5. Add backend/frontend container or hosting build configuration.
6. Add minimal CI and a single release migration job.
7. Update README and presentation documentation to server-first architecture.

### Phase 11-5: Deployment

1. Select providers using current pricing and capabilities at that time.
2. Provision frontend, backend, and managed PostgreSQL.
3. Inject secrets and run the release migration.
4. Validate HTTPS, cookies, CSRF, CORS, auth restore, ownership 404s, server-first Project CRUD, Content Idea conversion, legacy import, and external-provider failure handling.
5. Confirm backups, rollback procedure, logs, probes, and custom/provider domain behavior.
6. Record the final deployment runbook and production smoke evidence.

## 16. Phase 11-1 Exit Criteria

- No PostgreSQL runtime conversion was performed in this phase.
- The recommended topology preserves the current auth and CSRF contract.
- PostgreSQL-specific risks are classified and assigned to Phase 11-2/11-3.
- Migration, health, logging, startup, seed, and secret policies have explicit owners and phases.
- Phase 11-2 can begin with the compatibility task list above.
