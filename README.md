# EditFlow

영상 편집에 필요한 프로젝트, 레퍼런스, B-roll 소스, 체크리스트를 한곳에서 관리하는 React 기반 웹 애플리케이션입니다.

편집 과정에서 여러 서비스와 문서에 흩어지는 자료를 프로젝트 단위로 정리하고, 작업 진행 상황을 빠르게 확인할 수 있도록 설계했습니다. 현재 버전은 프론트엔드와 브라우저 `localStorage`를 중심으로 구성되어 있으며, 향후 Spring Boot와 데이터베이스를 연결할 수 있도록 페이지, 컴포넌트, 훅, API 서비스를 역할별로 분리했습니다.

## 주요 기능

- 편집 현황을 요약해 보여주는 메인 대시보드
- 프로젝트 생성, 검색, 수정, 삭제
- 프로젝트별 상세 정보 및 자료 탭
- YouTube 영상 검색과 통계 정보 조회
- 관련도순, 조회수순, 최신순 정렬
- Pexels 영상 및 이미지 검색
- B-roll 타입 선택과 카테고리 빠른 검색
- 레퍼런스와 B-roll 소스 임시 저장
- 프로젝트별 편집 체크리스트 관리
- 체크리스트 항목 추가, 완료 처리, 삭제 및 진행률 표시
- 반응형 그레이톤 와이어프레임 UI

## 사용 기술

### Frontend

- React 18
- React Router
- JavaScript ES Modules
- HTML5
- CSS3

### Build Tool

- Vite
- npm

### 주요 구현 방식

- `useState`, `useEffect`, `useMemo`, `useRef`
- Custom Hook 기반 상태 및 비즈니스 로직 분리
- Fetch API와 `AbortController`
- `localStorage` 기반 데이터 유지
- 컴포넌트 단위 UI 재사용

## 사용 API

### YouTube Data API v3

유튜브 레퍼런스 검색에 사용합니다.

- `search.list`: 검색어와 정렬 조건에 맞는 영상 조회
- `videos.list`: 조회수, 좋아요 수, 댓글 수 등 영상 통계 조회

### Pexels API

무료 B-roll 영상과 이미지 검색에 사용합니다.

- Video Search API
- Photo Search API

API 키는 소스 코드에 작성하지 않고 Vite 환경변수로 관리합니다.

> Vite의 `VITE_` 환경변수는 브라우저 번들에 포함될 수 있습니다. 실제 운영 시에는 각 API 제공 콘솔에서 허용 도메인과 사용량 제한을 설정해야 합니다.

## 페이지 구성

| 경로 | 페이지 | 주요 역할 |
| --- | --- | --- |
| `/` | 메인 대시보드 | 프로젝트와 작업 현황 요약 |
| `/projects` | 프로젝트 목록 | 프로젝트 생성, 검색, 수정, 삭제 |
| `/projects/:projectId` | 프로젝트 상세 | 기본 정보와 레퍼런스, 썸네일, B-roll, 체크리스트, 메모 확인 |
| `/reference` | 유튜브 레퍼런스 검색 | YouTube 영상 검색, 정렬, 임시 저장 |
| `/broll` | B-roll 검색 | Pexels 영상·사진 검색 및 임시 저장 |
| `/checklist` | 편집 체크리스트 | 프로젝트별 작업 항목과 진행률 관리 |

등록되지 않은 주소는 404 안내 페이지로 연결됩니다.

## 실행 방법

### 1. 저장소 준비

```bash
git clone <repository-url>
cd EditFlow
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경변수 설정

프로젝트 루트의 `.env.example`을 참고해 `.env` 파일을 생성하고 발급받은 API 키를 입력합니다.

```env
VITE_YOUTUBE_API_KEY=your_youtube_api_key
VITE_PEXELS_API_KEY=your_pexels_api_key
```

실제 API 키가 포함된 `.env` 파일은 Git에 커밋하지 않습니다.

### 4. 개발 서버 실행

```bash
npm run dev
```

터미널에 출력된 로컬 주소를 브라우저에서 엽니다.

### 5. 프로덕션 빌드

```bash
npm run build
```

빌드 결과를 로컬에서 확인하려면 다음 명령을 사용합니다.

```bash
npm run preview
```

## 환경변수

| 변수명 | 설명 |
| --- | --- |
| `VITE_YOUTUBE_API_KEY` | YouTube Data API v3 인증 키 |
| `VITE_PEXELS_API_KEY` | Pexels API 인증 키 |

환경변수가 없으면 각 검색 페이지에 API Key가 설정되지 않았다는 오류 메시지가 표시됩니다.

`.gitignore`는 `.env`와 `.env.*` 파일을 제외하며, 공유 가능한 `.env.example`만 Git에 포함할 수 있도록 설정되어 있습니다.

## localStorage

현재 버전은 별도 서버 없이 브라우저에서 데이터를 유지하기 위해 다음 키를 사용합니다.

| Key | 저장 데이터 |
| --- | --- |
| `editflow_projects` | 프로젝트 목록과 기본 정보 |
| `editflow_checklists` | 프로젝트별 편집 체크리스트 |
| `editflow_saved_references` | 임시 저장한 YouTube 레퍼런스 |
| `editflow_saved_brolls` | 임시 저장한 Pexels B-roll 소스 |

localStorage 데이터는 같은 브라우저와 도메인에서만 유지됩니다. 브라우저 데이터를 삭제하거나 다른 기기에서 접속하면 기존 데이터가 공유되지 않습니다.

## 프로젝트 구조

```text
src/
  components/   재사용 UI 컴포넌트
  constants/    라우트와 localStorage 키
  data/         초기 데이터와 샘플 데이터
  hooks/        상태 및 데이터 처리 Custom Hook
  pages/        라우트별 페이지 컴포넌트
  services/     YouTube, Pexels API 호출
  styles/       전역 스타일
  utils/        날짜와 숫자 포맷 유틸리티
```

## 2학기 확장 계획

- Spring Boot REST API 연동
- MySQL 또는 PostgreSQL 기반 데이터 영구 저장
- 회원가입, 로그인 및 사용자별 프로젝트 관리
- YouTube/Pexels 검색 결과를 특정 프로젝트에 직접 저장
- 프로젝트 상세 페이지의 샘플 데이터를 실제 저장 데이터로 교체
- 체크리스트 진행률과 대시보드 통계 실시간 연동
- 썸네일, 메모, 자료 태그 및 즐겨찾기 기능
- 프로젝트 상태 변경과 마감일 알림
- API 키 보호를 위한 백엔드 프록시 구성
- 테스트 코드, ESLint, CI/CD 및 배포 환경 구축

## 현재 구현 범위

EditFlow의 1차 버전은 영상 편집 자료와 작업 흐름을 하나의 인터페이스에서 관리하는 프론트엔드 프로토타입입니다. 프로젝트 관리 기반과 외부 API 검색 흐름을 완성했으며, 2학기에는 서버와 데이터베이스를 연결해 실제 사용자별 편집 관리 서비스로 확장할 예정입니다.
