import { requestJson } from './apiClient.js'

const PROJECT_ERROR_MESSAGES = {
  404: '서버에서 프로젝트를 찾을 수 없습니다.',
  422: '프로젝트 정보를 확인해 주세요.',
}

const BACKEND_STATUSES = new Set([
  'planning',
  'in_progress',
  'completed',
  'archived',
])

const FRONTEND_STATUS_BY_BACKEND = {
  planning: '기획 중',
  in_progress: '편집 중',
  completed: '완료',
  archived: '보관됨',
}

export function getProjectStatusLabel(status) {
  return FRONTEND_STATUS_BY_BACKEND[status] ?? status ?? '상태 미입력'
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

export function mapProjectStatusToBackend(status) {
  if (BACKEND_STATUSES.has(status)) {
    return status
  }

  const normalized = String(status ?? '').trim()
  if (normalized.includes('완료')) {
    return 'completed'
  }
  if (normalized.includes('보관') || normalized.includes('아카이브')) {
    return 'archived'
  }
  if (!normalized || normalized.includes('기획')) {
    return 'planning'
  }
  return 'in_progress'
}

function normalizeOptionalText(value) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function normalizeDueDate(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalized = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('프로젝트 마감일을 확인해 주세요.')
  }

  const date = new Date(`${normalized}T00:00:00Z`)
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error('프로젝트 마감일을 확인해 주세요.')
  }
  return normalized
}

export function createProjectPayload(project) {
  const title = String(project.title ?? '').trim()
  if (!title) {
    throw new Error('프로젝트 제목을 입력해 주세요.')
  }

  return {
    title,
    description: normalizeOptionalText(project.description),
    client_name: normalizeOptionalText(
      project.clientName ?? project.client,
    ),
    status: mapProjectStatusToBackend(project.status),
    due_date: normalizeDueDate(project.dueDate ?? project.deadline),
  }
}

export function updateProjectPayload(changes) {
  const payload = {}

  if (hasOwn(changes, 'title')) {
    const title = String(changes.title ?? '').trim()
    if (!title) {
      throw new Error('프로젝트 제목을 입력해 주세요.')
    }
    payload.title = title
  }
  if (hasOwn(changes, 'description')) {
    payload.description = normalizeOptionalText(changes.description)
  }
  if (hasOwn(changes, 'clientName') || hasOwn(changes, 'client')) {
    payload.client_name = normalizeOptionalText(
      changes.clientName ?? changes.client,
    )
  }
  if (hasOwn(changes, 'status')) {
    payload.status = mapProjectStatusToBackend(changes.status)
  }
  if (hasOwn(changes, 'dueDate') || hasOwn(changes, 'deadline')) {
    payload.due_date = normalizeDueDate(
      changes.dueDate ?? changes.deadline,
    )
  }

  return payload
}

export function mapBackendProject(project) {
  return {
    backendProjectId: project.id,
    userId: project.user_id,
    title: project.title,
    description: project.description ?? '',
    clientName: project.client_name ?? '',
    status: project.status,
    dueDate: project.due_date ?? '',
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    referenceCount: project.reference_count ?? 0,
    brollCount: project.broll_count ?? 0,
    checklistCompleted: project.checklist_completed ?? 0,
    checklistTotal: project.checklist_total ?? 0,
  }
}

export function mergeBackendProject(localProject, backendProject) {
  return {
    ...localProject,
    backendProjectId: backendProject.backendProjectId,
    title: backendProject.title,
    description: backendProject.description,
    clientName: backendProject.clientName,
    deadline: backendProject.dueDate,
    dueDate: backendProject.dueDate,
    status:
      localProject.status ??
      FRONTEND_STATUS_BY_BACKEND[backendProject.status] ??
      backendProject.status,
    backendStatus: backendProject.status,
    serverCreatedAt: backendProject.createdAt,
    updatedAt: backendProject.updatedAt,
    referenceCount: backendProject.referenceCount,
    brollCount: backendProject.brollCount,
    checklistCompleted: backendProject.checklistCompleted,
    checklistDone: backendProject.checklistCompleted,
    checklistTotal: backendProject.checklistTotal,
    syncStatus: 'synced',
    lastSyncError: null,
  }
}

export async function getProjects(signal) {
  const projects = await requestJson('/api/projects', {
    signal,
    errorMessages: PROJECT_ERROR_MESSAGES,
    fallbackErrorMessage: '서버 프로젝트를 불러오지 못했습니다.',
  })
  return projects.map(mapBackendProject)
}

export async function getProject(projectId, signal) {
  const project = await requestJson(`/api/projects/${projectId}`, {
    signal,
    errorMessages: PROJECT_ERROR_MESSAGES,
    fallbackErrorMessage: '서버 프로젝트를 불러오지 못했습니다.',
  })
  return mapBackendProject(project)
}

export async function createProject(project, signal) {
  const createdProject = await requestJson('/api/projects', {
    method: 'POST',
    body: createProjectPayload(project),
    signal,
    errorMessages: PROJECT_ERROR_MESSAGES,
    fallbackErrorMessage: '프로젝트를 서버에 저장하지 못했습니다.',
  })
  return mapBackendProject(createdProject)
}

export async function updateProject(projectId, changes, signal) {
  const updatedProject = await requestJson(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: updateProjectPayload(changes),
    signal,
    errorMessages: PROJECT_ERROR_MESSAGES,
    fallbackErrorMessage: '프로젝트를 서버에서 수정하지 못했습니다.',
  })
  return mapBackendProject(updatedProject)
}

export async function deleteProject(projectId, signal) {
  await requestJson(`/api/projects/${projectId}`, {
    method: 'DELETE',
    signal,
    errorMessages: PROJECT_ERROR_MESSAGES,
    fallbackErrorMessage: '프로젝트를 서버에서 삭제하지 못했습니다.',
  })
}
