import AIContentIdeaRecommendationCard from './AIContentIdeaRecommendationCard.jsx'

function AIContentIdeaRecommendationList({ state, onSaveOne, onSaveSelected }) {
  const allSelected = state.availableCount > 0 && state.selectedAvailableCount === state.availableCount
  return (
    <section aria-labelledby="ai-recommendation-results-title" className="ai-recommendation-results">
      <div className="ai-recommendation-results-heading">
        <div>
          <p className="page-eyebrow">AI RESULTS</p>
          <h3 id="ai-recommendation-results-title">추천 소재 {state.recommendations.length}개</h3>
          {state.responseMeta?.discardedCount > 0 && <p>{state.responseMeta.discardedCount}개의 유효하지 않거나 중복된 결과를 제외했습니다.</p>}
        </div>
        <label className="ai-select-all">
          <input checked={allSelected} disabled={state.availableCount === 0 || state.isSavingBatch || state.isGenerating} onChange={state.selectAllAvailable} type="checkbox" />
          <span>저장 가능한 소재 전체 선택</span>
        </label>
      </div>

      <div className="ai-recommendation-grid">
        {state.recommendations.map((item) => (
          <AIContentIdeaRecommendationCard
            isBatchSaving={state.isSavingBatch || state.isGenerating}
            isSaved={state.savedKeys.has(item.clientKey)}
            isSaving={state.savingKeys.has(item.clientKey)}
            isSelected={state.selectedKeys.has(item.clientKey)}
            isUnavailable={state.unavailableKeys.has(item.clientKey)}
            item={item}
            itemError={state.itemErrors[item.clientKey]}
            key={item.clientKey}
            onSave={() => onSaveOne(item.clientKey)}
            onSelect={() => state.toggleSelection(item.clientKey)}
          />
        ))}
      </div>

      <div className="ai-recommendation-save-bar">
        <div aria-live="polite">
          <strong>{state.selectedAvailableCount}개 선택</strong>
          <span>저장 완료 {state.savedKeys.size}개</span>
        </div>
        <button className="primary-button" disabled={!state.selectedAvailableCount || state.isSavingBatch || state.savingKeys.size > 0 || state.isGenerating} onClick={onSaveSelected} type="button">
          {state.isSavingBatch ? '선택 소재 저장 중…' : '선택 소재 저장'}
        </button>
      </div>
    </section>
  )
}

export default AIContentIdeaRecommendationList
