const typeOptions = [
  { label: 'Videos', value: 'videos' },
  { label: 'Photos', value: 'photos' },
]

function BrollTypeToggle({ activeType, onChange, disabled }) {
  return (
    <div className="broll-option-group">
      <span>타입</span>
      <div className="broll-type-toggle" aria-label="검색 소스 타입">
        {typeOptions.map((option) => (
          <button
            aria-pressed={activeType === option.value}
            className={activeType === option.value ? 'active' : ''}
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

export default BrollTypeToggle
