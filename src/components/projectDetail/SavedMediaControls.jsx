import { useEffect, useState } from 'react'

const NOTE_MAX_LENGTH = 5000

function SavedMediaControls({
  item,
  itemLabel,
  onChangeNote,
  onRemove,
  originalUrl,
  isUpdating = false,
  isDeleting = false,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(item.note ?? '')
  const isBusy = isUpdating || isDeleting
  const textareaId = `${itemLabel}-note-${item.id}`

  useEffect(() => {
    setIsEditing(false)
    setDraft(item.note ?? '')
  }, [item.id])

  useEffect(() => {
    if (!isEditing) {
      setDraft(item.note ?? '')
    }
  }, [isEditing, item.note])

  function startEditing() {
    setDraft(item.note ?? '')
    setIsEditing(true)
  }

  function cancelEditing() {
    setDraft(item.note ?? '')
    setIsEditing(false)
  }

  async function saveNote() {
    const normalizedNote = draft.trim() || null
    const updatedItem = await onChangeNote(item.id, normalizedNote)
    if (updatedItem) {
      setIsEditing(false)
    }
  }

  async function removeItem() {
    const confirmed = window.confirm(`이 ${itemLabel}을 삭제할까요?`)
    if (confirmed) {
      await onRemove(item.id)
    }
  }

  return (
    <section className="saved-media-controls" aria-label={`${itemLabel} 메모`}>
      {isEditing ? (
        <div className="saved-media-note-editor">
          <label htmlFor={textareaId}>메모</label>
          <textarea
            disabled={isBusy}
            id={textareaId}
            maxLength={NOTE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            rows="3"
            value={draft}
          />
          <div className="saved-media-note-footer">
            <span>
              {draft.length.toLocaleString('ko-KR')}/
              {NOTE_MAX_LENGTH.toLocaleString('ko-KR')}
            </span>
          </div>
        </div>
      ) : (
        <p className={`saved-media-note${item.note ? '' : ' empty'}`}>
          {item.note || '메모가 없습니다.'}
        </p>
      )}
      <div className="saved-media-actions">
        {originalUrl && (
          <a
            className="secondary-button"
            href={originalUrl}
            rel="noreferrer"
            target="_blank"
          >
            원본 보기
          </a>
        )}
        {isEditing ? (
          <>
            <button
              className="secondary-button"
              disabled={isBusy}
              onClick={cancelEditing}
              type="button"
            >
              취소
            </button>
            <button
              className="primary-button"
              disabled={isBusy}
              onClick={saveNote}
              type="button"
            >
              {isUpdating ? '저장 중' : '저장'}
            </button>
          </>
        ) : (
          <>
            <button
              className="secondary-button"
              disabled={isBusy}
              onClick={startEditing}
              type="button"
            >
              메모 편집
            </button>
            <button
              className="card-action-button delete"
              disabled={isBusy}
              onClick={removeItem}
              type="button"
            >
              {isDeleting ? '삭제 중' : '삭제'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}

export default SavedMediaControls
