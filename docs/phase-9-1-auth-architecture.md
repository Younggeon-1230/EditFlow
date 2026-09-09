# EditFlow Phase 9-1 인증 아키텍처

상태: 설계 확정, Phase 9-2 backend 구현 상태 반영

대상 기준: Phase 8 완료 코드, Alembic head `b4e9c12d7a63`

범위: 인증 계약과 전환 계획. Phase 9-2의 회원가입·로그인·세션 cookie 구현을 반영했으며 CSRF 강제와 기존 API 전환은 후속 Phase에서 구현한다.

## 1. 결론

EditFlow의 브라우저 인증은 **DB-backed opaque session**을 사용한다.

- 브라우저에는 고엔트로피 session token을 `HttpOnly` cookie로 저장한다.
- DB에는 raw token이 아니라 `SHA-256(token)`만 저장한다.
- 인증이 필요한 요청은 session row로 사용자를 복원한다.
- 상태 변경 요청은 JS가 읽을 수 있는 CSRF cookie와 `X-CSRF-Token` header를 함께 보내며, 서버는 cookie/header 일치와 session binding을 모두 확인한다.
- access token이나 refresh token을 `localStorage` 또는 `sessionStorage`에 저장하지 않는다.
- 비밀번호는 `argon2-cffi`의 Argon2id로 hash한다. 직접 만든 SHA-256/SHA-512 password hash나 자체 암호 구현은 사용하지 않는다.
- `dev@editflow.local`은 자동 삭제하거나 실제 계정으로 자동 승격하지 않고 password가 없는 legacy data owner로 보존한다.
- 실제 다중 사용자 릴리스 전에는 backend ownership 교체와 frontend localStorage 사용자 격리를 모두 완료해야 한다.

JWT access/refresh token을 선택하지 않은 이유는 현재 제품이 브라우저 중심의 단일 애플리케이션이고, DB session이 logout·강제 만료·탈취 대응을 더 직접적으로 제공하기 때문이다. 모바일/외부 API가 생기면 별도의 token 인증을 추가할 수 있으며, 현재 browser session 계약을 JWT로 바꿀 필요는 없다.

## 2. Phase 9-1 조사 당시 구조

### Backend

Phase 9-1 조사 당시 `User`는 다음 네 필드만 가졌다.

- `id`
- `email`: `VARCHAR(255)`, non-null, unique index
- `created_at`
- `updated_at`

당시에는 `password_hash`, `is_active`, auth schema, auth router, session model, `get_current_user`와 email normalization 정책이 없었다. Phase 9-2 구현 결과는 17절에 정리한다.

개발 사용자는 두 곳에서 만들어진다.

1. 앱 lifespan 시작 시 `ensure_development_user()` 호출
2. 모든 `DevelopmentUserDependency` 해석 시 같은 함수 재호출

따라서 `dev@editflow.local`은 일회성 migration seed가 아니라 현재 요청 인증을 대신하는 런타임 dependency이다. 테스트도 `TestClient` lifespan을 통해 임시 DB마다 이 사용자를 만든다.

현재 CORS는 `frontend_origin` 단일 문자열을 허용하고 `allow_credentials=True`를 이미 사용한다. 기본값과 `.env.example`은 `http://localhost:5173`이지만 frontend API 기본 URL은 `http://127.0.0.1:8000`이다. Vite를 `127.0.0.1`로 열면 기본 CORS origin과 일치하지 않는다.

오류 응답은 대부분 FastAPI의 문자열 `detail`이고, AI 추천 오류만 `{code, message, retryable, request_id}` 객체를 `detail`에 넣는다. 공통 frontend client는 두 형태를 모두 읽을 수 있다.

### Ownership

현재 ownership 검증 자체는 존재하며, 사용자를 얻는 출처만 고정 개발 사용자이다.

| 영역 | 현재 사용자/소유권 경로 | 전환 대상 |
| --- | --- | --- |
| Projects | 모든 collection/create가 `DevelopmentUserDependency`; 단건은 `Project.user_id == user.id` | `CurrentUserDependency` |
| Project source idea | owned project와 현재 user 조건으로 조회 | dependency만 교체 |
| Checklist items | parent project 또는 item→project join으로 user 확인 | dependency만 교체 |
| Project memos | parent project 또는 memo→project join으로 user 확인 | dependency만 교체 |
| Saved references | parent project 또는 reference→project join으로 user 확인 | dependency만 교체 |
| Saved B-rolls | parent project 또는 B-roll→project join으로 user 확인 | dependency만 교체 |
| Content ideas | collection/create/추천/전환이 개발 user; 단건은 `ContentIdea.user_id == user.id` | `CurrentUserDependency` |
| Idea references | parent idea 또는 child→idea join으로 user 확인 | dependency만 교체 |
| Idea B-rolls | parent idea 또는 child→idea join으로 user 확인 | dependency만 교체 |
| AI recommendation save | signed payload의 `user_id`와 요청 user id를 비교 | 실제 current user를 전달 |
| External YouTube/Pexels search | 현재 user dependency 없음 | 로그인 사용자만 허용하도록 auth dependency 추가 |
| `/`, `/health`, API docs | 공개 | 공개 유지 |

다른 사용자의 객체 id를 요청하면 Project/Idea/child resource 모두 404로 숨기는 현재 패턴을 유지한다. request body의 `user_id`는 소유권 결정에 사용하지 않고 서버가 current user id를 주입한다.

AI recommendation token은 이미 생성 시 `user_id`를 서명 payload에 넣고 저장 시 요청 user와 비교한다. 실제 current user dependency로 교체하면 이 보안 경계는 그대로 동작한다. 현재 replay/rate-limit state는 프로세스 메모리 기반이므로 multi-process 전체에서 일관되지는 않는다는 한계는 별개로 남는다.

### Frontend

- React Router의 모든 제품 화면이 공개되어 있다.
- login/signup page, AuthProvider, auth hook, protected route, current-user UI가 없다.
- auth/access/refresh token을 Web Storage에 저장하는 코드는 없다.
- 공통 `requestJson()`은 이미 `credentials: 'include'`를 사용한다.
- 401 전역 처리와 CSRF header 주입은 없다.
- dashboard summary의 직접 `fetch()`는 정적 same-origin JSON을 읽는 용도이므로 backend auth 대상이 아니다.

현재 전역 localStorage key는 다음 다섯 개이다.

| 데이터 | 현재 key |
| --- | --- |
| Projects | `editflow_projects` |
| Checklists | `editflow_checklists` |
| Project memos | `editflow_project_memos` |
| Saved references | `editflow_saved_references` |
| Saved B-rolls | `editflow_saved_brolls` |

모두 사용자 구분이 없으므로 같은 브라우저에서 A가 logout한 뒤 B가 login하면 A의 local-only 데이터가 B에게 보일 수 있다. backend ownership만 교체해서는 이 노출을 막을 수 없다.

## 3. User와 email 정책

후속 migration에서 `users`에 다음 필드를 추가한다.

| 필드 | 정책 |
| --- | --- |
| `password_hash` | nullable string. 실제 가입 계정에는 필수지만 legacy owner를 위해 DB nullable 유지 |
| `is_active` | non-null boolean, server default true |

기존 `id`, `email`, `created_at`, `updated_at`은 재사용한다. role, permission, profile, avatar, OAuth, email verification, reset token은 이번 MVP에 넣지 않는다.

email 입력은 다음 순서로 처리한다.

1. 앞뒤 공백 제거
2. 표준 email validator로 형식과 길이 검증
3. 전체 주소를 `casefold()`하여 canonical email 생성
4. canonical 값만 `users.email`에 저장하고 조회에도 동일 함수를 사용
5. DB unique index를 최종 동시성 방어선으로 사용

최대 길이는 현재 column에 맞춰 255자로 제한한다. `USER@example.com`과 `user@example.com`은 같은 계정이다. migration 전에 기존 row들을 같은 방식으로 정규화했을 때 충돌하는지 검사하고, 충돌이 있으면 migration을 실패시켜 수동 해소한다. 애플리케이션 경로 밖의 직접 DB 쓰기는 lowercase를 강제하지 못한다는 점은 알려진 제약이다.

Auth response는 `id`, `email`, `created_at`만 반환한다. `password_hash`는 어떤 schema나 로그에도 포함하지 않는다.

## 4. Password 정책

- 알고리즘: Argon2id
- 라이브러리: `argon2-cffi`
- 길이: 12~128 Unicode code point
- password는 trim하거나 Unicode normalize하지 않는다. 앞뒤 공백도 사용자가 입력한 비밀번호의 일부이다.
- 전부 공백인 값은 거부한다.
- 대문자·숫자·특수문자 조합 규칙은 강제하지 않는다.
- hash 생성 시 random salt는 라이브러리에 맡긴다.
- 로그인 성공 후 `check_needs_rehash()`가 true이면 현재 parameter로 다시 hash한다.
- Argon2 parameter는 라이브러리 기본값을 맹목적으로 영구 고정하지 않고 배포 환경에서 benchmark한 뒤 설정한다. 목표는 인증 worker의 메모리/지연 한도 안에서 가능한 강한 값이다.

현재 실행 환경은 Python 3.14.3이고 `argon2-cffi`, `bcrypt`, `passlib`, `email-validator`는 설치되어 있지 않다. `argon2-cffi` 최신 배포판은 Python 3.13/3.14 공식 지원을 명시하므로 Phase 9-2에서 버전을 pin해 추가한다. `passlib` 같은 auth framework wrapper는 도입하지 않고 작은 password service가 `argon2-cffi`만 감싼다. email 형식 검증용 dependency도 같은 Phase에서 명시적으로 pin한다.

참고: [argon2-cffi PyPI](https://pypi.org/project/argon2-cffi/), [argon2-cffi 공식 문서](https://argon2-cffi.readthedocs.io/en/stable/)

## 5. Session 저장 구조

후속 migration에서 `auth_sessions` table을 만든다.

| 필드 | 타입/제약 |
| --- | --- |
| `id` | integer primary key; cookie에 노출하지 않음 |
| `user_id` | users FK, non-null, indexed, delete cascade |
| `token_digest` | fixed-length 64-char hex, non-null, unique index |
| `csrf_token_digest` | fixed-length 64-char hex, non-null |
| `created_at` | UTC timestamp, non-null |
| `expires_at` | UTC timestamp, non-null, indexed |
| `revoked_at` | UTC timestamp, nullable |

`last_seen_at`은 매 요청 write와 sliding expiry를 유발하므로 MVP에서 제외한다. 필요해지면 throttle된 activity update와 함께 별도 migration으로 추가한다.

### Token과 lifecycle

1. signup/login 성공 시 CSPRNG로 최소 32 random bytes를 만들고 URL-safe encoding한다.
2. raw token은 응답 cookie에만 넣고, DB에는 `SHA-256(raw token)`만 저장한다. 고엔트로피 token이므로 password hash가 아니라 빠른 one-way digest가 적합하다.
3. 요청마다 cookie token을 hash하여 active, non-expired session을 한 번 조회하고 active user를 join/조회한다.
4. TTL은 생성 시점부터 **7일 absolute expiration**이다. `/me`나 일반 API 사용으로 연장하지 않는다.
5. 로그인할 때마다 새 session을 만든다. MVP에서는 복수 브라우저/session을 허용한다.
6. logout은 해당 row의 `revoked_at`을 기록하고 두 cookie를 만료시킨다.
7. 만료/revoke된 row는 인증에 절대 사용하지 않으며, 요청 중 opportunistic cleanup 또는 관리 job으로 나중에 삭제할 수 있다.

signed cookie only 방식은 DB 조회를 줄이지만 즉시 revocation, 전체 session 무효화, 탈취 대응을 위해 별도 상태를 다시 만들게 된다. in-memory session은 서버 restart와 multi-process에서 깨진다. DB session은 현재 SQLite와 향후 PostgreSQL 모두에서 일관된 최소 선택이다. 규모가 커지면 session repository interface 뒤의 Redis로 저장소만 교체할 수 있다.

## 6. Cookie 정책

권장 이름:

- session: `editflow_session`
- CSRF: `editflow_csrf`

| 속성 | session | CSRF |
| --- | --- | --- |
| `HttpOnly` | true | false; JS가 header로 복사해야 함 |
| `Secure` | local HTTP false, production true | 동일 |
| `SameSite` | Lax | Lax |
| `Path` | `/` | `/` |
| `Domain` | 설정하지 않음(host-only) | 설정하지 않음(host-only) |
| lifetime | `Max-Age=604800`과 대응 `Expires` | session과 동일 |

로컬 개발 host는 frontend와 backend 모두 **`127.0.0.1`로 통일**한다.

- frontend: `http://127.0.0.1:5173`
- backend: `http://127.0.0.1:8000`

cookie는 port가 아니라 host에 귀속되므로 이 구성에서 backend가 설정한 host-only cookie는 backend 요청에 전송된다. `localhost`와 `127.0.0.1`을 섞지 않는다.

Production은 가능하면 reverse proxy로 `https://example.com`과 `/api`를 같은 origin에 둔다. 차선은 `https://app.example.com`과 `https://api.example.com`처럼 same-site subdomain을 사용한다. 완전히 cross-site인 배포만 `SameSite=None; Secure`가 필요하며 기본 지원 대상으로 두지 않는다. cookie 속성은 environment별 Settings로 관리하고 production에서 `Secure=false`이면 startup을 실패시키는 검증을 둔다.

## 7. CSRF 정책

인증 session에 묶인 double-submit 방식을 사용한다.

### 인증 전 bootstrap

`GET /api/auth/csrf`를 public support endpoint로 추가한다. 204를 반환하며 random pre-auth CSRF cookie를 발급한다. frontend는 signup/login 전에 이 값을 `X-CSRF-Token` header로 보낸다. 서버는 cookie/header의 constant-time 일치와 허용된 `Origin`(없다면 same-origin `Referer`)을 확인한다. 성공적으로 session을 만들면 CSRF token을 즉시 회전한다.

### 인증 후 검증

- session 생성 시 별도의 32-byte CSRF token을 생성한다.
- raw CSRF token은 readable cookie로 보내고 DB session에는 SHA-256 digest만 저장한다.
- `POST`, `PUT`, `PATCH`, `DELETE`는 session cookie 인증 후 아래를 모두 만족해야 한다.
  1. CSRF cookie 존재
  2. `X-CSRF-Token` header 존재
  3. cookie/header constant-time 일치
  4. header digest와 session의 `csrf_token_digest` 일치
  5. `Origin`이 명시적 frontend allowlist에 포함
- `GET`, `HEAD`, `OPTIONS`는 CSRF token 검증에서 제외한다. 이 method들은 서버 상태를 변경하지 않아야 한다.
- session cookie는 JS에서 읽지 못하고, CSRF cookie만 읽을 수 있어야 한다.

logout 요청은 active session이면 유효한 CSRF를 요구한다. session이 없거나 이미 invalid라면 cookie를 정리하고 204를 반환해 idempotent하게 유지한다. active session인데 token이 없거나 틀리면 403이며 session을 지우지 않는다.

## 8. CORS와 frontend transport

Backend 설정은 단일 `frontend_origin`에서 `frontend_origins: list[str]`로 확장한다.

로컬 기본 allowlist는 `http://127.0.0.1:5173` 하나이다. production origin은 env로 명시한다. credential 요청에서는 wildcard origin을 절대 사용하지 않는다.

- `allow_credentials=True`
- `allow_origins=settings.frontend_origins`
- 허용 method는 실제 API method 집합으로 제한하거나 현재 `*`를 유지할 수 있으나 origin은 반드시 명시 목록이어야 한다.
- 허용 header에 `Content-Type`, `X-CSRF-Token`을 포함한다.
- frontend 공통 `requestJson()`의 `credentials: 'include'`는 유지한다.
- 공통 client가 unsafe method일 때 CSRF cookie를 읽어 header를 자동 추가한다.
- 401은 `ApiError`로 반환한 뒤 AuthProvider가 current user를 비우고 login으로 전환한다. 개별 feature hook이 제각각 redirect하지 않는다.

## 9. Auth API 계약

모든 JSON 오류는 기존 client가 읽을 수 있는 다음 형태를 사용한다.

```json
{
  "detail": {
    "code": "invalid_credentials",
    "message": "이메일 또는 비밀번호가 올바르지 않습니다."
  }
}
```

### `GET /api/auth/csrf`

- public, CSRF exempt
- 성공: 204 + pre-auth CSRF cookie
- session 생성 endpoint 호출 전에 사용

### `POST /api/auth/signup`

Request:

```json
{
  "email": "user@example.com",
  "password": "a sufficiently long password"
}
```

- 성공: 201 + `AuthUserRead`, session/CSRF cookie 발급
- 409 `email_already_registered`
- 422 validation error
- 403 `csrf_failed`
- 429 `rate_limited`, 가능한 경우 `Retry-After` 포함

### `POST /api/auth/login`

Request는 signup과 같다.

- 성공: 200 + `AuthUserRead`, 새 session/CSRF cookie 발급
- 존재하지 않는 email, 잘못된 password, inactive user 모두 401 `invalid_credentials`와 같은 사용자 메시지
- 실패 경로도 timing 차이를 줄이기 위해 dummy password hash verify를 수행
- 403 `csrf_failed`
- 429 `rate_limited`

### `POST /api/auth/logout`

- body 없음
- active session이면 CSRF 필수
- 해당 session revoke, session/CSRF cookie 삭제
- 성공 또는 이미 비로그인: 204
- active session의 CSRF 실패: 403 `csrf_failed`

### `GET /api/auth/me`

- 단순 조회이며 session을 갱신하거나 만료를 연장하지 않음
- 성공: 200 + `AuthUserRead`
- 비로그인, 만료, revoke, inactive: 401 `authentication_required`

`AuthUserRead`:

```json
{
  "id": 1,
  "email": "user@example.com",
  "created_at": "2026-09-08T00:00:00Z"
}
```

## 10. 설정 계약

후속 구현에서 최소한 다음 Settings/env를 추가한다. `.env.example`에는 비밀값이 아닌 빈 placeholder와 안전한 local default만 둔다.

| 설정 | local default/정책 |
| --- | --- |
| `FRONTEND_ORIGINS` | `["http://127.0.0.1:5173"]` |
| `AUTH_SESSION_COOKIE_NAME` | `editflow_session` |
| `AUTH_CSRF_COOKIE_NAME` | `editflow_csrf` |
| `AUTH_CSRF_HEADER_NAME` | `X-CSRF-Token` |
| `AUTH_SESSION_TTL_SECONDS` | `604800` |
| `AUTH_COOKIE_SECURE` | development false, production true |
| `AUTH_COOKIE_SAMESITE` | `lax` |
| `AUTH_COOKIE_DOMAIN` | 빈 값 = host-only |
| `AUTH_PASSWORD_MIN_LENGTH` | `12` |
| `AUTH_PASSWORD_MAX_LENGTH` | `128` |

DB opaque session에는 session signing secret이 필요하지 않다. 사용하지 않는 `AUTH_SESSION_SECRET`을 관성적으로 추가하지 않는다. pre-auth CSRF를 향후 HMAC-signed 방식으로 강화할 때만 별도 CSRF signing secret을 추가한다. secret 원문, password, password hash, raw session token, CSRF token, 외부 API key는 로그에 남기지 않는다. 인증 실패 로그가 필요하면 request id, 결과 code, IP의 제한된/해시 표현만 남기고 전체 email은 기본적으로 기록하지 않는다.

## 11. Migration과 legacy dev user

Phase 9-2 migration은 SQLite batch mode를 사용해 다음을 한 revision에서 적용한다.

1. `users.password_hash` nullable 추가
2. `users.is_active` non-null/server-default true 추가
3. `dev@editflow.local`만 `is_active=false`로 설정하고 다른 기존 User의 active 상태는 유지
4. `auth_sessions` table과 index/FK 생성

기존 dev row와 연결된 Project, Idea, Checklist, Memo, media row는 수정하거나 삭제하지 않는다. dev 사용자는 로그인 불가능한 **legacy data owner**로 남긴다. password를 migration/seed에 하드코딩하거나 무작위 password로 자동 승격하지 않는다.

legacy backend 데이터를 실제 계정에 연결하는 작업은 별도 명시적 import/claim 기능으로 처리한다. 대상 사용자의 재인증, 데이터 개수 preview, 명시적 확인, transaction, audit가 필요하며 자동 소유권 이전은 금지한다. 아직 중요한 production data인지 단순 QA data인지 코드만으로 확정할 수 없으므로 보존이 가장 안전하다.

Migration 검증:

- 실제 DB 사본이 아닌 temp SQLite DB에서 upgrade head
- downgrade -1
- 다시 upgrade head
- `alembic check`
- 기존 dev row 및 모든 FK child count 보존 확인
- email normalization collision 사전 검사

## 12. Frontend 인증 구조

상태 관리 라이브러리를 추가하지 않고 React Context와 hook으로 구성한다.

`AuthProvider` 상태:

- `loading`
- `authenticated` + `currentUser`
- `unauthenticated`

제공 함수:

- `signup(credentials)`
- `login(credentials)`
- `logout()`
- `refreshCurrentUser()`

앱 시작 시 `/api/auth/csrf`를 준비하고 `/api/auth/me`를 한 번 조회한다. 인증 확인이 끝나기 전에는 보호 화면과 local data hook을 mount하지 않는다. `/login`, `/signup`만 제품 public route로 두고 기존 `/`, `/projects`, `/projects/:projectId`, `/ideas`, `/ideas/:ideaId`, `/reference`, `/broll`, `/checklist`는 보호한다. `/health`, backend docs 같은 운영 endpoint는 이 frontend route 정책과 별개로 공개 가능하다.

보호 URL에 비로그인 접근하면 전체 내부 경로(pathname + search + hash)를 location state의 `returnTo`로 보존한다. 로그인 후에만 복귀하며, `returnTo`는 `/`로 시작하고 `//`로 시작하지 않는 내부 URL만 허용해 open redirect를 막는다.

## 13. localStorage 사용자 격리와 legacy import

Auth token은 저장하지 않는다. feature data key만 immutable numeric user id로 scope한다.

| 현재 key | 새 key 예시 |
| --- | --- |
| `editflow_projects` | `editflow:v2:user:3:projects` |
| `editflow_checklists` | `editflow:v2:user:3:checklists` |
| `editflow_project_memos` | `editflow:v2:user:3:project-memos` |
| `editflow_saved_references` | `editflow:v2:user:3:saved-references` |
| `editflow_saved_brolls` | `editflow:v2:user:3:saved-brolls` |

모든 직접 localStorage 접근은 `storageKey(currentUser.id, dataType)` helper 뒤로 이동한다. logout 시 React의 사용자별 subtree를 unmount하여 in-memory state를 버리되, 그 사용자의 scoped local data를 삭제하지는 않는다. 다음 사용자는 자기 id key만 읽는다.

### 기존 전역 데이터 import UX

1. 인증이 끝나기 전에는 legacy 전역 key를 feature UI에서 읽지 않는다.
2. legacy key에 데이터가 있고 현재 user의 migration decision이 없다면 “기존 브라우저 로컬 데이터를 이 계정으로 가져오시겠습니까?”를 한 번 표시한다.
3. 자동 귀속하지 않고 `가져오기`와 `나중에/내 데이터 아님`을 명시적으로 선택하게 한다.
4. 가져오기 시 다섯 key를 함께 parse/validate하고 관계(Project id를 참조하는 Checklist/Memo/media)를 보존한다.
5. 대상 scoped key에 충돌이 있으면 overwrite하지 않고 preview와 merge/skip 선택을 제공한다.
6. scoped write를 모두 확인한 뒤 현재 user scope에 backup과 완료 marker를 기록하고 마지막에 legacy 전역 key를 제거한다.
7. 중간 실패 시 legacy 원본을 유지하고 완료 marker를 쓰지 않는다.

이 전환은 Phase 9-6까지 미루되, signup을 실제 사용자에게 공개하는 release보다 먼저 완료해야 한다. Phase 10 server-first 전환 후에도 offline/unsynced local data가 남는 동안 이 격리는 유지한다.

## 14. 보안 경계

- IDOR/BOLA: 모든 collection과 object query는 current user id를 조건에 포함한다. 다른 사용자 객체는 404를 반환한다.
- Session replay: HTTPS, `Secure`/`HttpOnly`, DB의 token hash, absolute expiry, logout revoke로 완화한다. raw token이 탈취된 동안에는 재사용 가능하므로 XSS 방어와 TLS가 필수이다.
- CSRF: unsafe method의 session-bound token, Origin 검사, SameSite=Lax를 함께 사용한다.
- Login enumeration: nonexistent/wrong/inactive를 같은 401 code/message로 처리하고 dummy verify를 사용한다.
- Race condition: email 중복은 사전 조회만 믿지 않고 DB unique violation을 409로 변환한다.
- Rate limit: Phase 9-2에서는 login을 IP+canonical email 기준 5회/분, signup을 IP 기준 3회/10분으로 제한하고 `Retry-After`를 반환한다. IP 전체 상한은 Phase 9-3 보강 대상으로 둔다. in-memory 구현은 local/single-process에서만 정확하므로 production multi-process 전에는 공유 저장소나 edge rate limit이 필요하다.
- Logging: password/hash, raw session/CSRF token, signing/API secret을 절대 기록하지 않는다.
- XSS: CSRF cookie는 읽을 수 있으므로 XSS를 막아주지 않는다. React escaping 유지, 임의 HTML 삽입 금지, 추후 CSP를 적용한다.
- User state: inactive user의 기존 session도 매 요청 user 상태 확인 후 거부한다.

MVP 제외: email verification, password reset, MFA, OAuth/social login, RBAC/admin, device/session management UI, advanced account lockout, CAPTCHA, suspicious-login detection.

## 15. 테스트 전략

### Backend

- Signup: 정상, 대소문자/공백 normalization, duplicate race, invalid email, 11/12/128/129자 password, all-space password
- Login: 정상, wrong password, nonexistent user, inactive user, 모두 동일한 외부 오류, rehash path
- Session: raw token 비저장, cookie 존재/속성, 없음/변조/만료/revoke, absolute TTL, inactive user
- `/me`: 200/401, expiry 미연장
- Logout: 정상, 반복 204, revoke 확인, cookie 삭제, active session CSRF 실패 시 403
- CSRF: bootstrap, header/cookie 없음, mismatch, session mismatch, valid, safe method exempt, invalid Origin
- CORS: 명시 origin + credentials, 미허용 origin 차단, wildcard 없음
- Ownership: user A CRUD 성공, user B가 A의 Project/Idea/Checklist/Memo/Reference/B-roll id 요청 시 404
- AI: A가 생성한 save token을 B가 저장할 때 mismatch, A 저장 성공
- Migration: 기존 dev row와 child 보존, nullable hash, inactive legacy owner, upgrade/downgrade/upgrade

### Frontend

- AuthProvider loading/authenticated/unauthenticated
- 공통 client의 credentials와 unsafe method CSRF header
- 401 시 사용자 상태 초기화
- 보호 route와 로그인 후 안전한 `returnTo`
- logout 시 사용자별 component state reset
- user A/B key 격리
- legacy import 성공, 거부, 충돌, parse 실패, 부분 write 실패 복구

### Browser QA

두 실제 계정으로 login/logout/새로고침/새 탭을 반복한다. A의 backend object id를 B session에서 직접 요청해 404인지 확인하고, A의 local-only 프로젝트·체크리스트·메모·media가 B 화면에 한 프레임도 나타나지 않는지 확인한다. cookie의 HttpOnly/Secure/SameSite/Path/Domain과 CSRF 실패도 DevTools에서 검증한다.

## 16. Phase 9-2~9-7 로드맵

### Phase 9-2 — Credential/session persistence와 auth backend (완료)

- User/AuthSession model, Alembic migration, Argon2/email dependency
- normalization/password/session service와 auth schema/router
- signup/login/logout/me/csrf backend test
- 단, 다음 Phase의 cookie/CSRF integration 없이 사용자에게 배포하지 않는다.

### Phase 9-3 — Cookie, CSRF, CORS 통합

- cookie 발급/삭제와 current user dependency
- pre-auth 및 session-bound CSRF
- origin list/CORS 설정, API error contract
- 공통 backend security test

### Phase 9-4 — React auth shell

- AuthProvider, Login/Signup, ProtectedRoute, current user/logout UI
- 공통 401 및 CSRF 처리, 안전한 returnTo
- auth loading 중 feature/localStorage mount 차단

### Phase 9-5 — 모든 backend API ownership 전환

- 모든 `DevelopmentUserDependency`를 `CurrentUserDependency`로 교체
- external search도 인증 요구
- 404 기반 A/B IDOR test, recommendation token user binding 회귀 test
- lifespan/request의 자동 dev user 생성을 제거하되 legacy row는 보존

### Phase 9-6 — localStorage 사용자 격리

- 다섯 저장소의 user-scoped key helper 적용
- legacy import/충돌/복구 UX
- logout/login 간 in-memory state reset과 A/B frontend test

### Phase 9-7 — 통합 보안 및 browser QA

- rate limit, logging redaction, cookie production validation 점검
- 전체 backend/frontend build와 migration rehearsal
- 두 계정/새 탭/새로고침/직접 object id 공격 QA

9-2~9-6은 개발 단위일 뿐 독립 배포 단위가 아니다. 9-5와 9-6 이전에 실제 signup을 공개하면 backend 또는 browser local data가 다른 사용자에게 노출될 수 있다. 따라서 다중 사용자 기능의 release gate는 9-6 완료이며, 최종 공개는 9-7 통과 후이다.

## 17. Phase 9-2 구현 상태와 알려진 한계

Phase 9-1은 docs-only로 완료되었고 Phase 9-2에서 다음 기반이 구현되었다.

- User credential와 AuthSession model, migration
- Argon2id hash/verify와 email normalization
- signup/login/logout/me endpoint
- session/CSRF token 생성, digest 저장, cookie 발급/삭제
- auth router에서 사용할 `CurrentUserDependency`
- login/signup in-memory rate limit
- local frontend origin을 `127.0.0.1:5173`으로 통일

아직 구현하지 않은 항목은 `GET /api/auth/csrf`, CSRF header/session binding 검증, Origin 검사, origin 목록 기반 CORS, 기존 API의 `CurrentUserDependency` 전환, frontend auth UI와 보호 route, localStorage 사용자 격리이다. CSRF cookie와 DB digest는 준비됐지만 Phase 9-3 전까지 검증되지 않는다. 기존 user-scoped API는 Phase 9-5까지 `dev@editflow.local`을 계속 사용한다.
