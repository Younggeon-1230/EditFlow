import formatDate from '../../utils/formatDate'
import formatNumber from '../../utils/formatNumber'
import SaveToProjectButton from './SaveToProjectButton'

function ReferenceResultCard({ video }) {
  return (
    <article className="reference-result-card">
      <a
        className="youtube-thumbnail"
        href={video.videoUrl}
        rel="noreferrer"
        target="_blank"
      >
        <img alt={`${video.title} 썸네일`} src={video.thumbnailUrl} />
        <span aria-hidden="true">▶</span>
      </a>

      <div className="youtube-result-copy">
        <p className="resource-type">YOUTUBE VIDEO</p>
        <h3>{video.title}</h3>
        <p className="youtube-channel">{video.channelTitle}</p>
        <dl className="youtube-statistics">
          <div>
            <dt>조회수</dt>
            <dd>{formatNumber(video.viewCount)}</dd>
          </div>
          <div>
            <dt>좋아요</dt>
            <dd>{formatNumber(video.likeCount)}</dd>
          </div>
          <div>
            <dt>댓글</dt>
            <dd>{formatNumber(video.commentCount)}</dd>
          </div>
          <div>
            <dt>업로드</dt>
            <dd>{formatDate(video.publishedAt)}</dd>
          </div>
        </dl>
      </div>

      <div className="youtube-result-actions">
        <a
          className="secondary-button"
          href={video.videoUrl}
          rel="noreferrer"
          target="_blank"
        >
          영상 보기
        </a>
        <SaveToProjectButton video={video} />
      </div>
    </article>
  )
}

export default ReferenceResultCard
