function ReferencePanel({ items }) {
  return (
    <div className="detail-resource-list">
      {items.map((reference) => (
        <article className="detail-resource-card reference-card" key={reference.id}>
          <div className="resource-preview video-preview" aria-hidden="true">
            <span>16:9</span>
          </div>
          <div className="resource-copy">
            <p className="resource-type">YOUTUBE REFERENCE</p>
            <h2>{reference.title}</h2>
            <p>{reference.channelTitle}</p>
            <div className="resource-meta">
              <span>조회수 {reference.views}회</span>
              <span>{reference.publishedAt}</span>
            </div>
          </div>
          <button className="secondary-button resource-button" type="button">
            보기
          </button>
        </article>
      ))}
    </div>
  )
}

export default ReferencePanel
