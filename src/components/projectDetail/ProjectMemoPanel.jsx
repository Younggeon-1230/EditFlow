import { useState } from 'react'

const MAX_CONTENT_LENGTH = 5000

function MemoEditor({
  id,
  value,
  onChange,
  onCancel,
  onSave,
  isSaving,
  saveLabel,
}) {
  const isValid = value.trim().length > 0

  return (
    <div className="project-memo-editor">
      <label htmlFor={id}>메모 내용</label>
      <textarea
        disabled={isSaving}
        id={id}
        maxLength={MAX_CONTENT_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        rows="4"
        value={value}
      />
      <div className="project-memo-editor-footer">
        <span>
          {value.length.toLocaleString('ko-KR')}/
          {MAX_CONTENT_LENGTH.toLocaleString('ko-KR')}
        </span>
        <div className="project-memo-actions">
          <button
            className="secondary-button"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            className="primary-button"
            disabled={isSaving || !isValid}
            onClick={onSave}
            type="button"
          >
            {isSaving ? '저장 중' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProjectMemoPanel({
  items,
  isLoading,
  error,
  isCreating,
  isUpdating,
  isDeleting,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingContent, setEditingContent] = useState('')

  async function addMemo() {
    const memo = await onAdd(newContent)
    if (memo) {
      setNewContent('')
      setIsAdding(false)
    }
  }

  function startEditing(memo) {
    setEditingId(memo.id)
    setEditingContent(memo.content)
  }

  async function updateMemo() {
    const memo = await onUpdate(editingId, { content: editingContent })
    if (memo) {
      setEditingId(null)
      setEditingContent('')
    }
  }

  async function deleteMemo(memo) {
    if (window.confirm('이 프로젝트 메모를 삭제할까요?')) {
      await onDelete(memo.id)
    }
  }

  return (
    <div className="memo-panel project-memo-panel">
      <div className="panel-heading project-memo-heading">
        <div>
          <p className="resource-type">PROJECT MEMO</p>
          <h2>프로젝트 메모</h2>
        </div>
        <button
          className="primary-button"
          disabled={isCreating || isAdding}
          onClick={() => setIsAdding(true)}
          type="button"
        >
          메모 추가
        </button>
      </div>

      {error && (
        <div className="reference-state error-state" role="alert">
          <p>{error}</p>
        </div>
      )}

      {isAdding && (
        <MemoEditor
          id="new-project-memo"
          isSaving={isCreating}
          onCancel={() => {
            setIsAdding(false)
            setNewContent('')
          }}
          onChange={setNewContent}
          onSave={addMemo}
          saveLabel="저장"
          value={newContent}
        />
      )}

      {isLoading && items.length === 0 ? (
        <div className="reference-state" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <p>프로젝트 메모를 불러오는 중입니다.</p>
        </div>
      ) : items.length > 0 ? (
        <ol className="detail-memos project-memo-list">
          {items.map((memo, index) => (
            <li className="project-memo-item" key={memo.id}>
              <span className="project-memo-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              {editingId === memo.id ? (
                <MemoEditor
                  id={`project-memo-${memo.id}`}
                  isSaving={isUpdating(memo.id)}
                  onCancel={() => {
                    setEditingId(null)
                    setEditingContent('')
                  }}
                  onChange={setEditingContent}
                  onSave={updateMemo}
                  saveLabel="수정 저장"
                  value={editingContent}
                />
              ) : (
                <div className="project-memo-content">
                  <p>{memo.content}</p>
                  <div className="project-memo-actions">
                    <button
                      className="secondary-button"
                      disabled={isDeleting(memo.id)}
                      onClick={() => startEditing(memo)}
                      type="button"
                    >
                      수정
                    </button>
                    <button
                      className="card-action-button delete"
                      disabled={isDeleting(memo.id)}
                      onClick={() => deleteMemo(memo)}
                      type="button"
                    >
                      {isDeleting(memo.id) ? '삭제 중' : '삭제'}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : !isAdding ? (
        <div className="detail-checklist-empty">
          <strong>등록된 프로젝트 메모가 없습니다.</strong>
          <p>메모 추가 버튼으로 첫 메모를 작성해 보세요.</p>
        </div>
      ) : null}
    </div>
  )
}

export default ProjectMemoPanel
