import { ApiError, requestJson } from './apiClient.js'

const MEMO_ERROR_MESSAGES = {
  400: '수정할 메모 내용이 없습니다.',
  404: '프로젝트 또는 메모를 찾을 수 없습니다.',
  422: '메모 내용을 확인해 주세요.',
}

function assertPositiveInteger(value, message) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message)
  }
}

function normalizeContent(content) {
  const normalized = String(content ?? '').trim()
  if (!normalized) {
    throw new Error('메모 내용을 입력해 주세요.')
  }
  if (normalized.length > 5000) {
    throw new Error('메모는 5,000자 이하로 입력해 주세요.')
  }
  return normalized
}

function mapProjectMemo(memo) {
  return {
    id: memo.id,
    backendProjectId: memo.project_id,
    content: memo.content,
    position: memo.position,
    createdAt: memo.created_at,
    updatedAt: memo.updated_at,
  }
}

function sortProjectMemos(items) {
  return [...items].sort(
    (left, right) => left.position - right.position || left.id - right.id,
  )
}

export async function getProjectMemos(backendProjectId, signal) {
  assertPositiveInteger(
    backendProjectId,
    '이 프로젝트는 아직 서버와 동기화되지 않았습니다.',
  )
  const items = await requestJson(
    `/api/projects/${backendProjectId}/memos`,
    {
      signal,
      errorMessages: MEMO_ERROR_MESSAGES,
      fallbackErrorMessage: '프로젝트 메모를 불러오지 못했습니다.',
    },
  )
  return sortProjectMemos((items ?? []).map(mapProjectMemo))
}

export async function createProjectMemo(
  backendProjectId,
  content,
  signal,
  position,
) {
  assertPositiveInteger(
    backendProjectId,
    '이 프로젝트는 아직 서버와 동기화되지 않았습니다.',
  )
  const body = { content: normalizeContent(content) }
  if (Number.isInteger(position) && position >= 0) {
    body.position = position
  }
  const memo = await requestJson(
    `/api/projects/${backendProjectId}/memos`,
    {
      method: 'POST',
      body,
      signal,
      errorMessages: MEMO_ERROR_MESSAGES,
      fallbackErrorMessage: '메모를 추가하지 못했습니다.',
    },
  )
  return mapProjectMemo(memo)
}

export async function updateProjectMemo(memoId, changes, signal) {
  assertPositiveInteger(memoId, '프로젝트 메모 ID를 확인해 주세요.')
  const body = {}
  if (Object.prototype.hasOwnProperty.call(changes, 'content')) {
    body.content = normalizeContent(changes.content)
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'position')) {
    if (!Number.isInteger(changes.position) || changes.position < 0) {
      throw new Error('메모 순서를 확인해 주세요.')
    }
    body.position = changes.position
  }
  if (Object.keys(body).length === 0) {
    throw new ApiError('수정할 메모 내용이 없습니다.', 400)
  }
  const memo = await requestJson(`/api/project-memos/${memoId}`, {
    method: 'PATCH',
    body,
    signal,
    errorMessages: MEMO_ERROR_MESSAGES,
    fallbackErrorMessage: '메모를 수정하지 못했습니다.',
  })
  return mapProjectMemo(memo)
}

export async function deleteProjectMemo(memoId, signal) {
  assertPositiveInteger(memoId, '프로젝트 메모 ID를 확인해 주세요.')
  await requestJson(`/api/project-memos/${memoId}`, {
    method: 'DELETE',
    signal,
    errorMessages: MEMO_ERROR_MESSAGES,
    fallbackErrorMessage: '메모를 삭제하지 못했습니다.',
  })
}
