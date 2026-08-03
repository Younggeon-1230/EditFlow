function ProjectInfo({
  project,
  disabled = false,
  onEdit,
  onChangeStatus,
  onDelete,
}) {
  return (
    <section className="project-info">
      <div className="project-info-main">
        <div className="project-info-labels">
          <span className="project-status">{project.status}</span>
          <span>
            {project.deadline ? `마감일 ${project.deadline}` : '마감일 없음'}
          </span>
        </div>
        <h1>{project.title}</h1>
        <p>{project.description || '등록된 프로젝트 설명이 없습니다.'}</p>
      </div>

      <div className="project-info-actions" aria-label="프로젝트 관리">
        <button
          className="card-action-button"
          disabled={disabled}
          onClick={onEdit}
          type="button"
        >
          수정
        </button>
        <button
          className="card-action-button"
          disabled={disabled}
          onClick={onChangeStatus}
          type="button"
        >
          상태 변경
        </button>
        <button
          className="card-action-button delete"
          disabled={disabled}
          onClick={onDelete}
          type="button"
        >
          {disabled ? '처리 중' : '삭제'}
        </button>
      </div>
    </section>
  )
}

export default ProjectInfo
