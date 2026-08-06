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
