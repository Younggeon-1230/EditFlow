import { useState } from 'react'
import ProjectCard from '../components/projects/ProjectCard'
import ProjectForm from '../components/projects/ProjectForm'
import ProjectSearchBar from '../components/projects/ProjectSearchBar'
import useProjects from '../hooks/useProjects'

function ProjectListPage() {
  const {
    filteredProjects,
    searchTerm,
    setSearchTerm,
    addProject,
    updateProject,
    deleteProject,
    syncError,
    isMigrating,
    migrateProjects,
  } = useProjects()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [migrationResult, setMigrationResult] = useState(null)

  function openCreateForm() {
    setEditingProject(null)
    setIsFormOpen(true)
  }

  function openEditForm(project) {
    setEditingProject(project)
    setIsFormOpen(true)
  }

  function closeForm() {
    setEditingProject(null)
    setIsFormOpen(false)
  }

  function handleSubmit(projectValues) {
    if (editingProject) {
      updateProject(editingProject.id, projectValues)
    } else {
      addProject(projectValues)
    }

    closeForm()
  }

  function handleDelete(project) {
    const shouldDelete = window.confirm(
      `"${project.title}" 프로젝트를 삭제하시겠습니까?`,
    )

    if (shouldDelete) {
      deleteProject(project.id)
    }
  }

  async function handleMigration() {
    const shouldMigrate = window.confirm(
      '아직 서버와 연결되지 않은 로컬 프로젝트를 동기화하시겠습니까?',
    )
    if (!shouldMigrate) {
      return
    }

    const result = await migrateProjects()
    if (result) {
      setMigrationResult(result)
    }
  }

  return (
    <main className="projects-page">
      <section className="projects-heading">
        <div>
          <p className="page-eyebrow">PROJECTS</p>
          <h1>프로젝트 목록</h1>
          <p>편집 프로젝트를 생성하고 진행 상태를 관리하세요.</p>
        </div>
        <div className="projects-heading-actions">
          <button
            className="secondary-button"
            disabled={isMigrating}
            onClick={handleMigration}
            type="button"
          >
            {isMigrating ? '동기화 중' : '프로젝트 서버 동기화'}
          </button>
          <button
            className="primary-button projects-create-button"
            onClick={openCreateForm}
          >
            <span aria-hidden="true">+</span> 새 프로젝트 만들기
          </button>
        </div>
      </section>

      <ProjectSearchBar value={searchTerm} onChange={setSearchTerm} />

      {syncError && (
        <section className="reference-state error-state" role="alert">
          <strong>서버 동기화 상태를 확인해 주세요.</strong>
          <p>{syncError}</p>
        </section>
      )}

      {migrationResult && (
        <section className="reference-state" role="status">
          <strong>프로젝트 서버 동기화 결과</strong>
          <p>
            성공 {migrationResult.migrated}개 · 건너뜀{' '}
            {migrationResult.skipped}개 · 실패 {migrationResult.failed}개
          </p>
        </section>
      )}

      {filteredProjects.length > 0 ? (
        <section className="project-grid" aria-label="프로젝트 목록">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
              onEdit={openEditForm}
            />
          ))}
        </section>
      ) : (
        <section className="projects-empty">
          <h2>
            {searchTerm ? '검색 결과가 없습니다.' : '아직 프로젝트가 없습니다.'}
          </h2>
          <p>
            {searchTerm
              ? '다른 프로젝트명으로 검색해 보세요.'
              : '새 프로젝트를 만들어 편집 작업을 시작하세요.'}
          </p>
          {!searchTerm && (
            <button className="secondary-button" onClick={openCreateForm}>
              프로젝트 만들기
            </button>
          )}
        </section>
      )}

      {isFormOpen && (
        <div className="form-overlay" role="presentation" onMouseDown={closeForm}>
          <section
            aria-labelledby="project-form-title"
            aria-modal="true"
            className="project-form-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="project-form-heading">
              <div>
                <p className="page-eyebrow">
                  {editingProject ? 'EDIT PROJECT' : 'NEW PROJECT'}
                </p>
                <h2 id="project-form-title">
                  {editingProject ? '프로젝트 수정' : '새 프로젝트 만들기'}
                </h2>
              </div>
              <button
                aria-label="폼 닫기"
                className="icon-button"
                onClick={closeForm}
                type="button"
              >
                ×
              </button>
            </div>
            <ProjectForm
              initialValue={editingProject}
              onCancel={closeForm}
              onSubmit={handleSubmit}
            />
          </section>
        </div>
      )}
    </main>
  )
}

export default ProjectListPage
