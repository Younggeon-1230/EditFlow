function ProjectInfo({ project }) {
  return (
    <section className="project-info">
      <div className="project-info-main">
        <div className="project-info-labels">
          <span className="project-status">{project.status}</span>
          <span>마감일 {project.deadline}</span>
        </div>
        <h1>{project.title}</h1>
        <p>{project.description || '등록된 프로젝트 설명이 없습니다.'}</p>
      </div>

      <div className="project-info-actions" aria-label="프로젝트 관리">
        <button className="card-action-button" type="button">
          수정
        </button>
        <button className="card-action-button" type="button">
          상태 변경
        </button>
        <button className="card-action-button delete" type="button">
          삭제
        </button>
      </div>
    </section>
  )
}

export default ProjectInfo
