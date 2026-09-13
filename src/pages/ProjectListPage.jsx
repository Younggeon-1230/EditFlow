import { useMemo, useState } from 'react'
import ProjectCard from '../components/projects/ProjectCard'
import ProjectForm from '../components/projects/ProjectForm'
import ProjectSearchBar from '../components/projects/ProjectSearchBar'
import useLegacyProjects from '../hooks/useLegacyProjects.js'
import useProjectMutations from '../hooks/useProjectMutations.js'
import useServerProjects from '../hooks/useServerProjects.js'

function filterProjects(projects, searchTerm) {
  const query = searchTerm.trim().toLocaleLowerCase('ko-KR')
  return query ? projects.filter((project) => project.title.toLocaleLowerCase('ko-KR').includes(query)) : projects
}

function ProjectListPage() {
  const server = useServerProjects()
  const legacy = useLegacyProjects(server.projects, server.hasResult)
  const mutations = useProjectMutations({ onServerChanged: server.refetch, onLocalChanged: legacy.reload })
  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [migrationResult, setMigrationResult] = useState(null)
  const serverProjects = useMemo(() => filterProjects(server.projects, searchTerm), [server.projects, searchTerm])
  const localProjects = useMemo(() => filterProjects(legacy.projects, searchTerm), [legacy.projects, searchTerm])

  function openForm(project = null, projectKind = 'local') {
    setEditing(project ? { project, projectKind } : null)
    setIsFormOpen(true)
  }

  async function handleSubmit(values) {
    const saved = editing
      ? await mutations.updateProject(editing.project, values, editing.projectKind)
      : await mutations.addProject(values)
    if (saved) setIsFormOpen(false)
    return saved
  }

  async function handleDelete(project, projectKind) {
    if (window.confirm(`“${project.title}” 프로젝트를 삭제하시겠습니까?`)) {
      await mutations.deleteProject(project, projectKind)
    }
  }

  async function handleMigration() {
    if (!window.confirm('서버와 연결되지 않은 로컬 프로젝트를 동기화하시겠습니까?')) return
    const result = await mutations.migrateProjects()
    if (result) setMigrationResult(result)
  }

  return (
    <main className="projects-page">
      <section className="projects-heading">
        <div><p className="page-eyebrow">PROJECTS</p><h1>프로젝트 목록</h1><p>서버 프로젝트와 이 브라우저에만 남은 프로젝트를 구분해 관리합니다.</p></div>
        <button className="primary-button projects-create-button" onClick={() => openForm()} type="button"><span aria-hidden="true">+</span> 새 프로젝트 만들기</button>
      </section>
      <ProjectSearchBar value={searchTerm} onChange={setSearchTerm} />
      {mutations.error && <section className="reference-state error-state" role="alert"><p>{mutations.error}</p></section>}

      <section aria-labelledby="server-projects-title">
        <div className="projects-section-heading"><div><p className="page-eyebrow">SERVER</p><h2 id="server-projects-title">서버 프로젝트</h2></div></div>
        {server.isLoading && server.projects.length === 0 ? (
          <div className="reference-state" role="status"><p>서버 프로젝트를 불러오는 중입니다.</p></div>
        ) : server.error ? (
          <div className="reference-state error-state" role="alert"><strong>서버 프로젝트를 불러오지 못했습니다.</strong><p>{server.error}</p><button className="secondary-button" onClick={server.refetch} type="button">다시 시도</button></div>
        ) : serverProjects.length > 0 ? (
          <div className="project-grid" aria-label="서버 프로젝트 목록">{serverProjects.map((project) => <ProjectCard key={project.id} project={project} projectKind="server" onEdit={(item) => openForm(item, 'server')} onDelete={(item) => handleDelete(item, 'server')} />)}</div>
        ) : (
          <div className="projects-empty"><h2>{searchTerm ? '검색 결과가 없습니다.' : '서버 프로젝트가 없습니다.'}</h2><p>{searchTerm ? '다른 프로젝트명으로 검색해 보세요.' : '새 프로젝트를 만들어 작업을 시작하세요.'}</p></div>
        )}
      </section>

      <section aria-labelledby="local-projects-title" className="legacy-projects-section">
        <div className="projects-section-heading"><div><p className="page-eyebrow">LOCAL / LEGACY</p><h2 id="local-projects-title">로컬에만 저장된 프로젝트</h2><p>현재 사용자 브라우저 저장소에만 있거나 서버 연결이 오래된 항목입니다.</p></div>{localProjects.length > 0 && <button className="secondary-button" disabled={mutations.isMigrating} onClick={handleMigration} type="button">{mutations.isMigrating ? '동기화 중…' : '로컬 프로젝트 서버 동기화'}</button>}</div>
        {migrationResult && <div className="reference-state" role="status"><p>성공 {migrationResult.migrated}개 · 건너뜀 {migrationResult.skipped}개 · 실패 {migrationResult.failed}개</p></div>}
        {localProjects.length > 0 ? <div className="project-grid" aria-label="로컬 프로젝트 목록">{localProjects.map((project) => <ProjectCard key={project.id} project={project} projectKind="local" onEdit={(item) => openForm(item, 'local')} onDelete={(item) => handleDelete(item, 'local')} />)}</div> : <div className="projects-empty compact"><p>{searchTerm ? '조건에 맞는 로컬 프로젝트가 없습니다.' : '로컬에만 남은 프로젝트가 없습니다.'}</p></div>}
      </section>

      {isFormOpen && <div className="form-overlay" role="presentation" onMouseDown={() => setIsFormOpen(false)}><section aria-labelledby="project-form-title" aria-modal="true" className="project-form-dialog" role="dialog" onMouseDown={(event) => event.stopPropagation()}><div className="project-form-heading"><div><p className="page-eyebrow">{editing ? 'EDIT PROJECT' : 'NEW PROJECT'}</p><h2 id="project-form-title">{editing ? '프로젝트 수정' : '새 프로젝트 만들기'}</h2></div><button aria-label="폼 닫기" className="icon-button" onClick={() => setIsFormOpen(false)} type="button">×</button></div><ProjectForm initialValue={editing?.project} isSubmitting={mutations.isCreating} onCancel={() => setIsFormOpen(false)} onSubmit={handleSubmit} /></section></div>}
    </main>
  )
}

export default ProjectListPage
