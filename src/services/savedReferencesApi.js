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

function mapSavedReference(item) {
  return {
    id: item.id,
    projectId: item.project_id,
    provider: item.provider,
    externalId: item.external_id,
    title: item.title,
    url: item.url,
    videoUrl: item.url,
    thumbnailUrl: item.thumbnail_url,
    channelTitle: item.channel_title,
    publishedAt: item.published_at,
    note: item.note,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }
}

function createReferencePayload(item) {
  return {
    external_id: item.externalId ?? item.external_id ?? item.id,
    title: item.title,
    url: item.url ?? item.videoUrl,
    thumbnail_url: item.thumbnailUrl ?? item.thumbnail_url ?? null,
    channel_title: item.channelTitle ?? item.channel_title ?? null,
    published_at: item.publishedAt ?? item.published_at ?? null,
    note: item.note ?? null,
  }
}

export async function getSavedReferences(projectId, signal) {
  assertBackendProjectId(projectId)
  const items = await requestJson(`/api/projects/${projectId}/references`, {
    signal,
    errorMessages: SAVE_ERROR_MESSAGES,
    fallbackErrorMessage: '저장된 레퍼런스를 불러오는 중 오류가 발생했습니다.',
  })
  return items.map(mapSavedReference)
}

export async function createSavedReference(projectId, item, signal) {
  assertBackendProjectId(projectId)
  const savedItem = await requestJson(
    `/api/projects/${projectId}/references`,
    {
      method: 'POST',
      body: createReferencePayload(item),
      signal,
      errorMessages: SAVE_ERROR_MESSAGES,
      fallbackErrorMessage: '자료를 저장하는 중 오류가 발생했습니다.',
    },
  )
  return mapSavedReference(savedItem)
}

export async function updateSavedReferenceNote(referenceId, note, signal) {
  assertBackendRecordId(referenceId)
  const savedItem = await requestJson(`/api/references/${referenceId}`, {
    method: 'PATCH',
    body: { note },
    signal,
    errorMessages: MUTATION_ERROR_MESSAGES,
    fallbackErrorMessage: '메모를 저장하지 못했습니다.',
  })
  return mapSavedReference(savedItem)
}

export async function deleteSavedReference(referenceId, signal) {
  assertBackendRecordId(referenceId)
  await requestJson(`/api/references/${referenceId}`, {
    method: 'DELETE',
    signal,
    errorMessages: MUTATION_ERROR_MESSAGES,
    fallbackErrorMessage: '자료를 삭제하지 못했습니다.',
  })
}
