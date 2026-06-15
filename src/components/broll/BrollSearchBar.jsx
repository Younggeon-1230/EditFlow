function BrollSearchBar({ value, onChange, onSearch, isLoading }) {
  function handleSubmit(event) {
    event.preventDefault()

    if (value.trim()) {
      onSearch()
    }
  }

  return (
    <form className="broll-search-form" onSubmit={handleSubmit}>
      <label htmlFor="pexels-search-input">검색어</label>
      <div className="broll-search-input">
        <span aria-hidden="true">⌕</span>
        <input
          autoComplete="off"
          id="pexels-search-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="예: presentation simple, city night, coffee"
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

export default BrollSearchBar
