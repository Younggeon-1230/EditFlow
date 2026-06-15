# EditFlow 기말 발표 코드 가이드

## 1. 프로젝트 전체 구조

EditFlow는 화면, 상태 로직, API 통신을 역할별로 분리한 React 프로젝트입니다.

```text
src/
  components/   반복 사용하는 UI
  constants/    라우트와 localStorage 키
  data/         초기 데이터와 샘플 데이터
  hooks/        상태 및 비즈니스 로직
  pages/        URL별 화면
  services/     외부 API 요청
  styles/       전역 CSS
  utils/        날짜·숫자 포맷
```

발표 핵심: **Page는 화면을 조합하고, Component는 UI를 재사용하며, Hook은 상태를 관리하고, Service는 API를 호출합니다.**

## 2. 라우팅 구조

라우팅은 `src/App.jsx`, 경로 상수는 `src/constants/app.js`에서 관리합니다.

| 경로 | 페이지 |
| --- | --- |
| `/` | 메인 대시보드 |
| `/projects` | 프로젝트 목록 |
| `/projects/:projectId` | 프로젝트 상세 |
| `/reference` | 유튜브 레퍼런스 검색 |
| `/broll` | Pexels B-roll 검색 |
| `/checklist` | 편집 체크리스트 |

`Header.jsx`는 `NavLink`를 사용하므로 현재 URL과 일치하는 메뉴에 `active` 클래스가 자동 적용됩니다. 등록되지 않은 경로는 `NotFoundPage`로 이동합니다.

## 3. 컴포넌트화

반복되거나 역할이 분명한 UI를 별도 컴포넌트로 분리했습니다.

- 프로젝트: `ProjectCard`, `ProjectForm`, `ProjectSearchBar`
- 유튜브: `ReferenceSearchBar`, `ReferenceResultCard`, `ReferenceResultList`
- B-roll: `BrollSearchBar`, `BrollResultCard`, `BrollResultList`
- 체크리스트: `ChecklistItem`, `ChecklistPanel`, `ChecklistProgress`
- 공통 레이아웃: `Header`

예를 들어 결과 목록 컴포넌트는 배열을 `map`으로 순회하고, 각 데이터는 카드 컴포넌트에 `props`로 전달합니다. 덕분에 카드 디자인과 데이터 처리 책임을 분리할 수 있습니다.

## 4. fetch 사용 위치

`fetch`는 다음 세 곳에서 사용합니다.

1. `useDashboardSummary.js`
   - `/data/dashboard-summary.json`을 불러옵니다.
2. `youtubeApi.js`
   - YouTube Data API에 요청합니다.
3. `pexelsApi.js`
   - Pexels API에 요청합니다.

페이지 컴포넌트에서 직접 API를 호출하지 않고 Hook과 Service로 분리해 화면 코드를 단순하게 유지했습니다.

## 5. useEffect 마운트와 언마운트

주요 사용 예시는 다음과 같습니다.

- `useDashboardSummary`: 마운트 시 대시보드 JSON 요청
- `useProjects`: 프로젝트 state가 바뀔 때 localStorage 저장
- `useChecklist`: 체크리스트 state가 바뀔 때 localStorage 저장
- `useYoutubeSearch`, `usePexelsSearch`: 언마운트 시 진행 중인 요청 취소

검색 Hook에서는 `AbortController`를 생성하고 cleanup 함수에서 `abort()`를 호출합니다. 사용자가 페이지를 이동하거나 새 검색을 실행했을 때 이전 요청이 늦게 도착해 state를 덮어쓰는 문제를 줄입니다.

## 6. state 업데이트와 리렌더링

React는 `setState`가 호출되면 변경된 state를 사용하는 컴포넌트를 다시 렌더링합니다.

예시:

- 검색어 변경: 입력창의 `value` 갱신
- API 검색 완료: `results` 갱신 후 결과 카드 렌더링
- 체크박스 클릭: `done` 변경 후 목록과 진행률 동시 갱신
- 프로젝트 탭 클릭: `activeTab` 변경 후 선택 패널 교체

배열을 수정할 때 기존 배열을 직접 변경하지 않고 `map`, `filter`, 전개 연산자를 사용해 새로운 배열을 생성합니다.

## 7. localStorage 사용

localStorage 키는 `src/constants/app.js`에서 한 번에 관리합니다.

| Key | 용도 |
| --- | --- |
| `editflow_projects` | 프로젝트 목록 |
| `editflow_checklists` | 프로젝트별 체크리스트 |
| `editflow_saved_references` | 임시 저장한 YouTube 영상 |
| `editflow_saved_brolls` | 임시 저장한 Pexels 소스 |

객체와 배열은 `JSON.stringify()`로 저장하고 `JSON.parse()`로 복원합니다. 저장 데이터가 없거나 파싱에 실패하면 초기 데이터를 사용합니다.

## 8. YouTube API 연동 흐름

관련 파일:

- `ReferenceSearchPage.jsx`
- `useYoutubeSearch.js`
- `youtubeApi.js`

처리 순서:

1. 사용자가 검색어와 정렬 방식을 선택합니다.
2. `useYoutubeSearch`가 loading과 error 상태를 관리합니다.
3. `youtubeApi.js`가 `search.list`로 영상 ID와 기본 정보를 조회합니다.
4. 영상 ID를 모아 `videos.list`로 조회수, 좋아요, 댓글 수를 조회합니다.
5. 두 응답을 하나의 결과 배열로 합칩니다.
6. `ReferenceResultList`가 결과 카드를 렌더링합니다.

API 키는 `import.meta.env.VITE_YOUTUBE_API_KEY`에서 읽습니다.

## 9. Pexels API 연동 흐름

관련 파일:

- `BrollSearchPage.jsx`
- `usePexelsSearch.js`
- `pexelsApi.js`

처리 순서:

1. 사용자가 Videos 또는 Photos 타입을 선택합니다.
2. 영상은 `/videos/search`, 사진은 `/v1/search`로 요청합니다.
3. API 키는 `Authorization` 헤더에 전달합니다.
4. 서로 다른 영상·사진 응답을 공통 asset 구조로 변환합니다.
5. `BrollResultList`가 동일한 카드 컴포넌트로 결과를 렌더링합니다.

API 키는 `import.meta.env.VITE_PEXELS_API_KEY`에서 읽습니다.

## 10. 발표 때 보여주기 좋은 파일

추천 순서:

1. `src/App.jsx`: 전체 페이지와 라우팅
2. `src/constants/app.js`: 경로와 저장 키 중앙 관리
3. `src/pages/ProjectListPage.jsx`: 페이지와 컴포넌트 조합
4. `src/hooks/useProjects.js`: CRUD와 localStorage
5. `src/components/projects/ProjectCard.jsx`: props와 반복 UI
6. `src/hooks/useYoutubeSearch.js`: loading, error, AbortController
7. `src/services/youtubeApi.js`: YouTube 2단계 요청
8. `src/services/pexelsApi.js`: 타입별 API와 데이터 정규화
9. `src/hooks/useChecklist.js`: 불변 state 업데이트와 진행 상태 저장

## 11. 예상 질문과 답변

### Q. 왜 API 요청을 페이지에서 직접 하지 않았나요?

화면, 상태 관리, 통신 책임을 분리하기 위해 Custom Hook과 Service를 사용했습니다. API가 변경되어도 화면 컴포넌트의 수정 범위를 줄일 수 있습니다.

### Q. AbortController는 왜 사용했나요?

페이지 이동이나 연속 검색 시 이전 요청을 취소해 불필요한 네트워크 작업과 오래된 응답의 state 업데이트를 방지하기 위해 사용했습니다.

### Q. 왜 localStorage를 사용했나요?

현재 단계에서는 백엔드 없이도 새로고침 후 데이터를 유지하기 위해 사용했습니다. 다음 학기에는 같은 Hook 인터페이스를 유지하면서 Spring Boot와 DB로 교체할 계획입니다.

### Q. React에서 화면이 자동으로 바뀌는 이유는 무엇인가요?

`setState`로 state가 변경되면 React가 해당 값을 사용하는 컴포넌트를 다시 렌더링하기 때문입니다.

### Q. YouTube API를 왜 두 번 호출하나요?

`search.list`에는 상세 통계가 없기 때문에 먼저 영상 ID를 검색하고, 그 ID로 `videos.list`를 호출해 통계 정보를 추가합니다.

### Q. API 키는 안전한가요?

소스 코드와 Git에는 포함하지 않고 `.env`에서 관리합니다. 다만 프론트엔드 환경변수는 브라우저에서 확인될 수 있으므로 실제 배포 시 API 도메인 제한과 백엔드 프록시가 필요합니다.

### Q. 프로젝트 상세 데이터가 모두 실제 저장 데이터인가요?

프로젝트 기본 정보는 localStorage와 연결되어 있지만 상세 탭 자료 일부는 현재 샘플 데이터입니다. 이후 검색 결과를 프로젝트별 DB 데이터로 연결할 예정입니다.

## 발표 마무리 한 문장

“EditFlow는 React의 컴포넌트, 상태 관리, 라우팅, 외부 API, localStorage를 역할별로 분리해 영상 편집 자료와 작업 흐름을 통합 관리하는 프로젝트입니다.”
