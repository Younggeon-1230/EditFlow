import formatDate from '../../utils/formatDate'
import SavedMediaControls from './SavedMediaControls'

function ReferencePanel({
  items,
  isLoading = false,
  error = null,
  onChangeNote,
  onRemove,
  isUpdatingItem = () => false,
  isDeletingItem = () => false,
  removeConfirmMessage,
}) {
  const canManage = Boolean(onChangeNote && onRemove)

  if (isLoading && items.length === 0) {
    return <div className="reference-state">저장된 레퍼런스를 불러오고 있습니다.</div>
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
          저장된 레퍼런스가 없습니다.
        </div>
      ) : (
        <div className="detail-resource-list">
          {items.map((reference) => (
            <article
              className="detail-resource-card saved-media-card"
              key={reference.id}
            >
              <div className="saved-media-card__thumbnail">
                {reference.thumbnailUrl ? (
                  <img
                    alt={`${reference.title} 썸네일`}
                    className="resource-preview video-preview"
                    src={reference.thumbnailUrl}
                  />
                ) : (
                  <div
                    className="resource-preview video-preview"
                    aria-hidden="true"
                  >
                    <span>16:9</span>
                  </div>
                )}
              </div>
              <div className="resource-copy saved-media-card__content">
                <header className="saved-media-card__header">
                  <p className="resource-type">YOUTUBE REFERENCE</p>
                  <h2>{reference.title}</h2>
                  {reference.channelTitle && <p>{reference.channelTitle}</p>}
                  <div className="resource-meta">
                    {reference.views && <span>조회수 {reference.views}회</span>}
                    {reference.publishedAt && (
                      <span>{formatDate(reference.publishedAt)}</span>
                    )}
                  </div>
                </header>
                {canManage ? (
                  <SavedMediaControls
                    isDeleting={isDeletingItem(reference.id)}
                    isUpdating={isUpdatingItem(reference.id)}
                    item={reference}
                    itemLabel="레퍼런스"
                    onChangeNote={onChangeNote}
                    onRemove={onRemove}
                    originalUrl={reference.url ?? reference.videoUrl}
                    removeConfirmMessage={removeConfirmMessage}
                  />
                ) : reference.url || reference.videoUrl ? (
                  <div className="saved-media-actions">
                    <a
                      className="secondary-button"
                      href={reference.url ?? reference.videoUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      원본 보기
                    </a>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

export default ReferencePanel
