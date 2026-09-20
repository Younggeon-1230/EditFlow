import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import {
  countUnassignedLegacyMedia,
  createLegacyProjectImportPayload,
  markLegacyProjectMigrated,
  readLegacyProjectChildren,
} from '../src/utils/legacyProjectMigration.js'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    read: (key) => values.get(key) ?? null,
  }
}

const keys = {
  projects: 'projects',
  checklist: 'checklist',
  memos: 'memos',
  references: 'references',
  brolls: 'brolls',
}
const storage = createStorage({
  [keys.projects]: JSON.stringify([{
    id: 'local-17',
    title: '  Legacy project  ',
    description: '  Keep me  ',
    clientName: '  Client  ',
    status: 'in_progress',
    deadline: '2026-10-20',
    backendProjectId: 999,
    syncStatus: 'sync_failed',
    lastSyncError: 'stale',
  }]),
  [keys.checklist]: JSON.stringify({
    'local-17': [{
      id: 'local-check-1',
      backendChecklistItemId: 888,
      text: '  Review  ',
      done: true,
    }],
  }),
  [keys.memos]: JSON.stringify({
    'local-17': [{
      id: 'local-memo-1',
      backendProjectId: 999,
      content: '  Keep this memo  ',
      position: 4,
    }],
  }),
  [keys.references]: JSON.stringify([{ id: 'unassigned-reference' }]),
  [keys.brolls]: JSON.stringify([{ id: 'unassigned-broll' }]),
})

const project = JSON.parse(storage.read(keys.projects))[0]
const children = readLegacyProjectChildren(storage, project.id, {
  checklistKey: keys.checklist,
  memoKey: keys.memos,
})
const payload = createLegacyProjectImportPayload(project, children)

assert.deepEqual(payload, {
  source_local_id: 'local-17',
  title: 'Legacy project',
  description: 'Keep me',
  client_name: 'Client',
  status: 'in_progress',
  due_date: '2026-10-20',
  checklist_items: [{
    title: 'Review',
    description: null,
    is_completed: true,
    position: 0,
  }],
  memos: [{ content: 'Keep this memo', position: 4 }],
})
assert.equal('backendProjectId' in payload, false)
assert.equal('references' in payload, false)
assert.equal('brolls' in payload, false)
assert.deepEqual(
  countUnassignedLegacyMedia(storage, {
    referenceKey: keys.references,
    brollKey: keys.brolls,
  }),
  { references: 1, brolls: 1 },
)

assert.equal(
  markLegacyProjectMigrated(
    storage,
    keys.projects,
    project.id,
    42,
    '2026-09-14T00:00:00Z',
  ),
  true,
)
assert.deepEqual(JSON.parse(storage.read(keys.projects))[0], {
  id: 'local-17',
  title: '  Legacy project  ',
  description: '  Keep me  ',
  clientName: '  Client  ',
  status: 'in_progress',
  deadline: '2026-10-20',
  migratedToProjectId: 42,
  migratedAt: '2026-09-14T00:00:00Z',
})

assert.equal(existsSync('src/utils/projectMigration.js'), false)
assert.equal(existsSync('src/utils/checklistMigration.js'), false)

console.log('legacy project migration smoke: ok')
