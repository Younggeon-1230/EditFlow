import {
  CONTENT_IDEA_RECOMMENDATION_INTERESTS as INTERESTS,
  CONTENT_IDEA_RECOMMENDATION_LIMITS as LIMITS,
} from '../../constants/contentIdeas.js'

const CUSTOM_INTEREST = {
  value: 'custom',
  label: '직접 입력',
  description: '목록에 없는 관심사를 직접 적어 추천에 반영합니다.',
}

function AIContentIdeaInterestStep({
  genreLabel,
  genreValue,
  selectedInterest,
  customInterest,
  firstOptionRef,
  onInterestChange,
  onCustomInterestChange,
  onBack,
  onNext,
}) {
  const isCustomGenre = genreValue === 'custom'
  const isCustomInterest = isCustomGenre || selectedInterest === 'custom'
  const options = [...(INTERESTS[genreValue] ?? []), CUSTOM_INTEREST]
  const canContinue = isCustomInterest
    ? Boolean(customInterest.trim())
    : Boolean(selectedInterest)

  function handleSubmit(event) {
    event.preventDefault()
    if (canContinue) onNext()
  }

  return (
    <form className="ai-genre-step ai-interest-step" noValidate onSubmit={handleSubmit}>
      <div className="ai-recommendation-step-heading">
        <p className="ai-recommendation-step-label">2 / 3 · 세부 관심사</p>
        <h3 id="ai-interest-heading">{genreLabel}에서 어떤 콘텐츠에 관심이 있나요?</h3>
        <p id="ai-interest-description">한 가지를 선택하면 주제 작성 예시와 추천 맥락을 더 구체적으로 안내합니다.</p>
      </div>

      <fieldset aria-describedby="ai-interest-description" className="ai-genre-fieldset">
        <legend className="sr-only">세부 관심사</legend>
        {!isCustomGenre && (
          <div className="ai-genre-grid ai-interest-grid">
            {options.map((interest, index) => {
              const isSelected = selectedInterest === interest.value
              return (
                <label className={`ai-genre-option ai-interest-option${isSelected ? ' is-selected' : ''}`} key={interest.value}>
                  <input
                    aria-describedby={`ai-interest-${interest.value}-description`}
                    checked={isSelected}
                    name="ai-content-interest"
                    onChange={() => onInterestChange(interest.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        onInterestChange(interest.value)
                      }
                    }}
                    ref={index === 0 ? firstOptionRef : undefined}
                    type="radio"
                    value={interest.value}
                  />
                  <span className="ai-genre-option-copy">
                    <strong>{interest.label}</strong>
                    <span id={`ai-interest-${interest.value}-description`}>
                      {interest.description ?? `${genreLabel}의 ${interest.label} 콘텐츠`}
                    </span>
                  </span>
                  <span aria-hidden="true" className="ai-genre-selected-indicator">
                    {isSelected ? '✓ 선택됨' : '선택'}
                  </span>
                </label>
              )
            })}
          </div>
        )}

        {isCustomInterest && (
          <label className="ai-custom-genre ai-custom-interest" htmlFor="ai-custom-interest-input">
            <span>직접 입력 관심사 *</span>
            <input
              aria-describedby="ai-custom-interest-help"
              id="ai-custom-interest-input"
              maxLength={LIMITS.customInterest}
              onChange={(event) => onCustomInterestChange(event.target.value)}
              placeholder={isCustomGenre ? `${genreLabel}에서 다루고 싶은 세부 관심사` : '예: 특정 시리즈, 주제, 활동'}
              ref={isCustomGenre ? firstOptionRef : undefined}
              value={customInterest}
            />
            <small className="idea-field-help" id="ai-custom-interest-help">
              공백을 제외한 관심사를 {LIMITS.customInterest}자 이내로 입력해 주세요.
            </small>
          </label>
        )}
      </fieldset>

      <div className="idea-form-actions ai-genre-actions">
        <button className="secondary-button" onClick={onBack} type="button">이전</button>
        <button className="primary-button" disabled={!canContinue} type="submit">다음</button>
      </div>
    </form>
  )
}

export default AIContentIdeaInterestStep
