import ChecklistItem from './ChecklistItem'

function ChecklistPanel({ items, onToggle, onDelete }) {
  return (
    <section className="checklist-list-card">
      <div className="checklist-list-heading">
        <div>
          <p className="resource-type">TASK LIST</p>
          <h2>체크리스트</h2>
        </div>
        <span>{items.length}개 항목</span>
      </div>

      {items.length > 0 ? (
        <ol className="checklist-page-list">
          {items.map((item, index) => (
            <ChecklistItem
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
          <p>아래 입력창에서 첫 번째 편집 작업을 추가하세요.</p>
        </div>
      )}
    </section>
  )
}

export default ChecklistPanel
