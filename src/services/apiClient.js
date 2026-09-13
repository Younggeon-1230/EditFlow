const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const CSRF_COOKIE_NAME = 'editflow_csrf'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

let csrfBootstrapPromise = null
const unauthorizedListeners = new Set()

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
  constructor(message, status, metadata = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = metadata.code ?? null
    this.retryable = Boolean(metadata.retryable)
    this.requestId = metadata.requestId ?? null
    this.details = metadata.details ?? null
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') {
    return null
  }

  const prefix = `${encodeURIComponent(name)}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
  if (!cookie) {
    return null
  }

  try {
    return decodeURIComponent(cookie.slice(prefix.length))
  } catch {
    return null
  }
}

async function ensureCsrfToken(signal, { force = false } = {}) {
  const existingToken = readCookie(CSRF_COOKIE_NAME)
  if (existingToken && !force) {
    return existingToken
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch(`${API_BASE_URL}/api/auth/csrf`, {
      credentials: 'include',
      method: 'GET',
    }).then((response) => {
      if (!response.ok) {
        throw new ApiError(
          '요청 보안 정보를 준비하지 못했습니다.',
          response.status,
        )
      }
      const token = readCookie(CSRF_COOKIE_NAME)
      if (!token) {
        throw new Error('요청 보안 쿠키를 확인할 수 없습니다.')
      }
      return token
    }).finally(() => {
      csrfBootstrapPromise = null
    })
  }

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  return csrfBootstrapPromise
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => listener())
}

export function subscribeToUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
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
    skipAuthInvalidation = false,
  } = {},
) {
  const url = new URL(`${API_BASE_URL}${path}`)
  const normalizedMethod = method.toUpperCase()

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  const performRequest = async ({ refreshCsrf = false } = {}) => {
    const headers = body === undefined ? {} : { 'Content-Type': 'application/json' }
    if (UNSAFE_METHODS.has(normalizedMethod)) {
      headers[CSRF_HEADER_NAME] = await ensureCsrfToken(signal, {
        force: refreshCsrf,
      })
    }
    return fetch(url, {
      credentials: 'include',
      headers: Object.keys(headers).length === 0 ? undefined : headers,
      method: normalizedMethod,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  let response

  try {
    response = await performRequest()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error
    }
    if (error instanceof ApiError) {
      throw error
    }

    throw new Error('백엔드 서버에 연결할 수 없습니다.')
  }

  let data = null
  if (response.status !== 204) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  }

  const isCsrfFailure = response.status === 403
    && ['csrf_required', 'csrf_invalid'].includes(data?.detail?.code)
  if (isCsrfFailure && UNSAFE_METHODS.has(normalizedMethod)) {
    try {
      response = await performRequest({ refreshCsrf: true })
      data = null
      if (response.status !== 204) {
        try {
          data = await response.json()
        } catch {
          data = null
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof ApiError) {
        throw error
      }
      throw new Error('백엔드 서버에 연결할 수 없습니다.')
    }
  }

  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    const configuredMessage = errorMessages[response.status]
    const detail = data?.detail
    const metadata = typeof detail === 'object' && !Array.isArray(detail)
      ? {
          code: detail.code,
          retryable: detail.retryable,
          requestId: detail.request_id,
          details: detail,
        }
      : { details: detail }
    const backendMessage = typeof detail === 'string'
      ? detail
      : typeof detail?.message === 'string'
        ? detail.message
        : null
    const apiError = new ApiError(
      (typeof configuredMessage === 'function'
        ? configuredMessage(data)
        : configuredMessage) ?? backendMessage ?? fallbackErrorMessage,
      response.status,
      metadata,
    )
    if (response.status === 401 && !skipAuthInvalidation) {
      notifyUnauthorized()
    }
    throw apiError
  }

  return data
}

export function getJson(path, options) {
  return requestJson(path, options)
}
