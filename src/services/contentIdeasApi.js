import { requestJson } from './apiClient.js'
import { CONTENT_IDEA_LIMITS } from '../constants/contentIdeas.js'
import { mapBackendProject } from './projectsApi.js'

const CONTENT_IDEA_ERROR_MESSAGES = {
  400: '수정할 콘텐츠 소재 내용이 없습니다.',
  404: '콘텐츠 소재를 찾을 수 없습니다.',
  422: '콘텐츠 소재 정보를 확인해 주세요.',
}

const CONVERSION_ERROR_MESSAGES = {
  ...CONTENT_IDEA_ERROR_MESSAGES,
  409: (data) =>
    typeof data?.detail === 'string'
      ? data.detail
      : '이미 프로젝트로 전환됐거나 전환할 수 없는 소재입니다.',
  422: '프로젝트 정보를 확인해 주세요.',
}

const writableFields = {
  title: 'title',
  description: 'description',
  platform: 'platform',
  status: 'status',
  priority: 'priority',
  tags: 'tags',
  targetAudience: 'target_audience',
  contentFormat: 'content_format',
}

function assertIdeaId(ideaId) {
  if (!Number.isInteger(ideaId) || ideaId <= 0) {
    throw new TypeError('콘텐츠 소재 ID는 양의 정수여야 합니다.')
  }
}

function normalizeOptionalText(value) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    throw new TypeError('태그 형식을 확인해 주세요.')
  }
  const normalized = [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))]
  if (normalized.length > CONTENT_IDEA_LIMITS.tags) {
    throw new Error('태그는 최대 20개까지 입력할 수 있습니다.')
  }
  if (normalized.some((tag) => tag.length > CONTENT_IDEA_LIMITS.tag)) {
    throw new Error('태그는 각각 50자 이하여야 합니다.')
  }
  return normalized
}

function normalizeField(key, value) {
  if (key === 'title') return String(value ?? '').trim()
  if (key === 'description' || key === 'targetAudience' || key === 'contentFormat') {
    return normalizeOptionalText(value)
  }
  if (key === 'tags') return normalizeTags(value)
  return value
}

export function createContentIdeaPayload(data) {
  return Object.fromEntries(
    Object.entries(writableFields).map(([frontendKey, backendKey]) => [
      backendKey,
      normalizeField(frontendKey, data[frontendKey]),
    ]),
  )
}

export function updateContentIdeaPayload(changes) {
  const payload = {}
  Object.entries(writableFields).forEach(([frontendKey, backendKey]) => {
    if (Object.prototype.hasOwnProperty.call(changes, frontendKey)) {
      payload[backendKey] = normalizeField(frontendKey, changes[frontendKey])
    }
  })
  if (Object.keys(payload).length === 0) {
    throw new Error('수정할 콘텐츠 소재 내용이 없습니다.')
  }
  return payload
}

export function mapContentIdea(idea) {
  return {
    id: idea.id,
    userId: idea.user_id,
    title: idea.title,
    description: idea.description ?? '',
    platform: idea.platform,
    status: idea.status,
    priority: idea.priority,
    tags: Array.isArray(idea.tags) ? idea.tags : [],
    targetAudience: idea.target_audience ?? '',
    contentFormat: idea.content_format ?? '',
    source: idea.source,
    convertedProjectId: idea.converted_project_id,
    createdAt: idea.created_at,
    updatedAt: idea.updated_at,
  }
}

const emptyCounts = (keys) => Object.fromEntries(keys.map((key) => [key, 0]))

export function mapContentIdeaSummary(summary = {}) {
  return {
    total: Number(summary.total) || 0,
    byStatus: { ...emptyCounts(['idea', 'researching', 'ready', 'converted', 'archived']), ...summary.by_status },
    byPriority: { ...emptyCounts(['low', 'medium', 'high']), ...summary.by_priority },
    byPlatform: { ...emptyCounts(['youtube', 'shorts', 'instagram', 'tiktok', 'blog', 'other']), ...summary.by_platform },
    bySource: { ...emptyCounts(['manual', 'ai']), ...summary.by_source },
    convertedCount: Number(summary.converted_count) || 0,
    readyCount: Number(summary.ready_count) || 0,
    activeCount: Number(summary.active_count) || 0,
    withReferenceCount: Number(summary.with_reference_count) || 0,
    withBrollCount: Number(summary.with_broll_count) || 0,
    withAnyMediaCount: Number(summary.with_any_media_count) || 0,
    latestUpdatedAt: summary.latest_updated_at ?? null,
  }
}

export async function getContentIdeas(filters = {}, signal) {
  const params = {}
  Object.entries(filters).forEach(([key, value]) => {
    const normalized = typeof value === 'string' ? value.trim() : value
    if (normalized !== '' && normalized !== null && normalized !== undefined) {
      params[key] = normalized
    }
  })
  const ideas = await requestJson('/api/content-ideas', {
    params,
    signal,
    errorMessages: CONTENT_IDEA_ERROR_MESSAGES,
    fallbackErrorMessage: '콘텐츠 소재를 불러오지 못했습니다.',
  })
  return ideas.map(mapContentIdea)
}

export async function getContentIdeaSummary(signal) {
  const summary = await requestJson('/api/content-ideas/summary', {
    signal,
    errorMessages: CONTENT_IDEA_ERROR_MESSAGES,
    fallbackErrorMessage: '콘텐츠 소재 통계를 불러오지 못했습니다.',
  })
  return mapContentIdeaSummary(summary)
}

export async function getContentIdea(ideaId, signal) {
  assertIdeaId(ideaId)
  const idea = await requestJson(`/api/content-ideas/${ideaId}`, {
    signal,
    errorMessages: CONTENT_IDEA_ERROR_MESSAGES,
    fallbackErrorMessage: '콘텐츠 소재를 불러오지 못했습니다.',
  })
  return mapContentIdea(idea)
}

export async function createContentIdea(data, signal) {
  const idea = await requestJson('/api/content-ideas', {
    method: 'POST', body: createContentIdeaPayload(data), signal,
    errorMessages: CONTENT_IDEA_ERROR_MESSAGES,
    fallbackErrorMessage: '콘텐츠 소재를 등록하지 못했습니다.',
  })
  return mapContentIdea(idea)
}

export async function updateContentIdea(ideaId, changes, signal) {
  assertIdeaId(ideaId)
  const idea = await requestJson(`/api/content-ideas/${ideaId}`, {
    method: 'PATCH', body: updateContentIdeaPayload(changes), signal,
    errorMessages: CONTENT_IDEA_ERROR_MESSAGES,
    fallbackErrorMessage: '콘텐츠 소재를 수정하지 못했습니다.',
  })
  return mapContentIdea(idea)
}

export async function deleteContentIdea(ideaId, signal) {
  assertIdeaId(ideaId)
  await requestJson(`/api/content-ideas/${ideaId}`, {
    method: 'DELETE', signal,
    errorMessages: CONTENT_IDEA_ERROR_MESSAGES,
    fallbackErrorMessage: '콘텐츠 소재를 삭제하지 못했습니다.',
  })
}

export async function convertContentIdeaToProject(ideaId, data, signal) {
  assertIdeaId(ideaId)
  const title = String(data.title ?? '').trim()
  const description = String(data.description ?? '').trim()
  const dueDate = String(data.dueDate ?? '').trim()
  const result = await requestJson(
    `/api/content-ideas/${ideaId}/convert-to-project`,
    {
      method: 'POST',
      body: {
        title,
        description: description || null,
        status: data.status || 'planning',
        due_date: dueDate || null,
      },
      signal,
      errorMessages: CONVERSION_ERROR_MESSAGES,
      fallbackErrorMessage: '콘텐츠 소재를 프로젝트로 전환하지 못했습니다.',
    },
  )
  return {
    project: {
      ...mapBackendProject(result.project),
      id: result.project.id,
    },
    contentIdea: mapContentIdea(result.content_idea),
  }
}
