const STATUS_OPTIONS = [
  { value: 'planning', label: '기획 중' },
  { value: 'in_progress', label: '진행 중' },
  { value: 'completed', label: '완료' },
  { value: 'archived', label: '보관' },
]

function ProjectStatusDialog({
  value,
  onChange,
  onCancel,
  onSave,
  isSubmitting,
  error,
}) {
  return (
    <div className="form-overlay" role="presentation" onMouseDown={onCancel}>
      <section
        aria-labelledby="project-status-title"
        aria-modal="true"
        className="project-form-dialog project-status-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="project-form-heading">
          <div>
            <p className="page-eyebrow">PROJECT STATUS</p>
            <h2 id="project-status-title">프로젝트 상태 변경</h2>
          </div>
          <button
            aria-label="상태 변경 닫기"
            className="icon-button"
            disabled={isSubmitting}
            onClick={onCancel}
            type="button"
          >
            ×
          </button>
        </div>
        {error && (
          <div className="reference-state error-state" role="alert">
            <p>{error}</p>
          </div>
        )}
        <div className="project-form">
          <label>
            <span>상태</span>
            <select
              disabled={isSubmitting}
              onChange={(event) => onChange(event.target.value)}
              value={value}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="project-form-actions">
            <button
              className="secondary-button"
              disabled={isSubmitting}
              onClick={onCancel}
              type="button"
            >
              취소
            </button>
            <button
              className="form-submit-button"
              disabled={isSubmitting}
              onClick={onSave}
              type="button"
            >
              {isSubmitting ? '저장 중' : '상태 저장'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export { STATUS_OPTIONS }
export default ProjectStatusDialog
