import ChecklistItem from './ChecklistItem'

function ChecklistPanel({
  items,
  onToggle,
  onDelete,
  onImportDefault,
  disabled = false,
  isImportingDefault = false,
}) {
  return (
    <section className="checklist-list-card">
      <div className="checklist-list-heading">
        <div>
          <p className="resource-type">TASK LIST</p>
          <h2>체크리스트</h2>
        </div>
        <div className="checklist-list-actions">
          <span>{items.length}개 항목</span>
        </div>
      </div>

      {items.length > 0 ? (
        <ol className="checklist-page-list">
          {items.map((item, index) => (
            <ChecklistItem
              disabled={disabled}
              index={index}
              item={item}
              key={item.id}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </ol>
      ) : (
        <div className="checklist-list-empty">
          <strong>등록된 작업 항목이 없습니다.</strong>
          <p>직접 추가하거나, 편집 작업에 자주 사용하는 기본 항목을 불러오세요.</p>
          <button
            className="primary-button"
            disabled={disabled}
            onClick={onImportDefault}
            type="button"
          >
            {isImportingDefault ? '불러오는 중…' : '기본 체크리스트 불러오기'}
          </button>
        </div>
      )}
    </section>
  )
}

export default ChecklistPanel
