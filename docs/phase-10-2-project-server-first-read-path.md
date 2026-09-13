# Phase 10-2: Project server-first read path

## Scope

Project 목록, 상세, Dashboard의 읽기 기준을 사용자별 localStorage 배열에서 인증된 Backend API로 전환했다. Backend schema와 API contract는 변경하지 않았으며 Project mutation의 최종 server-confirmed 전환은 Phase 10-3 범위로 남긴다.

## Canonical Project

`mapProjectFromApi`가 모든 Project API 응답을 다음 frontend contract로 변환한다.

- `id`: backend positive integer
- `title`, `description`, `clientName`, `status`, `dueDate`
- `createdAt`, `updatedAt`
- `referenceCount`, `brollCount`, `checklistCompleted`, `checklistTotal`

`description`, `client_name`, `due_date`의 null은 mapper에서 빈 문자열로 정규화한다. Backend enum status는 canonical 값으로 유지하고 한글 표시는 별도 display mapper에서 처리한다. `backendProjectId`, `deadline`, `backendStatus`, `serverCreatedAt`, `checklistDone` alias는 legacy/mutation adapter에만 남아 있다.

## Read paths

- 목록: `useServerProjects` → `GET /api/projects`
- 상세: `useServerProject` → `GET /api/projects/{backendId}`
- Dashboard: 목록 응답의 aggregate fields를 frontend에서 집계

각 hook은 AbortController와 request sequence를 사용한다. 목록 API 실패 시 synced local wrapper를 fallback으로 렌더링하지 않는다. loading, error, retry, empty 상태를 구분한다.

## Routes

- `/projects/{backendId}`: 정확한 positive safe integer만 허용하는 server detail
- `/projects/local/{localProjectId}`: 현재 로그인 사용자의 scoped localStorage만 조회하는 legacy detail
- `/projects/{oldLocalStringId}`: 현재 사용자 projects key에서만 wrapper를 찾아, linked wrapper는 server route로, unlinked wrapper는 local route로 replace redirect

다른 사용자의 storage namespace를 검색하지 않는다. Server detail의 404는 소유권 여부를 구분하지 않는 공통 not-found UX다.

## Legacy projects

Server Project와 legacy Project는 같은 배열로 합치지 않는다. backendProjectId가 없는 항목은 `local-only`, 성공한 server 목록에 backendProjectId가 없는 linked wrapper는 `stale-mapping`으로 별도 표시한다. Server row가 존재하는 wrapper는 화면에서 숨기되 storage 원본은 삭제하거나 server 응답으로 덮어쓰지 않는다.

Local detail에서는 checklist/memo의 기존 local key를 사용한다. Server detail에서는 backend integer ID를 checklist/memo/reference/B-roll API hook에 전달한다. 관계 없는 legacy flat media 데이터에는 자동 귀속하지 않는다.

## Dashboard and Content Ideas

Dashboard static JSON은 제거했고 server Project aggregate만 통계에 포함한다. local-only 수는 별도 안내로 표시한다. Content Idea의 `convertedProjectId`는 local wrapper lookup이나 recovery 없이 `/projects/{convertedProjectId}`로 직접 연결한다.

## Recovery and mutation transition

정상 server Project가 자동으로 목록에 나타나므로 Project 목록 및 Idea detail의 primary recovery CTA를 제거했다. Recovery utility/dialog 코드는 향후 legacy compatibility 정리 전까지 dead-code candidate로 남아 있다.

기존 create UX는 local record를 먼저 보존하고 POST 성공 시 server list를 refetch하며, 실패 시 local-only/sync-failed 항목을 유지한다. 목록/상세의 edit와 delete는 server Project에는 기존 API를 호출하고 local Project에는 현재 사용자 storage만 수정하는 page-level adapter를 사용한다. 정상 server Project를 GET한 결과는 localStorage에 mirror하지 않는다.

## Phase 10-3 blockers

- create를 server-confirmed-only로 전환하고 정상 성공 시 local wrapper write 제거
- update/delete mutation 상태와 오류 처리를 server entity 기준으로 통합
- legacy mutation adapter와 `useProjects` recovery dead code 정리 범위 확정

Child resource의 API-only 정리와 legacy import/idempotency는 각각 Phase 10-4/10-5 범위다.
