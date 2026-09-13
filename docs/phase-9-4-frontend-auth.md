# Phase 9-4 frontend session authentication

## Scope

Phase 9-4 connects the existing DB-backed opaque session API to the React UI. It adds account creation, login, logout, session restoration, and route protection without changing the database or backend API contract.

The following remain out of scope: replacing `DevelopmentUserDependency`, ownership/IDOR enforcement, per-user localStorage namespaces, legacy local-data import, server-first projects, roles, OAuth, password reset, email verification, and MFA. Those ownership and browser-storage gaps are intentionally deferred to Phase 9-5 and Phase 9-6.

## AuthProvider

`AuthProvider` owns only the state needed by the UI:

- `user`
- `isAuthenticated`
- `isLoading`
- `authError`

On mount it calls `GET /api/auth/me`. A 200 response restores the user, a 401 establishes a normal signed-out state, and a network or 5xx failure is retained as `authError` so a backend outage is not presented as a logout. The protected-route error gate offers an explicit retry and does not retry indefinitely.

Login and signup use the user returned by the backend because both endpoints create the session. Logout clears local auth state only after a 204 response. A 401 during logout is also treated as signed out because the server session is already absent; network and 5xx failures retain the current user and show an error.

An operation version prevents stale `/me`, login, signup, or logout results from overwriting newer auth state. Mounted checks prevent page-level async results from updating an unmounted form.

## API and CSRF

`src/services/authApi.js` exposes `getMe`, `signup`, `login`, and `logout` through the existing `apiClient`. It does not duplicate CSRF handling.

The shared client continues to send `credentials: 'include'`, obtains the JavaScript-readable CSRF cookie before unsafe requests, and attaches `X-CSRF-Token`. If the backend reports `csrf_required` or `csrf_invalid`, the client refreshes the CSRF cookie and retries that request once. `csrf_origin_invalid` is not retried.

The shared client publishes authenticated-request 401 responses to the provider. Login's expected `invalid_credentials` 401 opts out, so a failed login does not masquerade as session expiry.

The frontend never stores the opaque session token in React state, localStorage, or sessionStorage. The browser owns the HttpOnly session cookie; React restores the user with `/me` after a refresh. No cookie, CSRF token, password, user, or auth response is logged.

## Routes and navigation

Public-only routes:

- `/login`
- `/signup`

Protected routes:

- `/`
- `/projects`
- `/projects/:projectId`
- `/ideas`
- `/ideas/:ideaId`
- `/reference`
- `/broll`
- `/checklist`
- the existing authenticated 404 route

`ProtectedRoute` waits for the initial `/me` request before deciding whether to render or redirect. Signed-out visitors are redirected to `/login` with the current React Router location in navigation state. Successful login restores its pathname, search, and hash using only an internal location object; arbitrary external URL strings are rejected. Auth redirects and logout navigation use history replacement.

Authenticated users visiting `/login` or `/signup` are sent to the intended internal destination or `/`. The application header shows the current email and a duplicate-click-safe logout button.

## Forms and errors

Login accepts email and password. Signup accepts email, password, and password confirmation but sends only email and password. Email is trimmed for user experience; passwords are never trimmed. Signup mirrors the backend's 12-to-128-character limit and checks exact confirmation equality without inventing composition rules.

Known backend codes are mapped to stable Korean UI copy: `invalid_credentials`, `email_already_registered`, `invalid_email`, `invalid_password`, `rate_limited`, and the CSRF codes. Unknown responses, network failures, and 5xx responses use generic messages rather than exposing backend details.

## Verification boundary

No backend, database model, migration, or OpenAI code changes are part of this phase. Multi-user data isolation is not a Phase 9-4 success condition because existing CRUD dependencies and global localStorage remain transitional until Phase 9-5/9-6.
