const orderOptions = [
  { label: '관련도순', value: 'relevance' },
  { label: '조회수순', value: 'viewCount' },
  { label: '최신순', value: 'date' },
]

function ReferenceFilterBar({ activeOrder, onChange, disabled }) {
  return (
    <div className="reference-filter">
      <span>정렬</span>
      <div aria-label="검색 결과 정렬" className="filter-options">
        {orderOptions.map((option) => (
          <button
            aria-pressed={activeOrder === option.value}
            className={activeOrder === option.value ? 'active' : ''}
            disabled={disabled}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ReferenceFilterBar
