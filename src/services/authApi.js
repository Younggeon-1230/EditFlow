import { requestJson } from './apiClient.js'

const AUTH_ERROR_MESSAGES = {
  401: '이메일 또는 비밀번호가 올바르지 않습니다.',
  409: '이미 가입된 이메일입니다.',
  422: '입력한 내용을 확인해 주세요.',
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
}

export function getMe({ signal } = {}) {
  return requestJson('/api/auth/me', {
    signal,
    fallbackErrorMessage: '로그인 상태를 확인하지 못했습니다.',
  })
}

export function signup(payload, { signal } = {}) {
  return requestJson('/api/auth/signup', {
    method: 'POST',
    body: payload,
    signal,
    errorMessages: AUTH_ERROR_MESSAGES,
    fallbackErrorMessage: '회원가입을 완료하지 못했습니다.',
  })
}

export function login(payload, { signal } = {}) {
  return requestJson('/api/auth/login', {
    method: 'POST',
    body: payload,
    signal,
    errorMessages: AUTH_ERROR_MESSAGES,
    fallbackErrorMessage: '로그인하지 못했습니다.',
    skipAuthInvalidation: true,
  })
}

export function logout({ signal } = {}) {
  return requestJson('/api/auth/logout', {
    method: 'POST',
    signal,
    fallbackErrorMessage: '로그아웃하지 못했습니다.',
  })
}
