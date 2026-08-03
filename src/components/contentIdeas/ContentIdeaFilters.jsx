import {
  CONTENT_IDEA_PLATFORMS,
  CONTENT_IDEA_PRIORITIES,
  CONTENT_IDEA_SOURCES,
  CONTENT_IDEA_STATUSES,
} from '../../constants/contentIdeas.js'

const filterSelects = [
  ['status', '상태', '전체 상태', CONTENT_IDEA_STATUSES],
  ['platform', '플랫폼', '전체 플랫폼', CONTENT_IDEA_PLATFORMS],
  ['priority', '우선순위', '전체 우선순위', CONTENT_IDEA_PRIORITIES],
  ['source', '출처', '전체 출처', CONTENT_IDEA_SOURCES],
]

function ContentIdeaFilters({ filters, onChange, onClear }) {
  const hasFilters = Object.values(filters).some((value) => value.trim())
  function updateFilter(event) {
    const { name, value } = event.target
    onChange((current) => ({ ...current, [name]: value }))
  }

  return (
    <section className="idea-filters" aria-label="콘텐츠 소재 필터">
      <label className="idea-search-field">
        <span>검색</span>
        <input
          name="search"
          onChange={updateFilter}
          placeholder="제목이나 설명을 검색하세요"
          type="search"
          value={filters.search}
        />
      </label>
      <div className="idea-filter-selects">
        {filterSelects.map(([name, label, emptyLabel, options]) => (
          <label key={name}>
            <span>{label}</span>
            <select name={name} onChange={updateFilter} value={filters[name]}>
              <option value="">{emptyLabel}</option>
              {Object.entries(options).map(([value, optionLabel]) => (
                <option key={value} value={value}>{optionLabel}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button className="secondary-button idea-filter-clear" disabled={!hasFilters} onClick={onClear} type="button">
        필터 초기화
      </button>
    </section>
  )
}

export default ContentIdeaFilters
