# EditFlow Phase 9-3 CSRF/CORS 통합

상태: 구현 완료

## 보안 계약

- `GET /api/auth/csrf`는 204와 JS-readable `editflow_csrf` cookie를 반환한다.
- `POST`, `PUT`, `PATCH`, `DELETE`는 허용된 `Origin` 또는, Origin이 없을 때 허용된 origin의 `Referer`를 요구한다.
- unsafe 요청은 CSRF cookie와 `X-CSRF-Token` header가 모두 있어야 하며 constant-time으로 비교한다.
- 유효한 auth session이 있으면 header token의 SHA-256 digest를 현재 `AuthSession.csrf_token_digest`와도 비교한다.
- signup/login 성공 시 session 전용 CSRF token으로 회전한다.
- 인증된 상태에서 bootstrap을 다시 호출하면 현재 session의 digest와 cookie를 함께 회전한다.
- 활성 session의 logout은 full CSRF 검증을 요구한다. session이 없거나 무효하면 cookie를 정리하고 204를 반환한다.
- safe method인 GET/HEAD/OPTIONS는 CSRF 검증 대상이 아니다.

인증 전 bootstrap token은 Phase 9-1 설계대로 Origin 검사와 double-submit pair로 검증한다. 별도의 signing secret이나 nonce store는 추가하지 않았다. 브라우저의 임의 cross-origin 요청은 custom CSRF header를 보낼 수 없으며, 서버의 Origin/Referer 검증을 별도로 통과해야 한다.

## CORS

`FRONTEND_ORIGINS`는 comma-separated allowlist이며 기본값은 `http://127.0.0.1:5173`이다. wildcard origin은 허용하지 않는다.

- credentials: enabled
- methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- headers: Content-Type, X-CSRF-Token

CORS는 브라우저가 응답을 읽도록 허용하는 경계이고, CSRF 검증은 서버가 요청 자체를 거부하는 별도 경계다. 한쪽이 다른 쪽을 대체하지 않는다.

## Phase 9-5 전 과도기

공통 dependency가 모든 API unsafe method에 적용된다.

- Auth signup/login: Origin/Referer + bootstrap double-submit
- Auth logout: 활성 session + session-bound CSRF
- Project, ContentIdea, Checklist, Memo, saved media, recommendation/save, conversion: Origin/Referer + double-submit; 유효한 session cookie가 있으면 session binding도 추가 검증

마지막 그룹은 아직 `DevelopmentUserDependency`로 ownership을 결정한다. 따라서 Phase 9-3은 CSRF 누락 방지를 완료했지만 실제 로그인 사용자의 ownership/authentication 강제는 아니다. Phase 9-5에서 `CurrentUserDependency`로 바꿀 때 이 endpoint들은 session 필수 + session-bound CSRF로 최종 전환한다.

## Frontend transport

공통 `requestJson()`은 unsafe method에서 CSRF cookie를 읽고 header를 자동 설정한다. cookie가 없으면 bootstrap GET을 한 번 수행한다. 동시에 여러 unsafe 요청이 시작되면 하나의 in-flight Promise를 공유하며, bootstrap 실패를 재귀 호출이나 무한 retry 없이 호출자에게 전달한다. session HttpOnly cookie는 읽지 않는다.

로컬 개발 host는 frontend `127.0.0.1:5173`, backend `127.0.0.1:8000`으로 통일한다. production HTTPS에서는 `AUTH_COOKIE_SECURE=true`를 사용한다.
