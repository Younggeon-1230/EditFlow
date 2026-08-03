import SavedMediaControls from './SavedMediaControls'

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return null
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function BrollPanel({
  items,
  isLoading = false,
  error = null,
  onChangeNote,
  onRemove,
  isUpdatingItem = () => false,
  isDeletingItem = () => false,
}) {
  const canManage = Boolean(onChangeNote && onRemove)

  if (isLoading && items.length === 0) {
    return <div className="reference-state">저장된 B-roll을 불러오고 있습니다.</div>
  }

  return (
    <>
      {error && (
        <div className="reference-state error-state" role="alert">
          {error}
        </div>
      )}
      {items.length === 0 ? (
        <div className="reference-state empty-state">
          저장된 B-roll이 없습니다.
        </div>
      ) : (
        <div className="detail-resource-list">
          {items.map((broll) => {
            const duration = formatDuration(broll.durationSeconds)
            const resolution =
              broll.width && broll.height
                ? `${broll.width}×${broll.height}`
                : null

            return (
              <article
                className="detail-resource-card saved-media-card"
                key={broll.id}
              >
                <div className="saved-media-card__thumbnail">
                  {broll.thumbnailUrl ? (
                    <img
                      alt={`${broll.title || 'B-roll'} 썸네일`}
                      className="resource-preview broll-preview"
                      src={broll.thumbnailUrl}
                    />
                  ) : (
                    <div
                      className="resource-preview broll-preview"
                      aria-hidden="true"
                    >
                      <span>{broll.type}</span>
                    </div>
                  )}
                </div>
                <div className="resource-copy saved-media-card__content">
                  <header className="saved-media-card__header">
                    <p className="resource-type">B-ROLL SOURCE</p>
                    <h2>{broll.title || 'B-roll 영상'}</h2>
                    <div className="resource-meta">
                      {broll.creatorName || broll.author ? (
                        <span>작가 {broll.creatorName ?? broll.author}</span>
                      ) : null}
                      {duration && <span>길이 {duration}</span>}
                      {resolution && <span>해상도 {resolution}</span>}
                      {broll.previewUrl && (
                        <a
                          href={broll.previewUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          미리보기
                        </a>
                      )}
                    </div>
                  </header>
                  {canManage ? (
                    <SavedMediaControls
                      isDeleting={isDeletingItem(broll.id)}
                      isUpdating={isUpdatingItem(broll.id)}
                      item={broll}
                      itemLabel="B-roll"
                      onChangeNote={onChangeNote}
                      onRemove={onRemove}
                      originalUrl={broll.url ?? broll.originalUrl}
                    />
                  ) : broll.url || broll.originalUrl ? (
                    <div className="saved-media-actions">
                      <a
                        className="secondary-button"
                        href={broll.url ?? broll.originalUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        원본 보기
                      </a>
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}

export default BrollPanel
