import { useEffect, useState } from 'react'
import ChecklistForm from '../components/checklist/ChecklistForm'
import ChecklistPanel from '../components/checklist/ChecklistPanel'
import ChecklistProgress from '../components/checklist/ChecklistProgress'
import ProjectSelector from '../components/checklist/ProjectSelector'
import useChecklist from '../hooks/useChecklist'
import useProjects from '../hooks/useProjects'

function ChecklistPage() {
  const { projects } = useProjects()
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const {
    items,
    completedCount,
    addItem,
    toggleItem,
    deleteItem,
    resetChecklist,
  } = useChecklist(selectedProjectId)

  useEffect(() => {
    if (
      projects.length > 0 &&
      !projects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectId(projects[0].id)
    }

    if (projects.length === 0 && selectedProjectId) {
      setSelectedProjectId('')
    }
  }, [projects, selectedProjectId])

  function handleResetChecklist() {
    const shouldReset = window.confirm(
      '현재 체크리스트를 기본 항목으로 복원할까요? 직접 추가한 항목은 사라질 수 있습니다.',
    )

    if (shouldReset) {
      resetChecklist(selectedProjectId)
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

      {selectedProjectId ? (
        <div className="checklist-workspace">
          <ChecklistProgress
            completedCount={completedCount}
            totalCount={items.length}
          />
          <ChecklistPanel
            items={items}
            onDelete={deleteItem}
            onReset={handleResetChecklist}
            onToggle={toggleItem}
          />
          <ChecklistForm onAdd={addItem} />
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
