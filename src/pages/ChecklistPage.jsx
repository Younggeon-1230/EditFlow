import ChecklistForm from '../components/checklist/ChecklistForm'
import ChecklistPanel from '../components/checklist/ChecklistPanel'
import ChecklistProgress from '../components/checklist/ChecklistProgress'
import ProjectSelector from '../components/checklist/ProjectSelector'
import useChecklist from '../hooks/useChecklist'
import useProjectSelection from '../hooks/useProjectSelection'

function ChecklistPage() {
  const {
    projects,
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
  } = useProjectSelection()
  const {
    items,
    completedCount,
    isLoading,
    isSaving,
    isImportingDefault,
    isSyncedProject,
    error,
    addItem,
    toggleItem,
    deleteItem,
    importDefaultChecklist,
    refetch,
  } = useChecklist(selectedProject?.projectTarget ?? null)

  return (
    <main className="checklist-page">
      <section className="checklist-heading">
        <p className="page-eyebrow">EDITING CHECKLIST</p>
        <h1>편집 체크리스트</h1>
        <p>프로젝트별 편집 작업 진행률을 확인하고 관리하세요.</p>
      </section>

      <ProjectSelector
        onChange={setSelectedProjectId}
        projects={projects}
        selectedProjectId={selectedProjectId}
      />

      {error && (
        <div className="reference-state error-state" role="alert">
          <p>{error}</p>
          {isSyncedProject && <button className="secondary-button" onClick={refetch} type="button">다시 시도</button>}
        </div>
      )}

      {selectedProjectId && isLoading ? (
        <div className="reference-state">
          <span className="loading-indicator" aria-hidden="true" />
          <p>서버 체크리스트를 불러오고 있습니다.</p>
        </div>
      ) : selectedProjectId ? (
        <div className="checklist-workspace">
          <ChecklistProgress
            completedCount={completedCount}
            totalCount={items.length}
          />
          <ChecklistPanel
            disabled={isSaving || isLoading}
            isImportingDefault={isImportingDefault}
            items={items}
            onDelete={deleteItem}
            onImportDefault={importDefaultChecklist}
            onToggle={toggleItem}
          />
          <ChecklistForm
            disabled={isSaving || isLoading}
            onAdd={addItem}
          />
        </div>
      ) : (
        <section className="checklist-no-project">
          <h2>프로젝트를 먼저 생성해주세요.</h2>
          <p>프로젝트를 만든 뒤 편집 작업 체크리스트를 관리할 수 있습니다.</p>
        </section>
      )}
    </main>
  )
}

export default ChecklistPage
