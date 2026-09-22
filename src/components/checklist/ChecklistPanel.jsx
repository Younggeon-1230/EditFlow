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
          <p>EditFlow에서 기본적으로 제공하는 체크리스트를 생성할 수 있습니다. 생성한 항목은 자유롭게 수정할 수 있습니다.</p>
          <button
            className="primary-button"
            disabled={disabled}
            onClick={onImportDefault}
            type="button"
          >
            {isImportingDefault ? '생성 중…' : '기본 체크리스트 생성'}
          </button>
        </div>
      )}
    </section>
  )
}

export default ChecklistPanel
