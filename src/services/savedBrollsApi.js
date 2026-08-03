import { requestJson } from './apiClient.js'

const SAVE_ERROR_MESSAGES = {
  400: '요청 내용을 확인해 주세요.',
  404: '프로젝트 또는 저장 자료를 찾을 수 없습니다.',
  409: '이미 저장된 자료입니다.',
  422: '저장할 자료 정보를 확인해 주세요.',
}

const MUTATION_ERROR_MESSAGES = {
  400: '메모 내용을 확인해 주세요.',
  404: '이미 삭제되었거나 저장 자료를 찾을 수 없습니다.',
  422: '메모 내용을 확인해 주세요.',
}

function assertBackendProjectId(projectId) {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error('이 프로젝트는 아직 서버와 동기화되지 않았습니다.')
  }
}

function assertBackendRecordId(recordId) {
  if (!Number.isInteger(recordId) || recordId <= 0) {
    throw new Error('저장 자료를 찾을 수 없습니다.')
  }
}

function mapSavedBroll(item) {
  return {
    id: item.id,
    projectId: item.project_id,
    provider: item.provider,
    externalId: item.external_id,
    type: 'Video',
    title: item.title ?? 'Video asset',
    url: item.url,
    originalUrl: item.url,
    previewUrl: item.preview_url,
    thumbnailUrl: item.thumbnail_url,
    creatorName: item.creator_name,
    durationSeconds: item.duration_seconds,
    width: item.width,
    height: item.height,
    note: item.note,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }
}

function createBrollPayload(item) {
  return {
    external_id: item.externalId ?? item.external_id ?? item.id,
    title: item.title ?? null,
    url: item.url ?? item.originalUrl,
    preview_url: item.previewUrl ?? item.preview_url ?? null,
    thumbnail_url: item.thumbnailUrl ?? item.thumbnail_url ?? null,
    creator_name: item.creatorName ?? item.creator_name ?? null,
    duration_seconds:
      item.durationSeconds ?? item.duration_seconds ?? item.duration ?? null,
    width: item.width ?? null,
    height: item.height ?? null,
    note: item.note ?? null,
  }
}

export async function getSavedBrolls(projectId, signal) {
  assertBackendProjectId(projectId)
  const items = await requestJson(`/api/projects/${projectId}/brolls`, {
    signal,
    errorMessages: SAVE_ERROR_MESSAGES,
    fallbackErrorMessage: '저장된 B-roll을 불러오는 중 오류가 발생했습니다.',
  })
  return items.map(mapSavedBroll)
}

export async function createSavedBroll(projectId, item, signal) {
  assertBackendProjectId(projectId)
  const savedItem = await requestJson(`/api/projects/${projectId}/brolls`, {
    method: 'POST',
    body: createBrollPayload(item),
    signal,
    errorMessages: SAVE_ERROR_MESSAGES,
    fallbackErrorMessage: '자료를 저장하는 중 오류가 발생했습니다.',
  })
  return mapSavedBroll(savedItem)
}

export async function updateSavedBrollNote(brollId, note, signal) {
  assertBackendRecordId(brollId)
  const savedItem = await requestJson(`/api/brolls/${brollId}`, {
    method: 'PATCH',
    body: { note },
    signal,
    errorMessages: MUTATION_ERROR_MESSAGES,
    fallbackErrorMessage: '메모를 저장하지 못했습니다.',
  })
  return mapSavedBroll(savedItem)
}

export async function deleteSavedBroll(brollId, signal) {
  assertBackendRecordId(brollId)
  await requestJson(`/api/brolls/${brollId}`, {
    method: 'DELETE',
    signal,
    errorMessages: MUTATION_ERROR_MESSAGES,
    fallbackErrorMessage: '자료를 삭제하지 못했습니다.',
  })
}
