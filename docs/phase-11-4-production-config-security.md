# Phase 11-4: Production Config And Security

## Scope And Decision

Phase 11-4 establishes the configuration and runtime boundary needed before an
actual deployment. It does not deploy EditFlow, connect a managed database, or
prove HTTPS cookie transport. The production target remains one public HTTPS
origin, one FastAPI process/replica, and managed PostgreSQL.

The application now fails during settings construction for unsafe production
configuration. Database availability is intentionally different: it is
reported by readiness, so a transient database outage does not create a restart
loop. FastAPI startup runs neither schema creation nor Alembic migrations.

## Environment Policy

Only `development`, `test`, and `production` are accepted.

| Environment | Database and seed | Cookies and origins | Diagnostics |
| --- | --- | --- | --- |
| `development` | SQLite or explicit PostgreSQL; inactive compatibility user may be ensured | local HTTP and `Secure=false` allowed; exact local origin | SQL echo enabled with parameters hidden |
| `test` | fixture-controlled; no development user | deterministic settings may use local HTTP | SQL echo disabled |
| `production` | complete non-loopback `postgresql+psycopg` URL; no seed | HTTPS origins, matching trusted hosts, `Secure=true`, `SameSite=Lax` | SQL echo disabled; parameters hidden |

FastAPI debug mode is not enabled. Unknown environment names fail validation.

## Production Configuration

Required:

- `ENVIRONMENT=production`
- `DATABASE_URL`: complete `postgresql+psycopg` URL with username, password,
  non-loopback host, and database name
- `FRONTEND_ORIGINS`: comma-separated exact public HTTPS origins
- `TRUSTED_HOSTS`: comma-separated exact host names containing every frontend
  origin host
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=lax`

Required only when `LLM_LIVE_CALLS_ENABLED=true`:

- `LLM_API_KEY`
- `LLM_RECOMMENDATION_SIGNING_SECRET`: at least 32 UTF-8 bytes

Optional provider features:

- `YOUTUBE_API_KEY`
- `PEXELS_API_KEY`

YouTube and Pexels are request-time features and are not startup or readiness
dependencies. EditFlow uses random opaque session tokens stored as SHA-256
digests, not signed session payloads, so there is no static session-signing
secret. Real values belong in the hosting secret store and must never be logged
or committed.

Validation rejects SQLite, loopback database hosts, known placeholder database
passwords, insecure cookies, non-HTTPS or local production origins, wildcard or
path-bearing origins, wildcard hosts, local production hosts, and frontend
hosts absent from the trusted-host list.

## Cookies, CORS, And CSRF

The production session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`,
host-only, and `Path=/`. The CSRF cookie deliberately remains readable to
JavaScript but has the same `Secure`, SameSite, host-only, path, and lifetime
attributes. Logout deletes both cookies with matching attributes.

CORS uses only `FRONTEND_ORIGINS`, credentials remain enabled, and wildcard
origins are rejected. Production does not append localhost. The existing CSRF
contract remains unchanged:

- pre-auth signup/login use a double-submit token;
- authenticated unsafe requests additionally bind the CSRF token to the stored
  session digest;
- unsafe methods validate an exact Origin or Referer;
- safe methods do not require CSRF validation.

The frontend keeps `credentials: "include"`, obtains the CSRF cookie through
the existing bootstrap, and supplies `X-CSRF-Token`. Production defaults to
same-origin relative requests when `VITE_API_BASE_URL` is omitted. Local
development retains the explicit `http://127.0.0.1:8000` default.

## Host And Proxy Boundary

`TrustedHostMiddleware` checks the configured host allowlist. The application
does not independently trust arbitrary `X-Forwarded-*` values. At deployment,
proxy header support may be enabled only with the hosting provider's known
proxy addresses, for example:

```text
uvicorn app.main:app --proxy-headers --forwarded-allow-ips=<trusted-proxy-cidr>
```

Using `*` for forwarded proxies is not the default policy. The provider and its
actual network boundary must be selected before filling this value.

## Health And Startup

`GET /health/live` returns `200 {"status":"ok"}` and performs no database or
provider I/O. `/health` remains a compatibility alias with the same behavior.

`GET /health/ready` executes `SELECT 1`. It returns the same minimal `200`
payload when PostgreSQL is reachable and `503 {"status":"unavailable"}` for a
SQLAlchemy connectivity failure. Responses do not expose environment, version,
database host/name, SQL, exception text, or provider state.

Invalid production settings fail at import/startup. Provider availability is
not checked at startup. Production startup opens a lazy SQLAlchemy session but
does not query or mutate the database, so availability is owned by readiness.
Development alone may query to ensure its inactive compatibility user.

## Migrations And Release

The release owner, not each application replica, performs migrations:

```text
alembic upgrade head
start application
verify /health/ready
```

Exactly one release job runs the upgrade. A migration failure aborts rollout
and leaves existing instances serving when the platform supports it. The
application never calls `create_all`, never runs Alembic during lifespan, and
never performs an automatic production downgrade. Recovery is an explicit
forward fix or managed database restore decision.

## PostgreSQL Pool

Production PostgreSQL engines enable `pool_pre_ping` and use conservative,
environment-overridable QueuePool settings:

| Variable | Default |
| --- | ---: |
| `DB_POOL_SIZE` | 5 |
| `DB_MAX_OVERFLOW` | 5 |
| `DB_POOL_TIMEOUT_SECONDS` | 30 |
| `DB_POOL_RECYCLE_SECONDS` | 1800 |

The deployment must fit `replicas * (pool size + overflow)` within the managed
database connection limit. SQLite and non-production engines do not receive
these PostgreSQL pool options.

## Request Logging And Errors

The HTTP middleware generates a UUID for every request and ignores a
client-supplied request ID. It returns the value in `X-Request-ID` and records
structured log fields for request ID, method, path, status, and duration.
Unexpected exceptions return a generic `500` containing the same request ID.
The log records only the exception type, avoiding exception messages that may
contain credentials or user input.

Request headers, query strings, bodies, cookies, authorization values,
passwords, session/CSRF values or digests, provider keys, signing secrets, and
full database URLs are not logged. SQLAlchemy keeps `hide_parameters=True`.
Readiness logs only a generic connectivity event.

## Process-Local State

Authentication throttles, recommendation throttles/concurrency, and
recommendation save-token replay reservations remain process-local. Redis or a
new distributed subsystem is deliberately outside this phase.

The v1 production contract is exactly one backend process/replica. The hosting
configuration must keep replica and worker count at one. Gateway rate limiting
is recommended. Before multiple processes or replicas are enabled, security-
sensitive limits and replay reservations must move to PostgreSQL/Redis or gain
an equivalent shared gateway control.

## Validation Boundary

Automated tests cover production setting rejection, conditional AI secrets,
production and development cookie attributes, exact origins, PostgreSQL pool
options, seed gating, liveness, readiness success/failure, trusted hosts,
server-generated request IDs, and sanitized unexpected errors.

The Phase 11-3 local PostgreSQL instance supports a production-like smoke of
the production engine pool path, database connection, readiness query, and
cookie header generation using fake test values. This is not a managed database
or HTTPS test. Actual TLS termination, Secure cookie transport, public proxy
headers, platform probes, secret injection, and deployed browser flows remain
Phase 11-5 work.

## Phase 11-5 Gate

Phase 11-5 may begin only with:

- a provider topology that exposes one public HTTPS origin and `/api` routing;
- one backend process/replica;
- managed PostgreSQL and a single release command;
- secret-store values satisfying production validation;
- trusted proxy addresses and host/origin values;
- health probe mapping (`live` for process health, `ready` for traffic);
- managed backups and an explicit failed-migration response;
- deployed auth, CSRF, ownership, Project, Content Idea, and legacy-import smoke
  tests.

No actual public deployment, managed PostgreSQL connection, DNS, TLS setup,
CDN, Redis, or CI/CD pipeline was added in Phase 11-4.
