import { requestJson } from './apiClient.js'

const ERRORS = {
  400: '요청 내용을 확인해 주세요.',
  404: '콘텐츠 소재 또는 저장된 B-roll을 찾을 수 없습니다.',
  409: '이미 이 콘텐츠 소재에 저장된 B-roll입니다.',
  422: '저장할 B-roll 정보를 확인해 주세요.',
}

function assertId(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${label} ID는 양의 정수여야 합니다.`)
}

export function mapContentIdeaBroll(item) {
  return {
    id: item.id,
    contentIdeaId: item.content_idea_id,
    provider: item.provider,
    externalId: item.external_id,
    type: 'Video',
    title: item.title ?? 'B-roll 영상',
    url: item.url,
    originalUrl: item.url,
    previewUrl: item.preview_url,
    thumbnailUrl: item.thumbnail_url,
    creatorName: item.creator_name,
    durationSeconds: item.duration_seconds,
    duration: item.duration_seconds,
    width: item.width,
    height: item.height,
    note: item.note,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }
}

export function createContentIdeaBrollPayload(item) {
  return {
    external_id: item.externalId ?? item.external_id ?? item.id,
    title: item.title ?? null,
    url: item.url ?? item.originalUrl,
    preview_url: item.previewUrl ?? item.preview_url ?? null,
    thumbnail_url: item.thumbnailUrl ?? item.thumbnail_url ?? null,
    creator_name: item.creatorName ?? item.creator_name ?? null,
    duration_seconds: item.durationSeconds ?? item.duration_seconds ?? item.duration ?? null,
    width: item.width ?? null,
    height: item.height ?? null,
    note: item.note ?? null,
  }
}

export async function getContentIdeaBrolls(ideaId, signal) {
  assertId(ideaId, '콘텐츠 소재')
  const items = await requestJson(`/api/content-ideas/${ideaId}/brolls`, { signal, errorMessages: ERRORS, fallbackErrorMessage: '저장된 B-roll을 불러오지 못했습니다.' })
  return items.map(mapContentIdeaBroll)
}

export async function createContentIdeaBroll(ideaId, item, signal) {
  assertId(ideaId, '콘텐츠 소재')
  const saved = await requestJson(`/api/content-ideas/${ideaId}/brolls`, { method: 'POST', body: createContentIdeaBrollPayload(item), signal, errorMessages: ERRORS, fallbackErrorMessage: 'B-roll을 콘텐츠 소재에 저장하지 못했습니다.' })
  return mapContentIdeaBroll(saved)
}

export async function updateContentIdeaBroll(brollId, changes, signal) {
  assertId(brollId, 'B-roll')
  if (!Object.prototype.hasOwnProperty.call(changes, 'note') || Object.keys(changes).length !== 1) throw new Error('수정할 메모 내용이 없습니다.')
  const note = String(changes.note ?? '').trim() || null
  const saved = await requestJson(`/api/content-idea-brolls/${brollId}`, { method: 'PATCH', body: { note }, signal, errorMessages: ERRORS, fallbackErrorMessage: '메모를 수정하지 못했습니다.' })
  return mapContentIdeaBroll(saved)
}

export async function deleteContentIdeaBroll(brollId, signal) {
  assertId(brollId, 'B-roll')
  await requestJson(`/api/content-idea-brolls/${brollId}`, { method: 'DELETE', signal, errorMessages: ERRORS, fallbackErrorMessage: '저장 자료를 삭제하지 못했습니다.' })
}
