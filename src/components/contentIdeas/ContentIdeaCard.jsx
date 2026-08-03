import {
  CONTENT_IDEA_PLATFORMS,
  CONTENT_IDEA_SOURCES,
} from '../../constants/contentIdeas.js'
import ContentIdeaStatusBadge from './ContentIdeaStatusBadge.jsx'

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
}

function ContentIdeaCard({ idea, onEdit, onDelete, isUpdating, isDeleting }) {
  const disabled = isUpdating || isDeleting
  return (
    <article className="idea-card">
      <div className="idea-card-badges">
        <span className="idea-platform-badge">{CONTENT_IDEA_PLATFORMS[idea.platform] ?? idea.platform}</span>
        <ContentIdeaStatusBadge value={idea.status} />
        <ContentIdeaStatusBadge type="priority" value={idea.priority} />
      </div>
      <h2>{idea.title}</h2>
      {idea.description && <p className="idea-description">{idea.description}</p>}
      {idea.tags.length > 0 && <div className="idea-tags" aria-label="태그">{idea.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
      <dl className="idea-meta">
        {idea.targetAudience && <><dt>타깃 시청자</dt><dd>{idea.targetAudience}</dd></>}
        {idea.contentFormat && <><dt>콘텐츠 형식</dt><dd>{idea.contentFormat}</dd></>}
        <dt>출처</dt><dd>{CONTENT_IDEA_SOURCES[idea.source] ?? idea.source}</dd>
        <dt>등록일</dt><dd>{formatDate(idea.createdAt)}</dd>
      </dl>
      {idea.convertedProjectId && <p className="idea-converted-note">프로젝트 전환 완료</p>}
      <div className="idea-card-actions">
        <button className="secondary-button" disabled={disabled} onClick={() => onEdit(idea)} type="button">수정</button>
        <button className="idea-delete-button" disabled={disabled} onClick={() => onDelete(idea)} type="button">{isDeleting ? '삭제 중…' : '삭제'}</button>
      </div>
    </article>
  )
}

export default ContentIdeaCard
