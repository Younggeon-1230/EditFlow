import { Link } from 'react-router-dom'

function ProjectCard({ project, onEdit, onDelete }) {
  const rawChecklistProgress =
    project.checklistTotal > 0
      ? Math.round((project.checklistDone / project.checklistTotal) * 100)
      : 0
  const checklistProgress = Math.min(100, Math.max(0, rawChecklistProgress))

  return (
    <article className="project-card">
      <div className="project-card-topline">
        <span className="project-status">{project.status}</span>
        <span className="project-deadline">마감일 {project.deadline}</span>
      </div>

      <div className="project-card-copy">
        <h2>{project.title}</h2>
        <p>{project.description}</p>
      </div>

      <dl className="project-counts">
        <div>
          <dt>레퍼런스</dt>
          <dd>{project.referenceCount}개</dd>
        </div>
        <div>
          <dt>B-roll</dt>
          <dd>{project.brollCount}개</dd>
        </div>
      </dl>

      <div className="checklist-progress">
        <div className="checklist-progress-label">
          <span>체크리스트</span>
          <strong>
            {project.checklistDone}/{project.checklistTotal} 완료
          </strong>
        </div>
        <div
          aria-label={`체크리스트 진행률 ${checklistProgress}%`}
          aria-valuemax="100"
          aria-valuemin="0"
          aria-valuenow={checklistProgress}
          className="progress-track"
          role="progressbar"
        >
          <span style={{ width: `${checklistProgress}%` }} />
        </div>
      </div>

      <div className="project-card-actions">
        <Link className="card-detail-button" to={`/projects/${project.id}`}>
          상세보기
        </Link>
        <button className="card-action-button" onClick={() => onEdit(project)}>
          수정
        </button>
        <button
          className="card-action-button delete"
          onClick={() => onDelete(project)}
        >
          삭제
        </button>
      </div>
    </article>
  )
}

export default ProjectCard
