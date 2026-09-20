import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import {
  createChecklistItemPayload,
  createChecklistUpdatePayload,
  mapChecklistItem,
} from '../src/services/checklistItemsApi.js'
import {
  createProjectTarget,
  encodeProjectSelection,
  normalizeProjectSelection,
} from '../src/utils/projectTarget.js'

const serverTarget = createProjectTarget('server', '17')
const localTarget = createProjectTarget('local', '17')

assert.deepEqual(serverTarget, { kind: 'server', id: 17 })
assert.deepEqual(localTarget, { kind: 'local', id: '17' })
assert.equal(encodeProjectSelection(serverTarget), 'server:17')
assert.equal(encodeProjectSelection(localTarget), 'local:17')
assert.equal(normalizeProjectSelection('17'), 'server:17')
assert.equal(normalizeProjectSelection('server:17'), 'server:17')
assert.equal(normalizeProjectSelection('local:17'), 'local:17')
assert.equal(normalizeProjectSelection('server:0'), '')
assert.equal(createProjectTarget('server', 'local-17'), null)

assert.deepEqual(mapChecklistItem({
  id: 31,
  project_id: 17,
  title: 'Publish',
  description: null,
  is_completed: false,
  position: 2,
  created_at: '2026-09-14T00:00:00Z',
  updated_at: '2026-09-14T00:00:00Z',
}), {
  id: 31,
  projectId: 17,
  text: 'Publish',
  title: 'Publish',
  description: null,
  done: false,
  isCompleted: false,
  position: 2,
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
})

assert.deepEqual(createChecklistItemPayload({
  text: '  Review  ',
  done: true,
  position: 3,
}, { includePosition: true }), {
  title: 'Review',
  description: null,
  is_completed: true,
  position: 3,
})
assert.deepEqual(createChecklistUpdatePayload({ done: false }), {
  is_completed: false,
})

for (const deadPath of [
  'src/components/projects/ServerProjectImportDialog.jsx',
  'src/hooks/useProjects.js',
  'src/utils/serverProjectRecovery.js',
]) {
  assert.equal(existsSync(deadPath), false, `${deadPath} should stay removed`)
}

console.log('project child resources smoke: ok')
