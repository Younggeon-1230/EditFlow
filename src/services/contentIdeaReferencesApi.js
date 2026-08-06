import { requestJson } from './apiClient.js'

const ERRORS = {
  400: '요청 내용을 확인해 주세요.',
  404: '콘텐츠 소재 또는 저장된 레퍼런스를 찾을 수 없습니다.',
  409: '이미 이 콘텐츠 소재에 저장된 레퍼런스입니다.',
  422: '저장할 레퍼런스 정보를 확인해 주세요.',
}

function assertId(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${label} ID는 양의 정수여야 합니다.`)
}

export function mapContentIdeaReference(item) {
  return {
    id: item.id,
    contentIdeaId: item.content_idea_id,
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

export function createContentIdeaReferencePayload(item) {
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

export async function getContentIdeaReferences(ideaId, signal) {
  assertId(ideaId, '콘텐츠 소재')
  const items = await requestJson(`/api/content-ideas/${ideaId}/references`, { signal, errorMessages: ERRORS, fallbackErrorMessage: '저장된 레퍼런스를 불러오지 못했습니다.' })
  return items.map(mapContentIdeaReference)
}

export async function createContentIdeaReference(ideaId, item, signal) {
  assertId(ideaId, '콘텐츠 소재')
  const saved = await requestJson(`/api/content-ideas/${ideaId}/references`, { method: 'POST', body: createContentIdeaReferencePayload(item), signal, errorMessages: ERRORS, fallbackErrorMessage: '레퍼런스를 콘텐츠 소재에 저장하지 못했습니다.' })
  return mapContentIdeaReference(saved)
}

export async function updateContentIdeaReference(referenceId, changes, signal) {
  assertId(referenceId, '레퍼런스')
  if (!Object.prototype.hasOwnProperty.call(changes, 'note') || Object.keys(changes).length !== 1) throw new Error('수정할 메모 내용이 없습니다.')
  const note = String(changes.note ?? '').trim() || null
  const saved = await requestJson(`/api/content-idea-references/${referenceId}`, { method: 'PATCH', body: { note }, signal, errorMessages: ERRORS, fallbackErrorMessage: '메모를 수정하지 못했습니다.' })
  return mapContentIdeaReference(saved)
}

export async function deleteContentIdeaReference(referenceId, signal) {
  assertId(referenceId, '레퍼런스')
  await requestJson(`/api/content-idea-references/${referenceId}`, { method: 'DELETE', signal, errorMessages: ERRORS, fallbackErrorMessage: '저장 자료를 삭제하지 못했습니다.' })
}
