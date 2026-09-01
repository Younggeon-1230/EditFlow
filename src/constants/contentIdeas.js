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

export const CONTENT_IDEA_RECOMMENDATION_INTERESTS = {
  entertainment_comedy: [
    { value: 'entertainment_skit', label: '상황극/콩트' },
    { value: 'entertainment_challenge', label: '챌린지' },
    { value: 'entertainment_reaction', label: '리액션' },
    { value: 'entertainment_talk', label: '예능형 토크' },
    { value: 'entertainment_meme_parody', label: '밈/패러디' },
  ],
  vlog_lifestyle: [
    { value: 'vlog_daily', label: '일상 브이로그' },
    { value: 'vlog_work_school', label: '직장/학교 생활' },
    { value: 'vlog_routine', label: '루틴' },
    { value: 'vlog_self_care', label: '자기관리' },
    { value: 'vlog_hobby', label: '취미 생활' },
  ],
  food_cooking: [
    { value: 'food_quick_recipe', label: '간단 레시피' },
    { value: 'food_solo_cooking', label: '자취 요리' },
    { value: 'food_mukbang_restaurant', label: '맛집/먹방' },
    { value: 'food_review', label: '음식 리뷰' },
    { value: 'food_baking', label: '베이킹' },
  ],
  gaming: [
    { value: 'gaming_beginner_guide', label: '게임 입문/가이드' },
    { value: 'gaming_strategy', label: '공략' },
    { value: 'gaming_highlight', label: '플레이 하이라이트' },
    { value: 'gaming_review', label: '리뷰' },
    { value: 'gaming_news', label: '게임 뉴스/정보' },
  ],
  beauty_fashion: [
    { value: 'beauty_makeup', label: '메이크업' },
    { value: 'beauty_skincare', label: '스킨케어' },
    { value: 'fashion_outfit', label: '코디' },
    { value: 'beauty_product_review', label: '제품 리뷰' },
    { value: 'fashion_styling', label: '스타일링 팁' },
  ],
  knowledge_education: [
    { value: 'knowledge_it', label: 'IT/기술' },
    { value: 'knowledge_study', label: '공부/학습' },
    { value: 'knowledge_finance', label: '경제/재테크' },
    { value: 'knowledge_history', label: '역사/교양' },
    { value: 'knowledge_career', label: '직무/커리어' },
  ],
  travel_outdoor: [
    { value: 'travel_domestic', label: '국내 여행' },
    { value: 'travel_overseas', label: '해외 여행' },
    { value: 'travel_itinerary', label: '여행 코스' },
    { value: 'travel_camping', label: '캠핑' },
    { value: 'travel_outdoor_activity', label: '등산/아웃도어' },
  ],
  kids: [
    { value: 'kids_play', label: '놀이' },
    { value: 'kids_learning', label: '학습' },
    { value: 'kids_crafts', label: '만들기' },
    { value: 'kids_story', label: '동화/이야기' },
    { value: 'kids_family', label: '가족 활동' },
  ],
}

export const CONTENT_IDEA_RECOMMENDATION_INTEREST_TOPIC_PLACEHOLDERS = {
  entertainment_skit: '예: 직장인이 공감하는 점심시간 상황극',
  vlog_routine: '예: 생산성을 높이는 직장인의 아침 루틴',
  food_solo_cooking: '예: 재료 5개로 만드는 자취생 저녁 메뉴',
  gaming_beginner_guide: '예: 발로란트를 처음 시작하는 사람을 위한 기본 설정 가이드',
  beauty_makeup: '예: 화장 초보자를 위한 10분 데일리 메이크업',
  knowledge_it: '예: 비전공자가 이해하는 생성형 AI 기본 개념',
  travel_itinerary: '예: 대중교통으로 즐기는 서울 하루 여행 코스',
  kids_crafts: '예: 집에 있는 재료로 만드는 쉬운 종이 장난감',
}

export const CONTENT_IDEA_RECOMMENDATION_LIMITS = {
  topicMin: 2,
  topic: 200,
  targetAudience: 500,
  contentFormat: 100,
  keywords: 10,
  keyword: 50,
  referenceContext: 1500,
  customGenre: 60,
  customInterest: 60,
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
