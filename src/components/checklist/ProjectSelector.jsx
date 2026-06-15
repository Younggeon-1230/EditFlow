function ProjectSelector({ projects, selectedProjectId, onChange }) {
  return (
    <section className="checklist-project-selector">
      <div>
        <p className="resource-type">SELECT PROJECT</p>
        <label htmlFor="checklist-project">프로젝트 선택</label>
      </div>

      {projects.length > 0 ? (
        <select
          id="checklist-project"
          onChange={(event) => onChange(event.target.value)}
          value={selectedProjectId}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      ) : (
        <p>프로젝트를 먼저 생성해주세요.</p>
      )}
    </section>
  )
}

export default ProjectSelector
