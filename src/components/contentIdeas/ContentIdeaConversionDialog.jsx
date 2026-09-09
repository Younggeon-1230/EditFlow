import { useEffect, useRef, useState } from 'react'
import { CONTENT_IDEA_PLATFORMS } from '../../constants/contentIdeas.js'
import useContentIdeaBrolls from '../../hooks/useContentIdeaBrolls.js'
import useContentIdeaReferences from '../../hooks/useContentIdeaReferences.js'
import ContentIdeaConversionMediaSection from './ContentIdeaConversionMediaSection.jsx'

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const PROJECT_STATUSES = {
  planning: '기획 중',
  in_progress: '진행 중',
  completed: '완료',
  archived: '보관',
}

function useMediaSelection({ error, isLoading, items, reload }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [isInitialized, setIsInitialized] = useState(false)
  const loadStartedRef = useRef(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (isLoading) {
      loadStartedRef.current = true
      return
    }
    if (!loadStartedRef.current || initializedRef.current || error) return
    initializedRef.current = true
    setSelectedIds(new Set(items.map((item) => item.id)))
    setIsInitialized(true)
  }, [error, isLoading, items])

  function toggle(itemId) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function retry() {
    initializedRef.current = false
    loadStartedRef.current = true
    setIsInitialized(false)
    setSelectedIds(new Set())
    reload()
  }

  return {
    selectedIds,
    isInitialized,
    toggle,
    selectAll: () => setSelectedIds(new Set(items.map((item) => item.id))),
    clear: () => setSelectedIds(new Set()),
    retry,
  }
}

function validate(values) {
  const errors = {}
  const title = values.title.trim()
  if (!title) errors.title = '프로젝트 제목을 입력해 주세요.'
  else if (title.length > 200) errors.title = '제목은 200자 이하여야 합니다.'
  if (values.description.length > 5000) errors.description = '설명은 5000자 이하여야 합니다.'
  if (values.createInitialMemo) {
    const initialMemo = values.initialMemo.trim()
    if (!initialMemo) errors.initialMemo = '초기 프로젝트 메모를 입력해 주세요.'
    else if (initialMemo.length > 5000) errors.initialMemo = '메모는 5,000자 이하여야 합니다.'
  }
  if (!Object.hasOwn(PROJECT_STATUSES, values.status)) errors.status = '프로젝트 상태를 확인해 주세요.'
  if (values.dueDate) {
    const date = new Date(`${values.dueDate}T00:00:00Z`)
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== values.dueDate) {
      errors.dueDate = '유효한 마감일을 입력해 주세요.'
    }
  }
  return errors
}

function ContentIdeaConversionDialog({ idea, error, isSubmitting, onCancel, onSubmit }) {
  const references = useContentIdeaReferences(idea.id)
  const brolls = useContentIdeaBrolls(idea.id)
  const referenceSelection = useMediaSelection(references)
  const brollSelection = useMediaSelection(brolls)
  const [values, setValues] = useState({
    title: idea.title,
    description: idea.description ?? '',
    status: 'planning',
    dueDate: '',
    createDefaultChecklist: true,
    createInitialMemo: false,
    initialMemo: '',
  })
  const [errors, setErrors] = useState({})
  const dialogRef = useRef(null)
  const titleInputRef = useRef(null)
  const submittingRef = useRef(isSubmitting)
  const cancelRef = useRef(onCancel)
  submittingRef.current = isSubmitting
  cancelRef.current = onCancel
  const isMediaReady =
    referenceSelection.isInitialized &&
    brollSelection.isInitialized &&
    !references.isLoading &&
    !brolls.isLoading &&
    !references.error &&
    !brolls.error

  useEffect(() => {
    const returnTarget = document.activeElement
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => titleInputRef.current?.focus(), 0)

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (!submittingRef.current) cancelRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousBodyOverflow
      window.setTimeout(() => returnTarget?.focus(), 0)
    }
  }, [])

  function handleChange(event) {
    const { checked, name, type, value } = event.target
    const nextValue = type === 'checkbox' ? checked : value
    setValues((current) => ({ ...current, [name]: nextValue }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!isMediaReady) return
    const nextErrors = validate(values)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }
    await onSubmit({
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      initialMemo: values.createInitialMemo ? values.initialMemo.trim() : '',
      selectedReferenceIds: [...referenceSelection.selectedIds],
      selectedBrollIds: [...brollSelection.selectedIds],
    })
  }

  return (
    <div className="form-overlay idea-form-overlay" onMouseDown={() => !isSubmitting && onCancel()} role="presentation">
      <section aria-labelledby="idea-conversion-title" aria-modal="true" className="idea-form-dialog idea-conversion-dialog" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog" tabIndex="-1">
        <div className="idea-form-heading">
          <div><p className="page-eyebrow">CREATE PROJECT</p><h2 id="idea-conversion-title">프로젝트로 전환</h2></div>
          <button aria-label="전환 창 닫기" className="icon-button" disabled={isSubmitting} onClick={onCancel} type="button">×</button>
        </div>

        <div className="idea-conversion-source" aria-label="원본 소재 요약">
          <strong>{idea.title}</strong>
          <span>{CONTENT_IDEA_PLATFORMS[idea.platform] ?? idea.platform}</span>
          {idea.contentFormat && <span>{idea.contentFormat}</span>}
          {idea.tags.length > 0 && <p>{idea.tags.map((tag) => `#${tag}`).join(' ')}</p>}
        </div>
        <p className="idea-conversion-note">원본 소재 정보는 참고용이며 제목과 설명만 프로젝트에 저장됩니다.</p>
        {error && (
          <div className="idea-form-error idea-conversion-error" role="alert">
            <p>{error}</p>
            <button
              className="secondary-button"
              disabled={isSubmitting}
              onClick={() => {
                referenceSelection.retry()
                brollSelection.retry()
              }}
              type="button"
            >자료 목록 새로고침</button>
          </div>
        )}

        <form className="idea-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="conversion-title">프로젝트 제목 *</label>
          <input aria-describedby={errors.title ? 'conversion-title-error' : undefined} disabled={isSubmitting} id="conversion-title" maxLength="201" name="title" onChange={handleChange} ref={titleInputRef} value={values.title} />
          {errors.title && <small className="idea-field-error" id="conversion-title-error" role="alert">{errors.title}</small>}

          <label htmlFor="conversion-description">프로젝트 설명</label>
          <textarea disabled={isSubmitting} id="conversion-description" maxLength="5001" name="description" onChange={handleChange} rows="5" value={values.description} />
          {errors.description && <small className="idea-field-error" role="alert">{errors.description}</small>}

          <div className="idea-form-grid">
            <div className="idea-connected-field">
              <label htmlFor="conversion-status">프로젝트 상태 *</label>
              <select disabled={isSubmitting} id="conversion-status" name="status" onChange={handleChange} value={values.status}>
                {Object.entries(PROJECT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errors.status && <small className="idea-field-error" role="alert">{errors.status}</small>}
            </div>
            <div className="idea-connected-field">
              <label htmlFor="conversion-due-date">마감일</label>
              <input disabled={isSubmitting} id="conversion-due-date" name="dueDate" onChange={handleChange} type="date" value={values.dueDate} />
              {errors.dueDate && <small className="idea-field-error" role="alert">{errors.dueDate}</small>}
            </div>
          </div>

          <fieldset className="idea-conversion-options" disabled={isSubmitting}>
            <legend>프로젝트 준비 옵션</legend>
            <label className="idea-conversion-option" htmlFor="conversion-default-checklist">
              <input checked={values.createDefaultChecklist} id="conversion-default-checklist" name="createDefaultChecklist" onChange={handleChange} type="checkbox" />
              <span><strong>기본 편집 체크리스트 만들기</strong><small>기획 확인, 소스 수집, 편집, 자막, 최종 검수 등 기본 작업 항목을 추가합니다.</small></span>
            </label>
            <label className="idea-conversion-option" htmlFor="conversion-initial-memo">
              <input aria-controls="conversion-memo-fields" checked={values.createInitialMemo} id="conversion-initial-memo" name="createInitialMemo" onChange={handleChange} type="checkbox" />
              <span><strong>초기 프로젝트 메모 만들기</strong><small>프로젝트를 시작하며 기억할 내용을 직접 작성합니다.</small></span>
            </label>
            {values.createInitialMemo && (
              <div className="idea-conversion-memo" id="conversion-memo-fields">
                <label htmlFor="conversion-memo">초기 프로젝트 메모 *</label>
                <textarea aria-describedby={errors.initialMemo ? 'conversion-memo-error conversion-memo-help' : 'conversion-memo-help'} aria-invalid={Boolean(errors.initialMemo)} id="conversion-memo" maxLength="5001" name="initialMemo" onChange={handleChange} placeholder="소재 설명을 참고해 필요한 작업 메모를 적어보세요." rows="5" value={values.initialMemo} />
                <small className="idea-field-help" id="conversion-memo-help">입력한 내용만 저장되며 소재 설명이나 AI 추천 내용은 자동으로 복사되지 않습니다.</small>
                {errors.initialMemo && <small className="idea-field-error" id="conversion-memo-error" role="alert">{errors.initialMemo}</small>}
              </div>
            )}
          </fieldset>

          <fieldset className="idea-conversion-media" disabled={isSubmitting}>
            <legend>프로젝트에 가져갈 자료</legend>
            <p className="idea-conversion-media-description">선택한 자료만 프로젝트에 복사합니다. 콘텐츠 소재의 원본 자료는 그대로 유지됩니다.</p>
            <ContentIdeaConversionMediaSection
              error={references.error}
              isDisabled={isSubmitting}
              isLoading={references.isLoading || (!referenceSelection.isInitialized && !references.error)}
              items={references.items}
              onClear={referenceSelection.clear}
              onRetry={referenceSelection.retry}
              onSelectAll={referenceSelection.selectAll}
              onToggle={referenceSelection.toggle}
              selectedIds={referenceSelection.selectedIds}
              title="Reference"
              type="reference"
            />
            <ContentIdeaConversionMediaSection
              error={brolls.error}
              isDisabled={isSubmitting}
              isLoading={brolls.isLoading || (!brollSelection.isInitialized && !brolls.error)}
              items={brolls.items}
              onClear={brollSelection.clear}
              onRetry={brollSelection.retry}
              onSelectAll={brollSelection.selectAll}
              onToggle={brollSelection.toggle}
              selectedIds={brollSelection.selectedIds}
              title="B-roll"
              type="broll"
            />
          </fieldset>

          <div className="idea-form-actions">
            <button className="secondary-button" disabled={isSubmitting} onClick={onCancel} type="button">취소</button>
            <button className="primary-button" disabled={isSubmitting || !isMediaReady} type="submit">{isSubmitting ? '프로젝트 만드는 중…' : !isMediaReady ? '자료 확인 중…' : '프로젝트 만들기'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default ContentIdeaConversionDialog
