import { generatePath, Link } from 'react-router-dom'
import { ROUTES } from '../../constants/app'
import { getDday } from '../../utils/projectDates'
import { getProjectStatusLabel } from '../../services/projectsApi.js'

function ProjectCard({ project, onEdit, onDelete, projectKind = 'server' }) {
  const dueDate = project.dueDate ?? project.deadline ?? ''
  const checklistCompleted =
    project.checklistCompleted ?? project.checklistDone ?? 0
  const dday = getDday(dueDate)
  const rawChecklistProgress =
    project.checklistTotal > 0
      ? Math.round((checklistCompleted / project.checklistTotal) * 100)
      : 0
  const checklistProgress = Math.min(100, Math.max(0, rawChecklistProgress))

  return (
    <article className="project-card">
      <div className="project-card-topline">
        <span className="project-status">{getProjectStatusLabel(project.status)}</span>
        <span className="project-deadline">
          {dueDate ? `마감일 ${dueDate}` : '마감일 없음'}
          {dday && (
            <span className={`project-dday ${dday.kind}`}> · {dday.label}</span>
          )}
        </span>
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
            {checklistCompleted}/{project.checklistTotal} 완료
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
        <Link
          className="card-detail-button"
          to={generatePath(
            projectKind === 'local' ? ROUTES.localProjectDetail : ROUTES.projectDetail,
            projectKind === 'local'
              ? { localProjectId: project.id }
              : { projectId: project.id },
          )}
        >
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
