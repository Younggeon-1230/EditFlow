# Phase 11-5: Actual Deployment

## Status

The repository-side deployment implementation and local regression are ready.
The account-side Neon and Render operations are not yet executed because this
Codex session has no connected Render or Neon account. Consequently, no public
URL, managed-database migration result, HTTPS browser result, provider smoke,
or Render log result is claimed in this document. Complete the short handoff
below, then run the production QA before marking EditFlow v1 complete.

Do not paste database passwords, API keys, cookies, or tokens into chat, source
control, this document, or the README.

## Final Deployment Architecture

```text
Browser
  |
  | HTTPS (one origin)
  v
Render Web Service (Docker, 1 instance, Uvicorn worker count 1)
  |-- /api/*           FastAPI JSON API
  |-- /health/live     process liveness
  |-- /health/ready    FastAPI + PostgreSQL readiness
  |-- /assets/*        Vite production assets
  `-- all other GETs   built file or React index.html fallback
          |
          `-- Neon PostgreSQL (direct TLS connection)

Optional request-time providers: OpenAI Responses API, YouTube API, Pexels API
```

FastAPI-served React was selected over separate public frontend and backend
origins. It keeps the current host-only session and CSRF cookies readable or
sendable only where intended, keeps `SameSite=Lax`, requires no parent-domain
cookie, and makes relative `/api` calls genuinely same-origin. A multi-stage
Docker build is used because this single service reproducibly needs both Node
and Python toolchains. No persistent Render filesystem is required.

## Render Configuration

`render.yaml` is the source of truth:

- service: one Docker Web Service on the free plan in Singapore;
- build: Render BuildKit executes the repository-root `Dockerfile`;
- frontend stage: Node 22 Alpine, `npm ci`, then `npm run build`;
- runtime stage: Python 3.13 slim and pinned `backend/requirements.txt`;
- start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`;
- instances: exactly one;
- health check: `/health/live`;
- deploy trigger: manual (`autoDeployTrigger: off`).

Liveness is the platform restart/deploy probe. Readiness is checked separately
after migration so a transient database outage is visible without conflating
process health and dependency health. Free services can cold-start and are not
appropriate for continuous production operations; this deployment is for
production-lifecycle and portfolio validation.

## Neon PostgreSQL

Create a fresh Neon project, database, and production role. Do not import the
local SQLite or local PostgreSQL data. In Neon's Connect dialog select the
direct connection string, require TLS, and preserve all percent-encoding in the
credential. Change only the SQLAlchemy scheme:

```text
postgresql://...  ->  postgresql+psycopg://...
```

Use the direct connection for both Alembic and the application. This avoids
PgBouncer transaction-mode migration limitations and is adequate for one small
application instance. The Render Blueprint limits the SQLAlchemy pool to three
persistent connections plus two overflow connections, with pre-ping, a
30-second checkout timeout, and 300-second recycle. Revisit pooling only if
measured load or the Neon plan requires it.

## Account-side Handoff

Perform these steps in order. Secret values are entered only in the provider
dashboards or a private local shell.

1. In Neon, create the fresh production database and role, and copy its direct
   TLS connection string.
2. In a private local shell, set `ENVIRONMENT=production`, `DATABASE_URL` to
   the converted `postgresql+psycopg` URL, the final HTTPS
   `FRONTEND_ORIGINS`, matching host-only `TRUSTED_HOSTS`,
   `AUTH_COOKIE_SECURE=true`, and `AUTH_COOKIE_SAMESITE=lax`.
3. From `backend/`, run `alembic upgrade head`, then `alembic current`. The
   expected revision is `c4a8d2e91f37`. Do not run a production downgrade.
4. In Render choose **New > Blueprint**, connect this repository and branch,
   review `render.yaml`, and create the service. If the final generated service
   host differs from the planned host, update both values below before the
   first manual deploy.
5. Enter `DATABASE_URL`, `FRONTEND_ORIGINS`, and `TRUSTED_HOSTS` in Render.
   Trigger a manual deploy only after the migration succeeds.
6. Add optional `YOUTUBE_API_KEY`, `PEXELS_API_KEY`, and `LLM_API_KEY` only in
   Render. Keep `LLM_LIVE_CALLS_ENABLED=false` until the bounded AI smoke.

`FRONTEND_ORIGINS` contains the complete origin, for example
`https://SERVICE.onrender.com`. `TRUSTED_HOSTS` contains only the host, for
example `SERVICE.onrender.com`. Do not set `VITE_API_BASE_URL` in production;
the frontend then uses same-origin `/api` URLs.

Render free Web Services do not provide the paid pre-deploy command used for a
release migration. That is why the first migration is an explicit local
one-time release step before the first manual deploy. For later schema-bearing
releases, either repeat the migration-before-deploy sequence or move to a paid
service and configure `cd backend && alembic upgrade head` as the pre-deploy
command. Migrations never run in application startup.

## Frontend Static Serving

The runtime image places Vite output at `/app/dist`. `app/main.py` resolves the
same repository-relative path on Linux. In production it fails at import if
`dist/index.html` is absent. In development it does not require `dist`, and the
existing Vite-on-5173 plus FastAPI-on-8000 workflow remains unchanged.

Real API and health routes are registered first. Explicit JSON 404 guards for
unknown `/api` and `/health` paths are next. A final Starlette `StaticFiles`
mount securely serves existing build files and returns `index.html` only for
frontend routes. It never constructs arbitrary filesystem paths. Thus:

- `GET /projects/123` returns the SPA shell;
- `GET /api/does-not-exist` returns JSON 404;
- `GET /health/live` remains a FastAPI response;
- assets and public files are served from `dist` only;
- traversal cannot expose files outside `dist`.

Vite's current production build emits hashed JS/CSS and no source maps.

## Production Environment

Required Render values:

- `ENVIRONMENT=production`
- `DATABASE_URL` (secret)
- `FRONTEND_ORIGINS` (exact HTTPS origin)
- `TRUSTED_HOSTS` (exact hostname, no scheme)
- `AUTH_COOKIE_SECURE=true`
- `AUTH_COOKIE_SAMESITE=lax`

Optional provider values are `YOUTUBE_API_KEY`, `PEXELS_API_KEY`, and
`LLM_API_KEY`. Live AI additionally requires
`LLM_RECOMMENDATION_SIGNING_SECRET` of at least 32 bytes; the Blueprint
generates it. Production settings reject SQLite, loopback database hosts,
placeholder database passwords, insecure cookies, wildcard origins/hosts,
HTTP origins, and origin/host mismatches.

## Production QA Checklist

Record timestamps and pass/fail results here only after testing the public URL.
Never record secret values or raw response cookies.

### Health, routing, and logs

- [ ] `GET /health/live` returns 200 and `{"status":"ok"}`.
- [ ] `GET /health/ready` returns 200 through a live Neon query.
- [ ] Both responses contain a server-generated `X-Request-ID`.
- [ ] `/`, `/projects`, `/projects/{id}`, `/ideas/{id}`, `/login`, and
  `/signup` load or refresh through the SPA fallback.
- [ ] `/api/does-not-exist` is JSON 404, never HTML.
- [ ] Render logs contain request ID, method, path, status, and duration.
- [ ] Logs contain no password, cookie, token, CSRF value, API key, database
  URL, exception credential, or Neon host detail.
- [ ] Cold and warm request durations are recorded separately; cold-start
  latency is treated as a hosting characteristic, not an application defect.

### HTTPS, authentication, and CSRF

- [ ] Session cookie is Secure, HttpOnly, SameSite=Lax, host-only, Path=/, and
  has the configured TTL.
- [ ] CSRF cookie is Secure, JavaScript-readable, SameSite=Lax, host-only,
  Path=/, and has the configured TTL.
- [ ] Signup, login, `/me`, F5 session restore, logout, and relogin pass.
- [ ] A valid unsafe request passes.
- [ ] Missing and invalid CSRF headers return 403.
- [ ] A controlled request with an invalid Origin returns 403.

### Browser workflow

- [ ] Project create, update, list, detail, and child checklist/memo CRUD pass.
- [ ] Content Idea creation and Project conversion pass.
- [ ] A second account receives 404 for the first account's project.
- [ ] One legacy import passes if legacy test data is available.
- [ ] Direct `/projects/{id}` navigation and refresh preserve the session.

The Windows browser harness covers the main flow, cookie attributes, CSRF
negative cases, invalid origin, ownership isolation, and direct-route refresh:

```powershell
$env:QA_FRONTEND_URL = "https://SERVICE.onrender.com"
$env:QA_API_URL = $env:QA_FRONTEND_URL
node backend/scripts/postgresql_browser_qa.mjs
```

It creates timestamped QA accounts and records only statuses and cookie
attributes, never cookie values. Remove QA data later only through an explicit,
reviewed operation; no cleanup command is automated.

## AI And External API Smoke

YouTube and Pexels are optional request-time checks. If keys are configured,
perform one small search against each. For OpenAI, set the model supported by
the account, enable `LLM_LIVE_CALLS_ENABLED`, perform exactly one recommendation
request, verify structured recommendations render, save one recommendation via
its save token, and verify Content Idea persistence. Then immediately set
`LLM_LIVE_CALLS_ENABLED=false` and redeploy. If no key/budget is available,
record the smoke as explicitly skipped; do not fabricate a pass.

## Local Verification Recorded Before Account Handoff

- `pytest -q`: 382 passed, 12 PostgreSQL tests deselected.
- static-serving tests: 9 passed.
- `npm run build`: passed; 162 modules transformed; no source maps emitted.
- `npm audit`: 0 vulnerabilities after a non-forced lockfile refresh within the
  existing semver ranges (including React Router 7.18.4 and PostCSS 8.5.28).
- Docker image build: not run because the local Docker daemon was unavailable.
- `compileall`: passed.
- `pip check`: no broken requirements.
- `alembic heads`: one head, `c4a8d2e91f37`.
- `alembic check`: no new upgrade operations detected against local SQLite.
- production-mode in-process smoke: `/`, built asset, and `/projects/123` were
  200; unknown API was JSON 404; liveness was 200; every response had an
  `X-Request-ID`.
- PostgreSQL integration: attempted, but all 12 setup paths were blocked by a
  connection timeout because no local PostgreSQL service or Docker daemon was
  running. The last recorded live-PostgreSQL baseline remains 12 passed; rerun
  against Neon without the destructive `_test` harness.
- whitespace check: run in the final verification pass and record its result.

The local Python runtime was 3.14.3 and Node was 24.14.1. Deployment does not
copy those versions blindly: the Docker image pins Python 3.13 and Node 22 LTS
for provider compatibility and repeatability.

## Known Limitations And Service Policy

- Rate limits and recommendation save-token replay state are process-local, so
  one Uvicorn worker and one Render instance are mandatory.
- There is no Redis, autoscaling, HA, multi-region deployment, custom domain,
  upload storage, or production data migration.
- Render's filesystem is ephemeral and holds no authoritative application data.
- A free service can sleep and cold-start.
- This deployment validates the production lifecycle and security posture; it
  is not a commitment to continuous public operation.

After QA, the recommended state is `LLM_LIVE_CALLS_ENABLED=false`, followed by
suspending the Render service if the portfolio URL need not remain available.
Deletion is appropriate only after the deployment evidence is captured and the
user explicitly chooses to remove both service and database.

## Completion Gate

EditFlow v1 remains **on hold** until the account-side deployment, Neon
migration, HTTPS/browser/security QA, logs review, and P0/P1 triage are
complete. Missing Redis, multi-replica support, autoscaling, a custom domain,
or permanent uptime are not v1 blockers. After every checklist item above is
verified with no P0/P1 defect, update this status and the README with the real
deployment URL and completion result.
