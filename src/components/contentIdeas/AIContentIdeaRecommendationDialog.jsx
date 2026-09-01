import { useEffect, useRef, useState } from 'react'
import { CONTENT_IDEA_RECOMMENDATION_GENRES as GENRES } from '../../constants/contentIdeas.js'
import AIContentIdeaGenreStep from './AIContentIdeaGenreStep.jsx'
import AIContentIdeaRecommendationForm from './AIContentIdeaRecommendationForm.jsx'
import AIContentIdeaRecommendationList from './AIContentIdeaRecommendationList.jsx'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function AIContentIdeaRecommendationDialog({
  state,
  triggerRef,
  onClose,
  onGenerate,
  onSaveOne,
  onSaveSelected,
}) {
  const dialogRef = useRef(null)
  const genreOptionRef = useRef(null)
  const topicInputRef = useRef(null)
  const closeHandlerRef = useRef(null)
  const lastValuesRef = useRef(null)
  const [step, setStep] = useState(state.recommendations.length > 0 ? 'result' : 'genre')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [customGenre, setCustomGenre] = useState('')
  const selectedGenreOption = GENRES.find((genre) => genre.value === selectedGenre)
  const genreLabel = selectedGenre === 'custom'
    ? customGenre.trim()
    : selectedGenreOption?.label ?? ''
  const topicPlaceholder = selectedGenre === 'custom' && genreLabel
    ? `예: ${genreLabel} 분야에서 다루고 싶은 구체적인 주제`
    : selectedGenreOption?.topicPlaceholder

  function requestClose() {
    if (state.hasPendingWork) {
      if (!window.confirm('진행 중인 요청을 취소하고 AI 추천 창을 닫을까요?')) return
    } else if (state.hasUnsavedResults) {
      if (!window.confirm('저장하지 않은 추천 결과가 사라집니다. 창을 닫을까요?')) return
    }
    onClose()
  }
  closeHandlerRef.current = requestClose

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => genreOptionRef.current?.focus(), 0)

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeHandlerRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.hasAttribute('disabled'))
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      } else if (event.shiftKey && document.activeElement === first) {
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
      const returnTarget = triggerRef?.current ?? previouslyFocused
      window.setTimeout(() => returnTarget?.focus(), 0)
    }
  }, [triggerRef])

  async function handleGenerate(values) {
    if (state.hasUnsavedResults && !window.confirm('현재 미저장 추천을 새 결과로 바꿀까요?')) return null
    lastValuesRef.current = values
    const response = await onGenerate(values)
    if (response) {
      setStep('result')
      window.setTimeout(() => dialogRef.current?.focus(), 0)
    }
    return response
  }

  async function retryGeneration() {
    if (!lastValuesRef.current) {
      setStep('form')
      window.setTimeout(() => topicInputRef.current?.focus(), 0)
      return
    }
    const response = await handleGenerate(lastValuesRef.current)
    if (response) setStep('result')
  }

  function showRecommendationForm() {
    if (!genreLabel) return
    setStep('form')
    window.setTimeout(() => topicInputRef.current?.focus(), 0)
  }

  function showGenreStep() {
    if (state.hasPendingWork) return
    setStep('genre')
    window.setTimeout(() => {
      const selectedOption = dialogRef.current?.querySelector('input[name="ai-content-genre"]:checked')
      const focusTarget = selectedOption ?? genreOptionRef.current
      focusTarget?.focus()
    }, 0)
  }

  function toggleResultForm() {
    const nextStep = step === 'form' ? 'result' : 'form'
    setStep(nextStep)
    if (nextStep === 'form') window.setTimeout(() => topicInputRef.current?.focus(), 0)
  }

  return (
    <div className="form-overlay idea-form-overlay ai-recommendation-overlay" onMouseDown={requestClose} role="presentation">
      <section
        aria-describedby="ai-recommendation-description"
        aria-busy={state.hasPendingWork}
        aria-labelledby="ai-recommendation-title"
        aria-modal="true"
        className="idea-form-dialog ai-recommendation-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex="-1"
      >
        <div className="idea-form-heading ai-recommendation-dialog-heading">
          <div>
            <p className="page-eyebrow">AI CONTENT IDEAS</p>
            <h2 id="ai-recommendation-title">AI 콘텐츠 소재 추천</h2>
            <p id="ai-recommendation-description">조건을 입력해 아이디어를 받은 뒤 원하는 소재만 선택해 저장하세요.</p>
          </div>
          <button aria-label="AI 추천 창 닫기" className="icon-button" onClick={requestClose} type="button">×</button>
        </div>

        {step !== 'genre' && state.generationError && (
          <section className="ai-recommendation-error" role="alert">
            <div>
              <strong>{state.generationError.isValidation ? '추천 조건을 확인해 주세요.' : '추천을 생성하지 못했습니다.'}</strong>
              <p>{state.generationError.message}</p>
              {state.generationError.requestId && <small>요청 ID: {state.generationError.requestId}</small>}
            </div>
            {state.generationError.retryable && <button className="secondary-button" disabled={state.isGenerating} onClick={retryGeneration} type="button">다시 시도</button>}
          </section>
        )}

        {step !== 'genre' && state.recommendations.length > 0 && (
          <div className="ai-recommendation-mode-actions">
            <button aria-expanded={step === 'form'} className="secondary-button" disabled={state.hasPendingWork} onClick={toggleResultForm} type="button">
              {step === 'form' ? '추천 조건 접기' : '조건 수정·다시 추천'}
            </button>
            <span aria-live="polite">{state.isGenerating ? '새 추천을 생성하고 있습니다.' : `요청 ID ${state.responseMeta?.requestId ?? '–'}`}</span>
          </div>
        )}

        {step === 'genre' && (
          <AIContentIdeaGenreStep
            customGenre={customGenre}
            firstOptionRef={genreOptionRef}
            onCancel={requestClose}
            onCustomGenreChange={setCustomGenre}
            onGenreChange={setSelectedGenre}
            onNext={showRecommendationForm}
            selectedGenre={selectedGenre}
          />
        )}

        {step === 'form' && (
          <AIContentIdeaRecommendationForm
            genreLabel={genreLabel}
            isGenerating={state.isGenerating}
            onBack={showGenreStep}
            onGenerate={handleGenerate}
            topicInputRef={topicInputRef}
            topicPlaceholder={topicPlaceholder}
          />
        )}

        {state.isGenerating && <div aria-live="polite" className="ai-recommendation-loading" role="status"><span aria-hidden="true" />AI가 추천 소재를 구성하고 있습니다. 창을 닫으면 요청이 취소됩니다.</div>}

        {state.recommendations.length > 0 && (
          <AIContentIdeaRecommendationList onSaveOne={onSaveOne} onSaveSelected={onSaveSelected} state={state} />
        )}
      </section>
    </div>
  )
}

export default AIContentIdeaRecommendationDialog
