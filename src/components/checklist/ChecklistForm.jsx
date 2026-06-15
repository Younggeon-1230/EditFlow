import { useState } from 'react'

function ChecklistForm({ onAdd }) {
  const [text, setText] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    if (!text.trim()) {
      return
    }

    onAdd(text)
    setText('')
  }

  return (
    <form className="checklist-add-form" onSubmit={handleSubmit}>
      <label htmlFor="new-checklist-item">새 작업 추가</label>
      <div>
        <input
          id="new-checklist-item"
          onChange={(event) => setText(event.target.value)}
          placeholder="새 작업 항목 입력"
          type="text"
          value={text}
        />
        <button disabled={!text.trim()} type="submit">
          <span aria-hidden="true">+</span> 새 항목 추가
        </button>
      </div>
    </form>
  )
}

export default ChecklistForm
