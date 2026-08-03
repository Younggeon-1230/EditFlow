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
    isSyncedProject,
    localItemCount,
    error,
    migrationStatus,
    addItem,
    toggleItem,
    deleteItem,
    resetChecklist,
    migrateChecklistToBackend,
  } = useChecklist(
    selectedProjectId,
    selectedProject?.backendProjectId ?? null,
  )

  async function handleResetChecklist() {
    const shouldReset = window.confirm(
      isSyncedProject
        ? '서버 체크리스트를 기본 항목으로 복원할까요? 일괄 교체 API가 없어 중간 실패 시 일부 항목이 남을 수 있습니다.'
        : '현재 체크리스트를 기본 항목으로 복원할까요? 직접 추가한 항목은 사라질 수 있습니다.',
    )

    if (shouldReset) {
      await resetChecklist(selectedProjectId)
    }
  }

  async function handleChecklistMigration() {
    const shouldMigrate = window.confirm(
      '로컬 체크리스트를 서버로 동기화할까요? 서버 목록이 비어 있을 때만 진행됩니다.',
    )

    if (shouldMigrate) {
      await migrateChecklistToBackend()
    }
  }

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

      {isSyncedProject && localItemCount > 0 && (
        <section className="checklist-sync-notice">
          <div>
            <strong>로컬 체크리스트 {localItemCount}개가 남아 있습니다.</strong>
            <p>자동 전송되지 않습니다. 서버 목록이 비어 있을 때만 직접 동기화할 수 있습니다.</p>
          </div>
          <button
            className="secondary-button"
            disabled={isSaving || isLoading}
            onClick={handleChecklistMigration}
            type="button"
          >
            {isSaving ? '처리 중' : '체크리스트 서버 동기화'}
          </button>
        </section>
      )}

      {error && (
        <div className="reference-state error-state" role="alert">
          <p>{error}</p>
        </div>
      )}

      {migrationStatus &&
        !migrationStatus.blocked &&
        migrationStatus.failed === 0 &&
        migrationStatus.migrated > 0 && (
          <div className="reference-state" role="status">
            로컬 체크리스트 {migrationStatus.migrated}개를 서버에 동기화했습니다.
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
            items={items}
            onDelete={deleteItem}
            onReset={handleResetChecklist}
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
