# Phase 10-4: Project child resources server-first

## Scope

Normal server Projects now treat the backend API as the only authoritative source for Checklist, Memo, Saved Reference, and Saved B-roll data. Legacy local-only Projects keep their user-scoped localStorage behavior until Phase 10-5.

This phase changes no backend schema or API contract. Normal Project creation still does not create a default checklist automatically. Content Idea conversion keeps the backend's existing atomic conversion behavior.

## Child inventory

| Resource | Server Project read/write | Local-only Project read/write |
| --- | --- | --- |
| Checklist | checklist item API | user-scoped checklist localStorage |
| Memo | project memo API | user-scoped project memo localStorage |
| Saved Reference | saved reference API | legacy flat saved-reference localStorage |
| Saved B-roll | saved B-roll API | legacy flat saved-broll localStorage |

Server child failures remain failures: no resource is read from, merged with, or written to localStorage as a fallback. Loading, error, empty, and success states stay distinct, and server child error states expose a retry action.

## Project kind and IDs

Child consumers receive an explicit target:

```js
{ kind: 'server', id: 17 }
{ kind: 'local', id: 'project-abc' }
```

Selector values use `server:17` and `local:project-abc`, preventing collisions between numeric-looking local IDs and backend integer IDs. Existing numeric query values such as `?project=17` normalize to `server:17` for compatibility.

Server checklist, memo, reference, and B-roll records use backend integer IDs as their canonical IDs. Legacy local child IDs remain confined to the local branch.

## Checklist

`useChecklist(projectTarget)` loads and mutates through the checklist API only for a server target. API-confirmed create, update, delete, and explicit default reset update the UI. A failed single delete no longer removes the row as though it succeeded.

For a local target, the hook loads and persists the existing user-scoped checklist key without calling the server. The server checklist page no longer exposes the transitional checklist migration controls.

## Memo

`useProjectMemos(projectTarget)` follows the same explicit branch. Server reads and mutations use the memo API only; local reads and writes occur only for a local target. On a server save failure, the UI keeps the textarea draft and does not create a local memo or show success.

## Saved media

`useSavedReferences` and `useSavedBrolls` accept the explicit project target and enable API access only for server Projects. Search-page save buttons inspect `projectKind`: server saves use the existing `apiClient` services, while local-only saves retain the legacy flat localStorage behavior. No ID-shape inference or cross-source merge remains.

Saved-media update and delete failures retain the existing server item and expose the API error. Project detail and search-page error states support retry.

## Content Idea conversion

The conversion response already returns a complete Project object and is mapped with `mapProjectFromApi`. Conversion success navigates directly to `/projects/{backendId}` and refetches server state. It does not register a local wrapper or create a recovery mapping.

Checklist, memo, and the selected Reference/B-roll subset created by conversion remain backend-owned and are read by the same server child APIs on Project detail. Project deletion and source Idea restoration remain backend responsibilities.

## Recovery cleanup

The old normal-server recovery bundle had no runtime import sites and was removed:

- `ServerProjectImportDialog.jsx`
- `useProjects.js`
- `serverProjectRecovery.js`
- their unused import-dialog styles

The independent legacy Project migration path in `useProjectMutations` and `projectMigration` remains. `checklistMigration.js` is retained only as a Phase 10-5 compatibility building block; it is not reachable from the normal server checklist UI.

## Remaining compatibility and Phase 10-5 blockers

- Idempotent legacy Project import with `source_local_id` and a durable import receipt
- Atomic legacy child import and partial-failure recovery
- Explicit assignment UX for flat legacy Reference/B-roll records
- Stale mapping cleanup and final old localStorage cleanup
- Retirement or redesign of the remaining checklist migration helper

## Verification

- `npm run test:project-api`
- `npm run test:project-children`
- `npm run build`
- `git diff --check`
- Browser QA for server child persistence/failure, local-only compatibility, conversion, and responsive widths

Backend files and migrations: 0. Alembic head remains `e7b2a9c41d60`. OpenAI and external media search calls: 0.
