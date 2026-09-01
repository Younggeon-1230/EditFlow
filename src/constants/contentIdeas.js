export const CONTENT_IDEA_PLATFORMS = {
  youtube: 'YouTube',
  shorts: 'YouTube Shorts',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  blog: 'Blog',
  other: '기타',
}

export const CONTENT_IDEA_STATUSES = {
  idea: '아이디어',
  researching: '조사 중',
  ready: '제작 준비',
  converted: '프로젝트 전환 완료',
  archived: '보관',
}

export const CONTENT_IDEA_PRIORITIES = {
  low: '낮음',
  medium: '보통',
  high: '높음',
}

export const CONTENT_IDEA_SOURCES = {
  manual: '직접 등록',
  ai: 'AI 추천',
}

export const CONTENT_IDEA_RECOMMENDATION_TONES = {
  informative: '정보형',
  friendly: '친근한 톤',
  professional: '전문적인 톤',
  energetic: '활기찬 톤',
  humorous: '유머러스한 톤',
  inspirational: '영감을 주는 톤',
}

export const CONTENT_IDEA_RECOMMENDATION_GENRES = [
  {
    value: 'entertainment_comedy',
    label: '엔터테인먼트/코미디',
    description: '일상, 개그, 콩트, 챌린지처럼 즐거움을 주는 콘텐츠',
    topicPlaceholder: '예: 직장인 공감 상황극과 짧은 코미디',
  },
  {
    value: 'vlog_lifestyle',
    label: '브이로그/라이프스타일',
    description: '일상, 루틴, 취미와 라이프스타일을 담는 콘텐츠',
    topicPlaceholder: '예: 혼자 사는 직장인의 평일 저녁 루틴',
  },
  {
    value: 'food_cooking',
    label: '먹방/요리',
    description: '레시피, 맛집, 식문화와 먹는 즐거움을 다루는 콘텐츠',
    topicPlaceholder: '예: 자취생을 위한 10분 저녁 레시피',
  },
  {
    value: 'gaming',
    label: '게임',
    description: '플레이, 공략, 리뷰와 게임 이야기를 다루는 콘텐츠',
    topicPlaceholder: '예: 초보자를 위한 발로란트 입문 콘텐츠',
  },
  {
    value: 'beauty_fashion',
    label: '뷰티/패션',
    description: '메이크업, 스타일링, 제품과 트렌드를 소개하는 콘텐츠',
    topicPlaceholder: '예: 초보자를 위한 데일리 메이크업',
  },
  {
    value: 'knowledge_education',
    label: '지식/정보/교육',
    description: '지식, 노하우와 복잡한 정보를 쉽게 전하는 콘텐츠',
    topicPlaceholder: '예: 5분 안에 이해하는 생성형 AI 기초',
  },
  {
    value: 'travel_outdoor',
    label: '여행/아웃도어',
    description: '여행지, 캠핑과 야외 경험을 생생하게 전하는 콘텐츠',
    topicPlaceholder: '예: 대중교통으로 떠나는 당일치기 여행',
  },
  {
    value: 'kids',
    label: '키즈',
    description: '아이와 가족이 함께 보고 즐길 수 있는 콘텐츠',
    topicPlaceholder: '예: 아이와 함께하는 쉬운 과학 놀이',
  },
  {
    value: 'custom',
    label: '직접 입력',
    description: '목록에 없는 분야를 직접 적어 추천에 반영합니다.',
    topicPlaceholder: '예: 선택한 분야에서 다루고 싶은 구체적인 주제',
  },
]

export const CONTENT_IDEA_RECOMMENDATION_LIMITS = {
  topicMin: 2,
  topic: 200,
  targetAudience: 500,
  contentFormat: 100,
  keywords: 10,
  keyword: 50,
  referenceContext: 1500,
  customGenre: 60,
  recommendationCountMin: 1,
  recommendationCountMax: 8,
}

export const EMPTY_CONTENT_IDEA_FILTERS = {
  search: '',
  status: '',
  platform: '',
  priority: '',
  source: '',
  sort: 'created_desc',
}

export const CONTENT_IDEA_SORT_OPTIONS = [
  { value: 'created_desc', label: '최근 등록순' },
  { value: 'updated_desc', label: '최근 수정순' },
  { value: 'priority_desc', label: '우선순위 높은순' },
  { value: 'priority_asc', label: '우선순위 낮은순' },
  { value: 'title_asc', label: '제목 가나다순' },
  { value: 'title_desc', label: '제목 역순' },
  { value: 'created_asc', label: '오래된 등록순' },
  { value: 'updated_asc', label: '오래된 수정순' },
]

export const CONTENT_IDEA_LIMITS = {
  title: 200,
  description: 5000,
  targetAudience: 500,
  contentFormat: 100,
  tags: 20,
  tag: 50,
}
