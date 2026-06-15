const categories = [
  { label: '자연', query: 'nature' },
  { label: '도시', query: 'city' },
  { label: '인물', query: 'people' },
  { label: '음식', query: 'food' },
  { label: '여행', query: 'travel' },
  { label: '활동', query: 'activity' },
]

function BrollCategoryBar({ onSelect, disabled }) {
  return (
    <div className="broll-option-group category-group">
      <span>빠른 검색</span>
      <div className="broll-categories">
        {categories.map((category) => (
          <button
            disabled={disabled}
            key={category.query}
            onClick={() => onSelect(category.query)}
            type="button"
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default BrollCategoryBar
