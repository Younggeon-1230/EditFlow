function ContentIdeaSummary({ summary, isLoading, error, onRetry }) {
  if (error && !summary) {
    return <section className="idea-summary-error" role="alert"><span>콘텐츠 소재 통계를 불러오지 못했습니다.</span><button className="secondary-button" onClick={onRetry} type="button">다시 시도</button></section>
  }

  const stats = [
    ['전체 소재', summary?.total ?? '–'],
    ['진행 중', summary?.activeCount ?? '–'],
    ['제작 준비', summary?.readyCount ?? '–'],
    ['프로젝트 전환', summary?.convertedCount ?? '–'],
  ]
  return (
    <section aria-label="콘텐츠 소재 요약" aria-live="polite">
      <div className="idea-summary-grid">
        {stats.map(([label, value]) => <div className="idea-summary-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <p className="idea-media-summary">
        미디어 연결 <strong>{summary?.withAnyMediaCount ?? '–'}</strong>
        <span>Reference {summary?.withReferenceCount ?? '–'}</span>
        <span>B-roll {summary?.withBrollCount ?? '–'}</span>
        {isLoading && summary && <span role="status">통계 갱신 중…</span>}
      </p>
      {error && summary && <p className="idea-summary-inline-error" role="alert">최신 통계를 불러오지 못했습니다. <button onClick={onRetry} type="button">다시 시도</button></p>}
    </section>
  )
}

export default ContentIdeaSummary
