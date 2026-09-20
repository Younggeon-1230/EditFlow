import assert from 'node:assert/strict'
import {
  createProjectPayload,
  mapProjectFromApi,
  updateProjectPayload,
} from '../src/services/projectsApi.js'

const createPayload = createProjectPayload({
  title: '  Server confirmed  ',
  description: '  API is authoritative  ',
  clientName: '  EditFlow  ',
  status: '편집 중',
  dueDate: '2026-09-30',
  backendProjectId: 999,
  user_id: 999,
})

assert.deepEqual(createPayload, {
  title: 'Server confirmed',
  description: 'API is authoritative',
  client_name: 'EditFlow',
  status: 'in_progress',
  due_date: '2026-09-30',
})

assert.deepEqual(updateProjectPayload({
  title: '  Updated  ',
  deadline: '2026-10-01',
  backendStatus: 'archived',
}), {
  title: 'Updated',
  due_date: '2026-10-01',
})

assert.deepEqual(mapProjectFromApi({
  id: 42,
  title: 'Canonical',
  description: null,
  client_name: null,
  status: 'planning',
  due_date: null,
  created_at: '2026-09-14T00:00:00Z',
  updated_at: '2026-09-14T00:00:00Z',
}), {
  id: 42,
  title: 'Canonical',
  description: '',
  clientName: '',
  status: 'planning',
  dueDate: '',
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
  referenceCount: 0,
  brollCount: 0,
  checklistCompleted: 0,
  checklistTotal: 0,
})

console.log('projectApi smoke: ok')
