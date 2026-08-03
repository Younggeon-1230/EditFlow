const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, '')

const DEFAULT_ERROR_MESSAGES = {
  422: '검색 조건을 확인해 주세요.',
  429: '외부 검색 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  502: '외부 검색 서비스에 일시적인 문제가 발생했습니다.',
  503: '외부 API 설정을 확인해 주세요.',
  504: '검색 요청 시간이 초과되었습니다.',
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function requestJson(
  path,
  {
    method = 'GET',
    params,
    body,
    signal,
    errorMessages = DEFAULT_ERROR_MESSAGES,
    fallbackErrorMessage = '요청을 처리하는 중 오류가 발생했습니다.',
  } = {},
) {
  const url = new URL(`${API_BASE_URL}${path}`)

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  let response

  try {
    response = await fetch(url, {
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      method,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error
    }

    throw new Error('백엔드 서버에 연결할 수 없습니다.')
  }

  if (response.status === 204) {
    return null
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new ApiError(
      errorMessages[response.status] ?? fallbackErrorMessage,
      response.status,
    )
  }

  return data
}

export function getJson(path, options) {
  return requestJson(path, options)
}
