import {
  CONTENT_IDEA_PLATFORMS,
  CONTENT_IDEA_SOURCES,
} from '../../constants/contentIdeas.js'
import ContentIdeaStatusBadge from './ContentIdeaStatusBadge.jsx'
import { generatePath, Link } from 'react-router-dom'
import { ROUTES } from '../../constants/app.js'
import { useState } from 'react'
import ContentIdeaMediaPanel from './ContentIdeaMediaPanel.jsx'

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
}

function ContentIdeaCard({ idea, onEdit, onDelete, onConvert, onMediaChanged, localProjectId, isUpdating, isDeleting, isConverting }) {
  const [isMediaOpen, setIsMediaOpen] = useState(false)
  const disabled = isUpdating || isDeleting || isConverting
  const canConvert = !idea.convertedProjectId && ['idea', 'researching', 'ready'].includes(idea.status)
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
      {(idea.status === 'converted' || idea.convertedProjectId) && <p className="idea-converted-note">프로젝트 전환 완료</p>}
      <div className="idea-card-actions">
        {canConvert && <button className="primary-button idea-convert-button" disabled={disabled} onClick={() => onConvert(idea)} type="button">{isConverting ? '전환 중…' : '프로젝트로 전환'}</button>}
        {idea.status === 'archived' && !idea.convertedProjectId && <button className="secondary-button" disabled title="보관된 소재는 전환할 수 없습니다." type="button">전환 불가</button>}
        {localProjectId && <Link className="secondary-button link-button" to={generatePath(ROUTES.projectDetail, { projectId: localProjectId })}>프로젝트 보기</Link>}
        <button className="secondary-button" disabled={disabled} onClick={() => onEdit(idea)} type="button">수정</button>
        <button aria-expanded={isMediaOpen} className="secondary-button" onClick={() => setIsMediaOpen((open) => !open)} type="button">{isMediaOpen ? '연결 자료 닫기' : '연결 자료 관리'}</button>
        <button className="idea-delete-button" disabled={disabled} onClick={() => onDelete(idea)} type="button">{isDeleting ? '삭제 중…' : '삭제'}</button>
      </div>
      {isMediaOpen && <ContentIdeaMediaPanel idea={idea} onMediaChanged={onMediaChanged} />}
    </article>
  )
}

export default ContentIdeaCard
