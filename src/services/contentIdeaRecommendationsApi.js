import { ApiError, requestJson } from './apiClient.js'
import { mapContentIdea } from './contentIdeasApi.js'

const ERROR_MESSAGES = {
  llm_not_configured: 'AI 추천 설정이 완료되지 않았습니다. 관리자에게 설정을 요청해 주세요.',
  llm_live_calls_disabled: '현재 AI 추천 실호출이 비활성화되어 있습니다.',
  llm_authentication_failed: 'AI 추천 제공자 인증 또는 모델 설정을 확인해 주세요.',
  llm_rate_limited: 'AI 추천 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  llm_timeout: 'AI 추천 생성 시간이 초과되었습니다. 다시 시도해 주세요.',
  llm_provider_unavailable: 'AI 추천 서비스를 일시적으로 사용할 수 없습니다.',
  llm_invalid_response: 'AI 추천 결과를 처리하지 못했습니다. 다시 생성해 주세요.',
  llm_no_valid_recommendations: '사용할 수 있는 추천 결과가 없습니다. 조건을 바꿔 다시 시도해 주세요.',
  recommendation_token_invalid: '추천 저장 정보가 올바르지 않아 저장할 수 없습니다.',
  recommendation_token_expired: '추천 저장 시간이 만료되었습니다. 새 추천을 생성해 주세요.',
  recommendation_token_user_mismatch: '다른 사용자의 추천 결과는 저장할 수 없습니다.',
  recommendation_token_reused: '이미 저장된 추천 결과입니다.',
  recommendation_rate_limited: '추천 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  recommendation_in_progress: '이미 AI 추천 요청을 처리하고 있습니다.',
  recommendation_refused: '이 조건으로는 추천을 생성할 수 없습니다. 입력 내용을 조정해 주세요.',
}

function messageFromResponse(data, fallback) {
  const code = data?.detail?.code
  return ERROR_MESSAGES[code] ?? data?.detail?.message ?? fallback
}

const RECOMMENDATION_ERROR_MESSAGES = {
  400: (data) => messageFromResponse(data, '추천 저장 정보를 확인해 주세요.'),
  409: (data) => messageFromResponse(data, '이미 처리 중이거나 저장된 추천입니다.'),
  410: (data) => messageFromResponse(data, '추천 저장 시간이 만료되었습니다.'),
  422: (data) => messageFromResponse(data, '추천 조건을 확인해 주세요.'),
  429: (data) => messageFromResponse(data, '추천 요청이 많습니다. 잠시 후 다시 시도해 주세요.'),
  502: (data) => messageFromResponse(data, 'AI 추천 서비스를 일시적으로 사용할 수 없습니다.'),
  503: (data) => messageFromResponse(data, 'AI 추천 설정을 확인해 주세요.'),
  504: (data) => messageFromResponse(data, 'AI 추천 생성 시간이 초과되었습니다.'),
}

function normalizeOptionalText(value) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function normalizeKeywords(value) {
  const keywords = Array.isArray(value) ? value : String(value ?? '').split(',')
  const seen = new Set()
  return keywords.reduce((result, keyword) => {
    const normalized = String(keyword).trim()
    const key = normalized.toLocaleLowerCase()
    if (normalized && !seen.has(key)) {
      seen.add(key)
      result.push(normalized)
    }
    return result
  }, [])
}

export function composeRecommendationReferenceContext(referenceContext, genreLabel) {
  const context = String(referenceContext ?? '').trim()
  const genre = String(genreLabel ?? '').trim()
  if (!genre) return context
  const genreContext = `선택한 콘텐츠 장르: ${genre}`
  return context ? `${genreContext}\n\n사용자 추가 설명:\n${context}` : genreContext
}

export function createRecommendationPayload(values) {
  return {
    topic: String(values.topic ?? '').trim(),
    platform: values.platform || null,
    target_audience: normalizeOptionalText(values.targetAudience),
    content_format: normalizeOptionalText(values.contentFormat),
    tone: values.tone || 'informative',
    keywords: normalizeKeywords(values.keywords),
    reference_context: normalizeOptionalText(
      composeRecommendationReferenceContext(values.referenceContext, values.genreLabel),
    ),
    recommendation_count: Number(values.recommendationCount),
  }
}

export function mapContentIdeaRecommendation(item = {}) {
  return {
    clientKey: item.client_key,
    title: item.title ?? '',
    description: item.description ?? '',
    platform: item.platform,
    tags: Array.isArray(item.tags) ? item.tags : [],
    targetAudience: item.target_audience ?? '',
    contentFormat: item.content_format ?? '',
    reason: item.reason ?? '',
    source: item.source,
    duplicateWarning: Boolean(item.duplicate_warning),
    saveToken: item.save_token,
  }
}

export function mapRecommendationResponse(response = {}) {
  return {
    requestId: response.request_id ?? null,
    requestedCount: Number(response.requested_count) || 0,
    generatedCount: Number(response.generated_count) || 0,
    discardedCount: Number(response.discarded_count) || 0,
    promptVersion: response.prompt_version ?? '',
    recommendations: Array.isArray(response.recommendations)
      ? response.recommendations.map(mapContentIdeaRecommendation)
      : [],
  }
}

export function normalizeRecommendationError(error) {
  if (error?.name === 'AbortError') return null
  if (error instanceof ApiError) {
    const code = error.code || (error.status === 422 ? 'recommendation_validation_failed' : null)
    return {
      code,
      message: ERROR_MESSAGES[code] ?? error.message,
      retryable: error.retryable,
      requestId: error.requestId,
      status: error.status,
      isValidation: error.status === 422 && !error.code,
      isPermanentTokenError: [
        'recommendation_token_invalid',
        'recommendation_token_expired',
        'recommendation_token_user_mismatch',
        'recommendation_token_reused',
      ].includes(code),
    }
  }
  return {
    code: 'backend_unreachable',
    message: error?.message || '백엔드 서버에 연결할 수 없습니다.',
    retryable: true,
    requestId: null,
    status: null,
    isValidation: false,
    isPermanentTokenError: false,
  }
}

export async function recommendContentIdeas(values, signal) {
  const response = await requestJson('/api/content-ideas/recommendations', {
    method: 'POST',
    body: createRecommendationPayload(values),
    signal,
    errorMessages: RECOMMENDATION_ERROR_MESSAGES,
    fallbackErrorMessage: 'AI 콘텐츠 소재를 추천받지 못했습니다.',
  })
  return mapRecommendationResponse(response)
}

export async function saveContentIdeaRecommendation(saveToken, signal) {
  const idea = await requestJson('/api/content-ideas/recommendations/save', {
    method: 'POST',
    body: { save_token: saveToken },
    signal,
    errorMessages: RECOMMENDATION_ERROR_MESSAGES,
    fallbackErrorMessage: 'AI 추천 소재를 저장하지 못했습니다.',
  })
  return mapContentIdea(idea)
}
