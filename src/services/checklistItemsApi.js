import { ApiError, requestJson } from './apiClient.js'

const CHECKLIST_ERROR_MESSAGES = {
  400: '수정할 체크리스트 내용이 없습니다.',
  404: '프로젝트 또는 체크리스트 항목을 찾을 수 없습니다.',
  422: '체크리스트 정보를 확인해 주세요.',
}

function assertPositiveInteger(value, message) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message)
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function sortChecklistItems(items) {
  return [...items].sort(
    (left, right) =>
      left.position - right.position ||
      left.backendChecklistItemId - right.backendChecklistItemId,
  )
}

export function mapChecklistItem(item) {
  return {
    id: `server-checklist-${item.id}`,
    backendChecklistItemId: item.id,
    backendProjectId: item.project_id,
    text: item.title,
    title: item.title,
    description: item.description,
    done: item.is_completed,
    isCompleted: item.is_completed,
    position: item.position,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    syncStatus: 'synced',
  }
}

export function createChecklistItemPayload(item, { includePosition = false } = {}) {
  const title = String(item.title ?? item.text ?? '').trim()
  const payload = {
    title,
    description: item.description ?? null,
    is_completed: Boolean(item.isCompleted ?? item.done ?? false),
  }

  if (includePosition && Number.isInteger(item.position) && item.position >= 0) {
    payload.position = item.position
  }

  return payload
}

export function createChecklistUpdatePayload(changes) {
  const payload = {}

  if (hasOwn(changes, 'title') || hasOwn(changes, 'text')) {
    payload.title = String(changes.title ?? changes.text ?? '').trim()
  }
  if (hasOwn(changes, 'description')) {
    payload.description = changes.description
  }
  if (hasOwn(changes, 'isCompleted') || hasOwn(changes, 'done')) {
    payload.is_completed = Boolean(changes.isCompleted ?? changes.done)
  }
  if (hasOwn(changes, 'position')) {
    payload.position = changes.position
  }

  if (Object.keys(payload).length === 0) {
    throw new ApiError('수정할 체크리스트 내용이 없습니다.', 400)
  }

  return payload
}

export async function getChecklistItems(backendProjectId, signal) {
  assertPositiveInteger(
    backendProjectId,
    '이 프로젝트는 아직 서버와 동기화되지 않았습니다.',
  )
  const items = await requestJson(
    `/api/projects/${backendProjectId}/checklist-items`,
    {
      signal,
      errorMessages: CHECKLIST_ERROR_MESSAGES,
      fallbackErrorMessage: '체크리스트 처리 중 오류가 발생했습니다.',
    },
  )
  return sortChecklistItems((items ?? []).map(mapChecklistItem))
}

export async function createChecklistItem(
  backendProjectId,
  item,
  signal,
  options,
) {
  assertPositiveInteger(
    backendProjectId,
    '이 프로젝트는 아직 서버와 동기화되지 않았습니다.',
  )
  const created = await requestJson(
    `/api/projects/${backendProjectId}/checklist-items`,
    {
      method: 'POST',
      body: createChecklistItemPayload(item, options),
      signal,
      errorMessages: CHECKLIST_ERROR_MESSAGES,
      fallbackErrorMessage: '체크리스트 처리 중 오류가 발생했습니다.',
    },
  )
  return mapChecklistItem(created)
}

export async function updateChecklistItem(itemId, changes, signal) {
  assertPositiveInteger(
    itemId,
    '서버 체크리스트 항목 ID를 확인해 주세요.',
  )
  const updated = await requestJson(`/api/checklist-items/${itemId}`, {
    method: 'PATCH',
    body: createChecklistUpdatePayload(changes),
    signal,
    errorMessages: CHECKLIST_ERROR_MESSAGES,
    fallbackErrorMessage: '체크리스트 처리 중 오류가 발생했습니다.',
  })
  return mapChecklistItem(updated)
}

export async function deleteChecklistItem(itemId, signal) {
  assertPositiveInteger(
    itemId,
    '서버 체크리스트 항목 ID를 확인해 주세요.',
  )
  await requestJson(`/api/checklist-items/${itemId}`, {
    method: 'DELETE',
    signal,
    errorMessages: CHECKLIST_ERROR_MESSAGES,
    fallbackErrorMessage: '체크리스트 처리 중 오류가 발생했습니다.',
  })
}

