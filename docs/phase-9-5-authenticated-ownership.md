# Phase 9-5: authenticated ownership enforcement

Phase 9-5 replaces the compatibility-era fixed development user in runtime API
requests with the user resolved from the opaque database-backed session cookie.
No database schema or Alembic migration is added.

## Route policy

| Class | Routes | Policy |
| --- | --- | --- |
| Public | `/`, `/health`, `/api/auth/csrf`, `/api/auth/signup`, `/api/auth/login` | No authenticated session required |
| Session-aware auth | `/api/auth/me`, `/api/auth/logout` | Existing auth contract; logout remains idempotent for an invalid or missing session |
| Authenticated app service | `/api/external/youtube/search`, `/api/external/pexels/search` | Valid current user required; results are not persisted as owned rows |
| User-owned | Project, checklist, memo, saved media, content idea, idea media, conversion, and recommendation routes | Valid current user plus ownership scope required |

Unknown resources and resources owned by another user both return the existing
generic `404` response. This avoids revealing whether another user's resource
exists.

## Ownership chain

- `Project` and `ContentIdea` are queried with both their ID and `current_user.id`.
- Checklist items, project memos, and saved reference/B-roll rows inherit ownership
  through their parent project.
- Content idea reference/B-roll rows inherit ownership through their parent idea.
- Conversion first scopes the idea to the current user, then restricts selected
  media to that idea. The generated project uses the same current user ID.
- Project deletion restores only linked content ideas with the same owner.
- Recommendation generation and signed save tokens are bound to the actual current
  user ID.

## Authentication and CSRF

Unsafe protected requests validate the request origin, require an authenticated
session, and then validate the CSRF token against that session. A pre-auth
double-submit CSRF cookie can therefore no longer authorize protected mutation.
Signup and login retain their pre-auth CSRF flow.

## Legacy development user

Startup still idempotently ensures the inactive, passwordless
`dev@editflow.local` row so existing database ownership remains valid. Runtime
request dependencies no longer resolve or use that account. No data is reassigned
or automatically imported into a real account.

## Deferred work

Browser `localStorage` remains global until Phase 9-6. A stale local mapping that
references another account's backend project now receives `404`; Phase 9-6 will
add user-namespaced storage and an explicit legacy import flow.
