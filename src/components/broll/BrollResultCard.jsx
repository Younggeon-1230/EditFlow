import SaveBrollButton from './SaveBrollButton'

function BrollResultCard({ asset }) {
  return (
    <article className="broll-result-card">
      <a
        className="broll-preview-image"
        href={asset.originalUrl}
        rel="noreferrer"
        target="_blank"
      >
        <img alt={`${asset.creatorName}의 ${asset.type} 소스`} src={asset.thumbnailUrl} />
        <span>{asset.type}</span>
      </a>

      <div className="broll-result-body">
        <p className="resource-type">PEXELS {asset.type.toUpperCase()}</p>
        <h3>{asset.title}</h3>
        <p className="broll-creator">by {asset.creatorName}</p>

        <div className="broll-result-actions">
          <a
            className="secondary-button"
            href={asset.originalUrl}
            rel="noreferrer"
            target="_blank"
          >
            원본 보기
          </a>
          <SaveBrollButton asset={asset} />
        </div>
      </div>
    </article>
  )
}

export default BrollResultCard
