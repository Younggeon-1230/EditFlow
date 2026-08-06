import {
  CONTENT_IDEA_PLATFORMS,
  CONTENT_IDEA_SOURCES,
} from '../../constants/contentIdeas.js'

function AIContentIdeaRecommendationCard({
  item,
  isSelected,
  isSaving,
  isSaved,
  isUnavailable,
  itemError,
  isBatchSaving,
  onSelect,
  onSave,
}) {
  const disabled = isSaving || isSaved || isUnavailable || isBatchSaving
  return (
    <article className={`ai-recommendation-card${isSaved ? ' is-saved' : ''}${itemError ? ' has-error' : ''}`}>
      <div className="ai-recommendation-card-heading">
        <label className="ai-recommendation-select">
          <input checked={isSelected} disabled={disabled} onChange={onSelect} type="checkbox" />
          <span className="sr-only">{item.title} 선택</span>
        </label>
        <div className="idea-card-badges">
          <span className="idea-platform-badge">{CONTENT_IDEA_PLATFORMS[item.platform] ?? item.platform}</span>
          <span className="idea-badge ai-source-badge">{CONTENT_IDEA_SOURCES[item.source] ?? 'AI 추천'}</span>
          {isSaved && <span className="idea-badge ai-saved-badge">저장 완료</span>}
        </div>
      </div>
      <h3>{item.title}</h3>
      {item.description && <p className="ai-recommendation-description">{item.description}</p>}
      {item.tags.length > 0 && <div className="idea-tags" aria-label="태그">{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      <dl className="idea-meta ai-recommendation-meta">
        {item.targetAudience && <><dt>대상 시청자</dt><dd>{item.targetAudience}</dd></>}
        {item.contentFormat && <><dt>콘텐츠 형식</dt><dd>{item.contentFormat}</dd></>}
      </dl>
      <div className="ai-recommendation-reason">
        <strong>추천 이유</strong>
        <p>{item.reason}</p>
      </div>
      {item.duplicateWarning && <p className="ai-duplicate-warning" role="status">기존 소재와 제목이 겹칠 가능성이 있습니다. 확인 후 저장해 주세요.</p>}
      {itemError && (
        <div className="ai-item-error" role="alert">
          <p>{itemError.message}</p>
          {itemError.requestId && <small>요청 ID: {itemError.requestId}</small>}
        </div>
      )}
      <div className="ai-recommendation-card-actions">
        <button className={isSaved ? 'secondary-button' : 'primary-button'} disabled={disabled} onClick={onSave} type="button">
          {isSaved ? '저장됨' : isUnavailable ? '저장 불가' : isSaving ? '저장 중…' : itemError?.retryable ? '저장 다시 시도' : '이 소재 저장'}
        </button>
      </div>
    </article>
  )
}

export default AIContentIdeaRecommendationCard
