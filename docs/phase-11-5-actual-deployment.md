# Phase 11-5: Actual Deployment

## Status

**Complete.** EditFlow v1 was deployed to Render with Neon PostgreSQL and was
verified through the public HTTPS endpoint. Production health, authentication,
cookie/CSRF behavior, ownership isolation, the core browser workflow, and one
bounded OpenAI live smoke all passed. No P0/P1 production blocker remained.

This is a portfolio deployment for validating the complete production
lifecycle and security behavior. Continuous public operation, high
availability, and monetization are outside the v1 scope.

## Goal

Phase 11-5 closed the path from local development to an actual cloud release:

- apply the complete Alembic chain to a fresh managed PostgreSQL database;
- build and run the Docker image on a public HTTPS service;
- serve the React application and FastAPI API from one origin;
- verify authentication, CSRF, ownership, persistence, and SPA routing;
- run a tightly bounded AI provider smoke without leaving live calls enabled;
- record deployment failures and the fixes that made the release reproducible.

No database credential, provider key, cookie, token, password, or full
connection URL is recorded here.

## Final Architecture

```text
Browser
  |
  | HTTPS / same-origin
  v
Render Web Service (Docker, one instance/process)
  |-- React/Vite static bundle
  |-- FastAPI /api/*
  |-- /health/live
  |-- /health/ready
  `-- SPA fallback
          |
          v
     Neon PostgreSQL

Request-time external providers:
  OpenAI Responses API (live calls normally disabled)
  YouTube Data API
  Pexels API
```

The Render filesystem is not authoritative. Application data is stored in
Neon, while provider secrets exist only in the hosting environment.

## Providers

### Render

- Docker-based Web Service on the free plan;
- Singapore region;
- Blueprint-managed from `render.yaml`;
- `develop` branch;
- one instance and one Uvicorn worker;
- provider HTTPS URL, with no custom domain;
- manual deployment (`autoDeployTrigger: off`);
- platform health check at `/health/live`.

### Neon

- managed PostgreSQL production branch/database;
- direct TLS connection used by the application and Alembic;
- fresh production database with schema migration only;
- no SQLite or development-data import.

## Production URL

https://editflow-1utp.onrender.com

The free service may cold-start after inactivity. Permanent uptime is not a v1
requirement.

## Build And Runtime

The repository-root multi-stage Dockerfile builds the Vite application with
Node 22 Alpine, installs the pinned Python dependencies in a Python 3.13 slim
runtime, copies the backend and its shared runtime data, and finally copies the
built frontend. Uvicorn starts one worker and FastAPI serves both the API and
the production SPA.

Observed production result:

- Docker image build passed;
- FastAPI and Uvicorn startup passed;
- React static assets and SPA fallback were served successfully;
- the Render service reached Live;
- `/` and the public HTTPS application returned 200.

## Alembic Production Migration

`alembic upgrade head` completed against the fresh Neon database before the
application rollout. The resulting revision was:

```text
c4a8d2e91f37 (head)
```

Only the schema was migrated. Existing SQLite/development data was not copied.
The application does not call `create_all`, and FastAPI startup does not run
Alembic automatically. Migration remains an explicit release step before a
schema-bearing rollout.

## Environment And Secrets Policy

Required production settings include the production environment marker,
managed database URL, exact HTTPS frontend origin, trusted Render hostname,
Secure cookie policy, and a generated recommendation-signing secret. Provider
keys are optional secrets and are never included in the image or browser
bundle.

Production validation fails fast for unsafe or incomplete settings. Secret
values are entered only in Render/Neon or a private migration shell; they are
not committed, logged, or copied into documentation.

## Same-Origin Decision

FastAPI serves the React production build instead of using a separate public
frontend provider. This gives the browser one genuine origin for static files,
API requests, and authentication cookies, while preserving host-only cookies,
`SameSite=Lax`, and the existing CSRF design.

A host-only cookie is not inherently impossible with separate frontend and
backend origins. The actual incompatibility is that cross-site fetches would
not send the current `SameSite=Lax` session cookie in the required way. Keeping
one origin avoids redesigning that authentication boundary and is appropriate
for this portfolio deployment.

## Health Verification

The public production endpoints returned:

- `/health/live` -> 200;
- `/health/ready` -> 200 after a live Neon query.

The readiness response exposed no database address, credential, or other
sensitive detail. This verified the Render -> FastAPI -> Neon connection.

## Cookie, Session, And CSRF Verification

Chrome Application inspection confirmed:

| Cookie | Secure | HttpOnly | SameSite | Path | Scope |
| --- | --- | --- | --- | --- | --- |
| `editflow_session` | true | true | Lax | `/` | host-only |
| `editflow_csrf` | true | false | Lax | `/` | host-only |

The CSRF cookie is intentionally JavaScript-readable because the frontend
copies it to the `X-CSRF-Token` header. Signup, login, `/me`, F5 session
restoration, logout, and relogin passed in production.

## Ownership Verification

A second account attempted direct access to the first account's Project and
its checklist items, memos, references, B-rolls, and source Content Idea
relation. Every request returned the intended generic 404. The UI rendered
`프로젝트를 찾을 수 없습니다.` without exposing resource existence.

## Core Browser QA

The following production workflows passed:

- Project create, update, list, and detail;
- checklist and memo operations;
- Content Idea creation and Project conversion;
- persistence after F5;
- persistence after logout and relogin;
- direct SPA route refresh;
- cross-account ownership isolation.

## AI Production Smoke

For one bounded smoke, `LLM_LIVE_CALLS_ENABLED` was temporarily enabled and the
OpenAI key was supplied through the Render secret store. The production chain
completed successfully:

```text
Render FastAPI
  -> OpenAI Responses API
  -> Structured Output validation
  -> recommendation UI (3 results)
  -> signed save_token validation
  -> Content Idea save
  -> Neon persistence
```

The saved result remained visible after F5. After QA,
`LLM_LIVE_CALLS_ENABLED=false` was restored as the normal operating policy.

## Deployment Issue 1: Missing `public` Directory

The first Render build failed at `COPY public ./public` because no Git-tracked
`public` directory existed.

- **Cause:** the Dockerfile copied a path not present in the repository.
- **Fix:** verify that no required asset used the directory and remove only the
  invalid `COPY public ./public` instruction. No empty placeholder directory
  was added.
- **Verification:** `npm ci` and `npm run build` produced the Vite `dist`
  bundle successfully.

## Deployment Issue 2: Missing Shared Runtime Asset

The next image built, but FastAPI startup failed because
`/app/shared/default-checklist.json` was absent.

- **Cause:** `shared` existed in the frontend build stage, but Docker stages do
  not share files automatically. The Python runtime also loads this template.
- **Fix:** add `COPY shared ./shared` to the runtime stage.
- **Verification:** backend startup loaded the default checklist, and the
  Render service reached Live.

The incident demonstrated that every runtime dependency must be copied into
the final stage explicitly, even when it was available in an earlier stage.

## AI Configuration Fail-Fast Issue

The first AI smoke deployment enabled live calls without supplying
`LLM_API_KEY`. Production config correctly rejected the new instance at
startup. Render continued serving the previous healthy instance, whose live
calls were still disabled.

- **Cause:** an intentionally required production secret was missing.
- **Fix:** add the key through Render's secret environment and redeploy.
- **Verification:** the live recommendation and persistence chain passed.

This confirmed both application fail-fast behavior and provider-side retention
of the previously healthy service during a failed rollout.

## Default Checklist Final Polish

Production QA exposed the legacy `기본 체크리스트 복원` wording and an initial
4/10 (40%) template state. The final behavior is:

- show `기본 체크리스트 생성` only for an empty checklist;
- create only after explicit user action, without a confirm dialog;
- show disabled `생성 중…` during the mutation;
- use the shared 10-item template with every item initially incomplete;
- start at 0/10 and 0%;
- use the atomic backend endpoint with a Project row lock;
- reject a non-empty checklist with 409 and roll back on failure;
- update server Projects only from the API response, with no localStorage
  fallback.

`shared/default-checklist.json` remains the single source of truth for both the
empty-Project action and Content Idea -> Project conversion. Existing database
rows were not migrated or rewritten.

## Security And Operational Constraints

- one backend process and one replica are the current contract;
- rate-limit and save-token replay state are process-local;
- there is no Redis, autoscaling, HA, or multi-region deployment;
- there is no custom domain;
- the Render filesystem is ephemeral;
- free-tier cold starts are expected;
- live AI calls are disabled by default;
- no secret is stored in source control or frontend build output.

These are explicit portfolio-scope constraints, not claims of commercial-scale
operation.

## Final QA Results

| Area | Result |
| --- | --- |
| Neon fresh migration | Passed, `c4a8d2e91f37` |
| Render Docker build/startup | Passed |
| HTTPS root and health | Passed |
| Neon readiness | Passed |
| Session cookies and CSRF | Passed |
| Signup/login/F5/logout/relogin | Passed |
| Project and child workflow | Passed |
| Content Idea conversion | Passed |
| Ownership isolation | Passed with generic 404 |
| SPA direct-route refresh | Passed |
| AI live smoke and Neon persistence | Passed; live calls disabled afterward |
| Default checklist polish | 10 items, 0/10, atomic/server-first |
| Backend non-PostgreSQL regression | 386 passed in the final polish run |
| Frontend production build | Passed |

The Phase 11-3 PostgreSQL integration suite had already passed against live
PostgreSQL. It was not rerun during the final documentation-only pass because
no local PostgreSQL/Docker service was running.

## Remaining Non-Blocking Limitations

- free-tier cold start and no continuous-uptime guarantee;
- one backend process/replica;
- process-local rate limiter and recommendation replay state;
- no Redis, custom domain, or automated PostgreSQL CI job;
- no upload/publishing workflow;
- no behavior-driven personalization model;
- continuous operation and monetization are outside the v1 scope.

Before horizontal scaling, security-sensitive limiter and replay state must
move to shared storage or a gateway.

## EditFlow v1 Completion

**EditFlow v1: COMPLETE.**

The completed scope includes the full-stack workflow, authenticated multi-user
ownership, server-first data authority, AI recommendation and save flow,
transactional Content Idea conversion, PostgreSQL compatibility and migration,
managed database deployment, public HTTPS delivery, cookie/CSRF verification,
ownership QA, and a production AI smoke.

No P0/P1 blocker remained at completion. Future work is intentionally focused
on upload/publishing, behavioral measurement and personalization, shared state
for multi-replica operation, and CI automation rather than reopening the v1
deployment gate.
