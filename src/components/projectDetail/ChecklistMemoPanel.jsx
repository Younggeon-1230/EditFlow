function ChecklistMemoPanel({ checklist = [], memos = [], mode }) {
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
        <ul className="detail-checklist">
          {checklist.map((item) => (
            <li className={item.done ? 'done' : ''} key={item.id}>
              <input
                checked={item.done}
                id={item.id}
                readOnly
                type="checkbox"
              />
              <label htmlFor={item.id}>{item.text}</label>
            </li>
          ))}
        </ul>
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
