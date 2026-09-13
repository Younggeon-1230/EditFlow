# Phase 9-6: User-scoped localStorage

## Inventory before the change

| Legacy key | Data shape | Readers/writers | Classification |
| --- | --- | --- | --- |
| `editflow_projects` | Project array | `useProjects`, project migration | Durable user data |
| `editflow_checklists` | `{ [localProjectId]: item[] }` | `useChecklist`, checklist migration, project cleanup | Durable user data |
| `editflow_saved_references` | Saved reference array | Local-project save button | Durable user data |
| `editflow_saved_brolls` | Saved B-roll array | Local-project save button | Durable user data |
| `editflow_project_memos` | `{ [localProjectId]: memo[] }` | `useProjectMemos`, project cleanup | Durable user data |

There was no `sessionStorage` usage. YouTube/Pexels search state is React memory/API response data rather than durable browser storage. Content Ideas and their saved media use authenticated APIs, so they are not local migration targets.

## Namespace

Authenticated local data now uses `editflow:v2:user:{userId}:{resource}`. The resources are:

- `projects`
- `checklist`
- `saved-references`
- `saved-brolls`
- `project-memos`
- `legacy-import-status`

`userId` is the integer `AuthProvider.user.id` returned by the backend. Email, a dev user, and an anonymous fallback are never used. Hooks do not read or write browser app data until that ID exists.

## Account switching

`AppLayout` keys the routed application subtree by the authenticated user ID. A user change therefore remounts the route and initializes its hooks from only the new user's keys. Logout does not remove any user-scoped keys, so signing back into the same account restores that account's local state.

## Legacy import

The layout-only migration banner is the sole reader of the five legacy global keys. It appears only for an authenticated user when meaningful legacy data (or an unreadable legacy value needing attention) exists and that user has no completed marker. “나중에” only hides it for the current mounted session.

Import is always explicit and copies the whole legacy set. Legacy source keys are never deleted or changed. Existing scoped records win on collisions; array records merge by stable `id`, while checklist and memo collections merge by local project ID and then item ID.

Before writing, every legacy/scoped value is parsed, shape-checked, transformed, merged, and serialized. Target values are snapshotted. A write failure triggers best-effort rollback and does not leave the completion marker. The marker is written last, making a completed import idempotent.

Legacy projects lose their `backendProjectId` and become `local_only`. Nested camelCase `backend...Id` and `server...Id` mappings are removed from imported resources. This preserves local content and stable local IDs without treating another owner's server resource identifiers as authoritative. Existing project/checklist sync and server-project recovery continue through the authenticated APIs and now persist mappings only in the current user's namespace.

## Security boundary

The namespace is browser UX/privacy separation, not an authorization boundary. Phase 9-5 backend ownership checks remain the security boundary for server resources.

## Verification

- Vite production build
- Pure JavaScript storage smoke scenarios: key isolation, merge precedence, legacy preservation, mapping stripping, completion/idempotency, corrupt JSON, and write-failure rollback
- Source inventory confirming only the legacy detector/importer references the global keys

No backend code or database schema is changed in this phase.
