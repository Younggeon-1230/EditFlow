function BrollPanel({ items }) {
  return (
    <div className="detail-resource-list">
      {items.map((broll) => (
        <article className="detail-resource-card" key={broll.id}>
          <div className="resource-preview broll-preview" aria-hidden="true">
            <span>{broll.type}</span>
          </div>
          <div className="resource-copy">
            <p className="resource-type">B-ROLL SOURCE</p>
            <h2>{broll.title}</h2>
            <div className="resource-meta">
              <span>타입 {broll.type}</span>
              <span>작가 {broll.author}</span>
            </div>
          </div>
          <button className="secondary-button resource-button" type="button">
            원본 보기
          </button>
        </article>
      ))}
    </div>
  )
}

export default BrollPanel
