# Phase 10-5: Legacy Project migration

## 목표

사용자별 localStorage에만 남아 있는 legacy Project를 사용자가 명시적으로 서버로 가져온다. 일반 server Project는 계속 Backend API/DB만을 기준으로 읽고 쓴다. 가져오기는 중복 요청과 응답 유실에 안전하며 Project, Checklist, Memo를 하나의 트랜잭션으로 생성한다.

## DB와 식별자

- Alembic revision: `c4a8d2e91f37` (`e7b2a9c41d60` 다음)
- `projects.source_local_id`: nullable `VARCHAR(200)`
- unique constraint: `uq_projects_user_source_local_id (user_id, source_local_id)`
- 일반 server Project는 `source_local_id = NULL`이다.
- 가져온 Project만 원본 local Project ID를 `source_local_id`로 저장한다.
- SQLite에서 nullable unique column은 여러 NULL을 허용하므로 일반 Project 생성은 영향을 받지 않는다.
- 별도 receipt table은 두지 않는다. 사용자 범위의 `source_local_id`가 receipt 역할을 충분히 수행한다.

## Import API

`POST /api/projects/import-local`

인증과 session-bound CSRF가 필요하다. 서버는 현재 로그인 사용자를 소유자로 사용하며 request의 추가 필드를 거부한다. 허용되는 데이터는 `source_local_id`, Project canonical fields, Checklist item fields와 순서, Memo content와 순서뿐이다. `user_id`, `backendProjectId`, 기존 서버/child ID, Reference, B-roll은 허용하지 않는다.

- 첫 요청: `201 Created`
- 같은 사용자와 같은 `source_local_id` 재요청: `200 OK`, 기존 Project 반환
- 다른 사용자와 같은 `source_local_id`: 서로 독립적인 Project 생성
- 동시 요청: DB unique constraint가 최종 방어선이며 패배한 트랜잭션은 rollback 후 기존 Project를 조회해 반환
- 응답 유실 후 재시도: 동일한 Project를 반환하며 Checklist와 Memo를 다시 만들지 않음

Project를 삭제하면 해당 `source_local_id` row도 사라진다. 보존된 local 원본에서 다시 명시적으로 가져오면 새 server Project를 생성한다.

## 원자성

Project를 flush한 뒤 Checklist와 Memo를 commit-free helper로 같은 Session에 추가하고 마지막에 한 번만 commit한다. 어느 child 단계에서든 실패하면 Project, Checklist, Memo를 모두 rollback한다. Reference와 B-roll은 이 트랜잭션에 포함하지 않는다.

## Frontend 흐름

가져오기는 `/projects/local/:localProjectId` 상세 화면에서 한 Project씩 실행한다. mapper는 local Project와 user-scoped Checklist/Memo를 canonical request로 만들며 stale `backendProjectId`, sync 상태, 기존 backend/server child ID를 전달하지 않는다.

성공 후 local Project를 삭제하거나 server 응답으로 덮어쓰지 않는다. 원본에는 `migratedToProjectId`와 `migratedAt` marker만 기록하고 오래된 `backendProjectId`, `syncStatus`, `lastSyncError`를 제거한다. marker 저장이 실패해도 server commit은 성공한 상태이며, 같은 가져오기를 다시 실행하면 API 멱등성으로 중복 없이 기존 Project를 반환한다.

marker가 있는 원본은 일반 legacy 목록에서 숨긴다. 직접 local route로 열면 읽기 전용으로 표시하고 server Project 링크를 제공한다. Project 수정/삭제, Checklist/Memo 변경, Reference/B-roll 검색 연결을 제공하지 않는다. stale marker의 server Project가 사라졌다면 원본을 다시 표시하고 명시적 재가져오기를 허용한다. server Project와 local 원본 사이의 dual-write는 없다.

## Reference와 B-roll

기존 flat localStorage Reference/B-roll에는 Project 연결 정보가 없으므로 자동 가져오기나 임의 배정을 하지 않는다. payload에서도 제외하고 local 원본은 유지한다. 가져오기 화면과 성공 알림에서 이 제한을 안내한다.

## 정리와 회귀 수정

- 순차 POST 기반 `projectMigration.js`, `checklistMigration.js` 제거
- 사용처가 없던 `mergeBackendProject` 제거
- server recovery dialog/helper와 구 `useProjects` 제거 상태 유지
- legacy `/projects/local/...` route는 보존하되 stale `backendProjectId`를 server route로 신뢰하지 않음
- Content Idea Reference/B-roll wrapper는 공용 saved-media hook에 Idea ID를 `resourceId`로 전달한다. Idea ID를 Project target으로 포장하지 않으며 기존 조회/추가/수정/삭제 API 계약을 유지한다.

## 최종 source of truth

| 리소스 | 일반 server Project | legacy local Project |
| --- | --- | --- |
| Project | Backend API/DB | user-scoped localStorage, migration source |
| Checklist | Backend API/DB | user-scoped localStorage, import 입력 |
| Memo | Backend API/DB | user-scoped localStorage, import 입력 |
| Reference | Backend API/DB | 기존 flat localStorage 보존, 자동 import 제외 |
| B-roll | Backend API/DB | 기존 flat localStorage 보존, 자동 import 제외 |

정상 server runtime은 Project 또는 child resource의 권위 데이터로 localStorage를 읽거나 mirror하지 않는다. localStorage 접근은 legacy 표시, local route, 명시적 가져오기, 로그인 사용자별 기존 데이터 import 호환에만 남는다.

## 검증 항목

- import 성공, same-user retry, cross-user 분리, concurrent duplicate 방지
- response-loss와 같은 재요청에서 Project/child 중복 없음
- 강제 child failure 전체 rollback
- stale/foreign ID 및 Reference/B-roll field 거부
- 삭제 후 명시적 re-import
- Alembic blank DB upgrade/downgrade/upgrade와 기존 DB 복사본 upgrade
- 전체 backend pytest, compileall, pip check
- Project API/child/migration 및 Content Idea media frontend smoke
- Vite production build와 `git diff --check`
- 실제 HTTP/browser에서 import, refresh, marker/local 원본, retry, 실패 상태와 360/768/1280 layout 확인

OpenAI, YouTube, Pexels 등의 live external API는 이 단계에서 호출하지 않는다.
