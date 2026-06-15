function ThumbnailPanel({ items }) {
  return (
    <div className="thumbnail-grid">
      {items.map((thumbnail, index) => (
        <article className="thumbnail-card" key={thumbnail.id}>
          <div
            className={`resource-preview thumbnail-preview variant-${index + 1}`}
            aria-hidden="true"
          >
            <span>THUMBNAIL</span>
          </div>
          <div className="thumbnail-card-body">
            <h2>{thumbnail.title}</h2>
            <p>{thumbnail.memo}</p>
            <button className="secondary-button" type="button">
              보기
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

export default ThumbnailPanel
