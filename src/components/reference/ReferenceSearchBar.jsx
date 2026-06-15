function ReferenceSearchBar({
  value,
  onChange,
  onSearch,
  isLoading,
}) {
  function handleSubmit(event) {
    event.preventDefault()

    if (value.trim()) {
      onSearch()
    }
  }

  return (
    <form className="reference-search-form" onSubmit={handleSubmit}>
      <label htmlFor="youtube-search-input">검색어</label>
      <div className="reference-search-input">
        <span aria-hidden="true">⌕</span>
        <input
          autoComplete="off"
          id="youtube-search-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="예: 이벤트 음악 가이드"
          type="search"
          value={value}
        />
        <button disabled={isLoading || !value.trim()} type="submit">
          {isLoading ? '검색 중' : '검색'}
        </button>
      </div>
    </form>
  )
}

export default ReferenceSearchBar
