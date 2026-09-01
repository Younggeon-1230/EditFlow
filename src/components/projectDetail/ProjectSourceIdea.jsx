import { generatePath, Link } from 'react-router-dom'
import { CONTENT_IDEA_SOURCES } from '../../constants/contentIdeas.js'
import { ROUTES } from '../../constants/app.js'
import ContentIdeaStatusBadge from '../contentIdeas/ContentIdeaStatusBadge.jsx'

function ProjectSourceIdea({ project, relation }) {
  const usesBackend = Number.isInteger(project.backendProjectId) && project.backendProjectId > 0

  return (
    <section aria-labelledby="project-source-idea-title" className="project-source-idea relationship-card">
      <div className="relationship-card-heading">
        <div>
          <p className="page-eyebrow">SOURCE IDEA</p>
          <h2 id="project-source-idea-title">원본 콘텐츠 소재</h2>
        </div>
      </div>

      {!usesBackend ? (
        <p>이 로컬 프로젝트에는 연결된 서버 콘텐츠 소재 정보가 없습니다.</p>
      ) : relation.isLoading ? (
        <p role="status">원본 콘텐츠 소재를 확인하고 있습니다.</p>
      ) : relation.error ? (
        <p className="relationship-error" role="alert">{relation.error}</p>
      ) : relation.idea ? (
        <div className="project-source-idea-content">
          <div className="relationship-badges">
            <ContentIdeaStatusBadge value={relation.idea.status} />
            <span className="idea-badge">{CONTENT_IDEA_SOURCES[relation.idea.source] ?? relation.idea.source}</span>
          </div>
          <strong>{relation.idea.title}</strong>
          <Link className="secondary-button link-button" to={generatePath(ROUTES.ideaDetail, { ideaId: relation.idea.id })}>
            원본 소재 보기
          </Link>
        </div>
      ) : (
        <p>Content Idea에서 전환된 프로젝트가 아닙니다.</p>
      )}
    </section>
  )
}

export default ProjectSourceIdea
