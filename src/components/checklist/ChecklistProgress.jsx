function ChecklistProgress({ completedCount, totalCount }) {
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <section className="checklist-progress-card">
      <div className="checklist-progress-copy">
        <div>
          <p className="resource-type">PROGRESS</p>
          <h2>
            진행률 {completedCount} / {totalCount}
          </h2>
        </div>
        <strong>{progress}%</strong>
      </div>
      <div
        aria-label={`체크리스트 진행률 ${progress}%`}
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow={progress}
        className="checklist-page-progress-track"
        role="progressbar"
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </section>
  )
}

export default ChecklistProgress
