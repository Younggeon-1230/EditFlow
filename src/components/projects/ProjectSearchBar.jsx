function ProjectSearchBar({ value, onChange }) {
  return (
    <div className="project-search">
      <label htmlFor="project-search-input">프로젝트 검색</label>
      <div className="project-search-field">
        <span aria-hidden="true">⌕</span>
        <input
          id="project-search-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="프로젝트명을 입력하세요."
          type="search"
          value={value}
        />
      </div>
    </div>
  )
}

export default ProjectSearchBar
