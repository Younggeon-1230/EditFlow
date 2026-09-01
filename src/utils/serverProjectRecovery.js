import { mergeBackendProject } from '../services/projectsApi.js'

export function isBackendProjectId(value) {
  return Number.isInteger(value) && value > 0
}

export function createProjectId({
  randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto),
  now = Date.now,
} = {}) {
  return randomUUID ? randomUUID() : `project-${now()}`
}

export function createLocalProject(projectValues, options) {
  return {
    id: createProjectId(options),
    ...projectValues,
    backendProjectId: null,
    syncStatus: 'syncing',
    lastSyncError: null,
    referenceCount: 0,
    brollCount: 0,
    checklistDone: 0,
    checklistTotal: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  }
}

export function createRecoveredLocalProject(serverProject, options) {
  if (!isBackendProjectId(serverProject?.backendProjectId)) {
    throw new TypeError('서버 프로젝트 ID는 양의 정수여야 합니다.')
  }
  const localProject = createLocalProject(
    {
      title: serverProject.title,
      description: serverProject.description,
      clientName: serverProject.clientName,
      deadline: serverProject.dueDate,
      dueDate: serverProject.dueDate,
      status: undefined,
    },
    options,
  )
  return mergeBackendProject(localProject, serverProject)
}
