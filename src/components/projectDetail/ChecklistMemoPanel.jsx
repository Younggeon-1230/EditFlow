function ChecklistMemoPanel({
  checklist = [],
  memos = [],
  mode,
  isLoading = false,
  error = null,
  onToggle,
  isItemPending = () => false,
}) {
  if (mode === 'checklist') {
    const completedCount = checklist.filter((item) => item.done).length

    return (
      <div className="checklist-panel">
        <div className="panel-heading">
          <div>
            <p className="resource-type">EDITING CHECKLIST</p>
            <h2>편집 체크리스트</h2>
          </div>
          <strong>
            {completedCount}/{checklist.length} 완료
          </strong>
        </div>
        {error && (
          <div className="reference-state error-state" role="alert">
            <p>{error}</p>
          </div>
        )}
        {isLoading && checklist.length === 0 ? (
          <div className="reference-state" role="status">
            <span className="loading-indicator" aria-hidden="true" />
            <p>체크리스트를 불러오는 중입니다.</p>
          </div>
        ) : checklist.length > 0 ? (
          <ul className="detail-checklist">
            {checklist.map((item) => {
              const isPending = isItemPending(item.id)

              return (
                <li className={item.done ? 'done' : ''} key={item.id}>
                  <label>
                    <input
                      aria-label={`${item.text} 완료 상태`}
                      checked={item.done}
                      disabled={isLoading || isPending}
                      onChange={() => onToggle?.(item.id)}
                      type="checkbox"
                    />
                    <span>{item.text}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="detail-checklist-empty">
            <strong>등록된 체크리스트가 없습니다.</strong>
            <p>체크리스트 페이지에서 작업 항목을 추가할 수 있습니다.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="memo-panel">
      <div className="panel-heading">
        <div>
          <p className="resource-type">PROJECT MEMO</p>
          <h2>프로젝트 메모</h2>
        </div>
      </div>
      <ul className="detail-memos">
        {memos.map((memo, index) => (
          <li key={`${memo}-${index}`}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{memo}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ChecklistMemoPanel
