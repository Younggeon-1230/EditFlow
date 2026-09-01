import {
  CONTENT_IDEA_RECOMMENDATION_GENRES as GENRES,
  CONTENT_IDEA_RECOMMENDATION_LIMITS as LIMITS,
} from '../../constants/contentIdeas.js'

function AIContentIdeaGenreStep({
  selectedGenre,
  customGenre,
  firstOptionRef,
  onGenreChange,
  onCustomGenreChange,
  onCancel,
  onNext,
}) {
  const isCustom = selectedGenre === 'custom'
  const canContinue = Boolean(selectedGenre) && (!isCustom || Boolean(customGenre.trim()))

  function handleSubmit(event) {
    event.preventDefault()
    if (canContinue) onNext()
  }

  return (
    <form className="ai-genre-step" noValidate onSubmit={handleSubmit}>
      <div className="ai-recommendation-step-heading">
        <p className="ai-recommendation-step-label">1 / 2 · 장르 선택</p>
        <h3 id="ai-genre-heading">어떤 분야의 영상을 만들고 싶나요?</h3>
        <p id="ai-genre-description">가장 가까운 장르를 고르면 다음 단계의 추천 조건에 자연스럽게 반영합니다.</p>
      </div>

      <fieldset aria-describedby="ai-genre-description" className="ai-genre-fieldset">
        <legend className="sr-only">콘텐츠 장르</legend>
        <div className="ai-genre-grid">
          {GENRES.map((genre, index) => {
            const isSelected = selectedGenre === genre.value
            return (
              <label className={`ai-genre-option${isSelected ? ' is-selected' : ''}`} key={genre.value}>
                <input
                  aria-describedby={`ai-genre-${genre.value}-description`}
                  checked={isSelected}
                  name="ai-content-genre"
                  onChange={() => onGenreChange(genre.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      onGenreChange(genre.value)
                    }
                  }}
                  ref={index === 0 ? firstOptionRef : undefined}
                  type="radio"
                  value={genre.value}
                />
                <span className="ai-genre-option-copy">
                  <strong>{genre.label}</strong>
                  <span id={`ai-genre-${genre.value}-description`}>{genre.description}</span>
                </span>
                <span aria-hidden="true" className="ai-genre-selected-indicator">
                  {isSelected ? '✓ 선택됨' : '선택'}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {isCustom && (
        <label className="ai-custom-genre" htmlFor="ai-custom-genre-input">
          <span>직접 입력 장르 *</span>
          <input
            aria-describedby="ai-custom-genre-help"
            id="ai-custom-genre-input"
            maxLength={LIMITS.customGenre}
            onChange={(event) => onCustomGenreChange(event.target.value)}
            placeholder="예: 반려동물, 음악, 자동차"
            value={customGenre}
          />
          <small className="idea-field-help" id="ai-custom-genre-help">
            공백을 제외한 장르명을 {LIMITS.customGenre}자 이내로 입력해 주세요.
          </small>
        </label>
      )}

      <div className="idea-form-actions ai-genre-actions">
        <button className="secondary-button" onClick={onCancel} type="button">취소</button>
        <button className="primary-button" disabled={!canContinue} type="submit">다음</button>
      </div>
    </form>
  )
}

export default AIContentIdeaGenreStep
