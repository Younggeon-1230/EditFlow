import { requestJson } from './apiClient.js'
import { mapContentIdea } from './contentIdeasApi.js'

const RELATION_ERROR_MESSAGES = {
  404: '서버에서 프로젝트를 찾을 수 없습니다.',
}

export async function getProjectSourceContentIdea(projectId, signal) {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new TypeError('서버 프로젝트 ID는 양의 정수여야 합니다.')
  }
  const idea = await requestJson(
    `/api/projects/${projectId}/source-content-idea`,
    {
      signal,
      errorMessages: RELATION_ERROR_MESSAGES,
      fallbackErrorMessage: '원본 콘텐츠 소재 관계를 불러오지 못했습니다.',
    },
  )
  return idea ? mapContentIdea(idea) : null
}
