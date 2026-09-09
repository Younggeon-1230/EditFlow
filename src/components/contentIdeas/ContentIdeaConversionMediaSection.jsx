import { useState } from 'react'

function ConversionMediaThumbnail({ item, type }) {
  const [failed, setFailed] = useState(false)
  const source = item.thumbnailUrl
  const label = type === 'reference' ? 'Reference' : 'B-roll'

  return source && !failed ? (
    <img
      alt={`${item.title || label} 썸네일`}
      onError={() => setFailed(true)}
      src={source}
    />
  ) : (
    <span aria-hidden="true">{type === 'reference' ? 'YT' : 'B'}</span>
  )
}

function ContentIdeaConversionMediaSection({
  error,
  isDisabled,
  isLoading,
  items,
  onClear,
  onRetry,
  onSelectAll,
  onToggle,
  selectedIds,
  title,
  type,
}) {
  const headingId = `conversion-${type}-heading`

  return (
    <section aria-labelledby={headingId} className="idea-conversion-media-section">
      <div className="idea-conversion-media-heading">
        <div>
          <h4 id={headingId}>{title}</h4>
          {!isLoading && !error && (
            <span aria-live="polite">{selectedIds.size} / {items.length} 선택</span>
          )}
        </div>
        {!isLoading && !error && items.length > 0 && (
          <div className="idea-conversion-selection-actions">
            <button disabled={isDisabled || selectedIds.size === items.length} onClick={onSelectAll} type="button">전체 선택</button>
            <button disabled={isDisabled || selectedIds.size === 0} onClick={onClear} type="button">전체 해제</button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="idea-conversion-media-state" role="status">{title} 자료를 불러오는 중입니다.</p>
      ) : error ? (
        <div className="idea-conversion-media-state error" role="alert">
          <p>{error}</p>
          <button className="secondary-button" disabled={isDisabled} onClick={onRetry} type="button">다시 시도</button>
        </div>
      ) : items.length === 0 ? (
        <p className="idea-conversion-media-state">연결된 {title} 자료가 없습니다.</p>
      ) : (
        <div className="idea-conversion-media-list">
          {items.map((item) => {
            const checked = selectedIds.has(item.id)
            const metadata = type === 'reference'
              ? [item.provider || 'YouTube', item.channelTitle].filter(Boolean).join(' · ')
              : [item.provider || 'Pexels', item.creatorName].filter(Boolean).join(' · ')
            return (
              <label className={`idea-conversion-media-row${checked ? ' selected' : ''}`} key={item.id}>
                <input checked={checked} disabled={isDisabled} onChange={() => onToggle(item.id)} type="checkbox" />
                <span className="idea-conversion-media-thumbnail">
                  <ConversionMediaThumbnail item={item} type={type} />
                </span>
                <span className="idea-conversion-media-copy">
                  <strong>{item.title || 'B-roll 영상'}</strong>
                  <small>{metadata}</small>
                </span>
              </label>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default ContentIdeaConversionMediaSection
