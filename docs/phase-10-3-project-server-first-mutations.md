# Phase 10-3: Project server-confirmed mutations

## 결과

정상 Project의 create/update/delete 기준을 Backend API 성공 응답으로 전환했다. Server Project는 user-scoped `projects` localStorage에 생성하거나 갱신하지 않는다. 기존 `/projects/local/{localId}` Project의 수정, 삭제, 명시적 서버 동기화만 legacy compatibility write로 남긴다.

## 이전 mutation 흐름

- Create: 임시 local Project 생성 및 저장 -> POST -> 성공 시 `backendProjectId` wrapper 병합, 실패 시 `sync_failed` 보존
- Update/Delete: server/local 분기는 있었지만 list create가 local-first라 정상 신규 Project도 dual-state가 됨
- 실패한 create가 Dashboard와 legacy 목록에서 생성 성공처럼 보일 수 있었음

## Server-confirmed 흐름

### Create

1. 폼 submit과 동시에 mutation lock을 잡고 버튼/닫기를 비활성화한다.
2. `POST /api/projects`에 canonical payload를 보낸다. owner ID와 compatibility field는 보내지 않는다.
3. 201 응답을 canonical Project로 변환하고 server list를 refetch한 뒤 폼을 닫는다.
4. 실패하면 입력 폼을 유지하고 오류를 표시한다. local Project나 `sync_failed` wrapper를 만들지 않는다.

### Update

- `/projects/{backendId}`는 `PATCH /api/projects/{backendId}` 성공 뒤에만 응답 Project를 반영한다.
- 목록에서는 성공 뒤 server list를 refetch한다.
- 실패하면 기존 server value와 열린 폼을 유지한다.
- `/projects/local/{localId}`는 기존 user-scoped localStorage update를 유지한다.

### Delete

- Server Project는 `DELETE /api/projects/{id}` 성공 뒤에만 목록을 refetch하거나 `/projects`로 이동한다.
- 404를 포함한 실패는 삭제 성공으로 간주하지 않으며 Project와 legacy data를 유지한다.
- Backend가 checklist, memo, copied media 삭제 및 source Content Idea 복원을 소유한다. Frontend는 side effect를 복제하지 않는다.
- Local Project는 기존 user-scoped localStorage delete를 유지한다.

## Contract와 race 처리

- `projectsApi`가 `dueDate`/`deadline`을 `due_date`로 변환하고 status를 canonical enum으로 변환한다.
- 응답의 server `id`, `status`, `due_date`, timestamps, child counts가 canonical frontend model의 기준이다.
- list mutation은 synchronous ref lock과 pending UI로 create/update/delete/migrate 중복 실행을 막는다.
- detail mutation은 기존 ref lock을 유지하고 PATCH 응답을 바로 detail state에 적용한다.

## localStorage 경계

정상 server create/update/delete는 `editflow:v2:user:{id}:projects`를 쓰지 않는다. 남은 write는 legacy local-only edit/delete와 사용자가 명시적으로 실행하는 migration뿐이다. Migration 성공 wrapper 원본은 Phase 10-5 cleanup 전까지 자동 삭제하지 않는다.

## Child compatibility와 다음 단계

Server detail은 backend ID를 checklist, memo, reference, B-roll hook에 전달한다. Local detail은 local string ID를 유지한다. Child resource의 최종 API-only 정리, recovery helper 및 mapping dead code 제거, legacy import receipt/cleanup은 Phase 10-4/10-5 범위다. Content Idea conversion은 기존 atomic conversion endpoint와 returned server Project route를 그대로 사용한다.

## 검증

- `npm run test:project-api`: create/update payload와 canonical response mapper
- `npm run build`
- `git diff --check`
- 수동 QA: create/update/delete success/failure, refresh, localStorage clear, A/B ownership, local route, 360/768/1280 dialogs

Backend schema, migration, OpenAI/external API 호출 변경은 없다. Alembic head는 `e7b2a9c41d60`을 유지한다.
