function ChecklistItem({
  item,
  index,
  onToggle,
  onDelete,
  disabled = false,
}) {
  return (
    <li className={`checklist-page-item${item.done ? ' done' : ''}`}>
      <label>
        <input
          checked={item.done}
          disabled={disabled}
          onChange={() => onToggle(item.id)}
          type="checkbox"
        />
        <span className="checklist-item-index">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="checklist-item-text">{item.text}</span>
      </label>
      <button
        aria-label={`${item.text} 삭제`}
        disabled={disabled}
        onClick={() => onDelete(item.id)}
        type="button"
      >
        삭제
      </button>
    </li>
  )
}

export default ChecklistItem
