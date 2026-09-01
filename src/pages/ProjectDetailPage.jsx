import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BrollPanel from '../components/projectDetail/BrollPanel'
import ChecklistMemoPanel from '../components/projectDetail/ChecklistMemoPanel'
import ProjectInfo from '../components/projectDetail/ProjectInfo'
import ProjectMemoPanel from '../components/projectDetail/ProjectMemoPanel'
import ProjectSourceIdea from '../components/projectDetail/ProjectSourceIdea.jsx'
import ProjectStatusDialog, {
  STATUS_OPTIONS,
} from '../components/projectDetail/ProjectStatusDialog'
import ProjectTabs from '../components/projectDetail/ProjectTabs'
import ReferencePanel from '../components/projectDetail/ReferencePanel'
import ThumbnailPanel from '../components/projectDetail/ThumbnailPanel'
import ProjectForm from '../components/projects/ProjectForm'
import { ROUTES } from '../constants/app'
import projectDetailSamples from '../data/projectDetailSamples'
import useChecklist from '../hooks/useChecklist'
import useProjects from '../hooks/useProjects'
import useProjectMemos from '../hooks/useProjectMemos'
import useProjectSourceContentIdea from '../hooks/useProjectSourceContentIdea.js'
import useSavedBrolls from '../hooks/useSavedBrolls'
import useSavedReferences from '../hooks/useSavedReferences'

const panelComponents = {
  references: ReferencePanel,
  thumbnails: ThumbnailPanel,
  brolls: BrollPanel,
}

function ProjectDetailPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { projects, updateProject, deleteProject } = useProjects()
  const [activeTab, setActiveTab] = useState('references')
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('planning')
  const [pendingAction, setPendingAction] = useState(null)
  const pendingActionRef = useRef(null)
  const [actionError, setActionError] = useState(null)
  const project = projects.find((item) => item.id === projectId)
  const checklist = useChecklist(
    projectId,
    project?.backendProjectId ?? null,
  )
  const projectMemos = useProjectMemos(
    projectId,
    project?.backendProjectId ?? null,
  )
  const savedReferences = useSavedReferences(project?.backendProjectId ?? null)
  const savedBrolls = useSavedBrolls(project?.backendProjectId ?? null)
  const sourceIdea = useProjectSourceContentIdea(project?.backendProjectId ?? null)

  useEffect(() => {
    setIsEditOpen(false)
    setIsStatusOpen(false)
    setPendingAction(null)
    pendingActionRef.current = null
    setActionError(null)
  }, [projectId])

  if (!project) {
    return (
      <main className="project-not-found">
        <section>
          <p className="page-eyebrow">PROJECT NOT FOUND</p>
          <h1>프로젝트를 찾을 수 없습니다.</h1>
          <p>삭제되었거나 존재하지 않는 프로젝트입니다.</p>
          <Link className="secondary-button link-button" to={ROUTES.projects}>
            프로젝트 목록으로
          </Link>
        </section>
      </main>
    )
  }

  const ActivePanel = panelComponents[activeTab]
  const usesBackend =
    Number.isInteger(project.backendProjectId) && project.backendProjectId > 0
  const currentBackendStatus =
    project.backendStatus ??
    (project.status === '완료'
      ? 'completed'
      : project.status === '보관' || project.status === '보관됨'
        ? 'archived'
        : project.status === '기획 중'
          ? 'planning'
          : 'in_progress')
  const projectQuery = `?project=${encodeURIComponent(project.id)}`
  const panelProps = {
    references: usesBackend
      ? {
          items: savedReferences.items,
          isLoading: savedReferences.isLoading,
          error: savedReferences.error,
          onChangeNote: savedReferences.changeNote,
          onRemove: savedReferences.remove,
          isUpdatingItem: savedReferences.isUpdatingItem,
          isDeletingItem: savedReferences.isDeletingItem,
        }
      : { items: projectDetailSamples.references },
    thumbnails: { items: projectDetailSamples.thumbnails },
    brolls: usesBackend
      ? {
          items: savedBrolls.items,
          isLoading: savedBrolls.isLoading,
          error: savedBrolls.error,
          onChangeNote: savedBrolls.changeNote,
          onRemove: savedBrolls.remove,
          isUpdatingItem: savedBrolls.isUpdatingItem,
          isDeletingItem: savedBrolls.isDeletingItem,
        }
      : { items: projectDetailSamples.brolls },
  }

  async function submitProjectEdit(projectValues) {
    if (pendingActionRef.current) {
      return
    }
    pendingActionRef.current = 'edit'
    setPendingAction('edit')
    setActionError(null)
    const updated = await updateProject(project.id, projectValues)
    pendingActionRef.current = null
    setPendingAction(null)
    if (updated) {
      setIsEditOpen(false)
    } else {
      setActionError('프로젝트를 수정하지 못했습니다.')
    }
  }

  function openStatusDialog() {
    setSelectedStatus(currentBackendStatus)
    setIsStatusOpen(true)
    setActionError(null)
  }

  async function submitStatusChange() {
    if (pendingActionRef.current) {
      return
    }
    if (selectedStatus === currentBackendStatus) {
      setIsStatusOpen(false)
      return
    }
    const statusLabel =
      STATUS_OPTIONS.find((option) => option.value === selectedStatus)?.label ??
      '기획 중'
    pendingActionRef.current = 'status'
    setPendingAction('status')
    setActionError(null)
    const updated = await updateProject(project.id, { status: statusLabel })
    pendingActionRef.current = null
    setPendingAction(null)
    if (updated) {
      setIsStatusOpen(false)
    } else {
      setActionError('프로젝트 상태를 변경하지 못했습니다.')
    }
  }

  async function handleDeleteProject() {
    if (pendingActionRef.current) {
      return
    }
    const confirmed = window.confirm(
      `“${project.title}” 프로젝트를 삭제할까요?\n체크리스트, 저장된 레퍼런스, B-roll, 프로젝트 메모도 함께 삭제됩니다.`,
    )
    if (!confirmed) {
      return
    }
    pendingActionRef.current = 'delete'
    setPendingAction('delete')
    setActionError(null)
    const deleted = await deleteProject(project.id)
    if (deleted) {
      navigate(ROUTES.projects, { replace: true })
      return
    }
    pendingActionRef.current = null
    setPendingAction(null)
    setActionError('프로젝트를 삭제하지 못했습니다.')
  }

  return (
    <main className="project-detail-page">
      <Link className="detail-back-link" to={ROUTES.projects}>
        <span aria-hidden="true">←</span> 프로젝트 목록
      </Link>

      {actionError && (
        <div className="reference-state error-state" role="alert">
          <p>{actionError}</p>
        </div>
      )}

      <ProjectInfo
        disabled={Boolean(pendingAction)}
        onChangeStatus={openStatusDialog}
        onDelete={handleDeleteProject}
        onEdit={() => {
          setActionError(null)
          setIsEditOpen(true)
        }}
        project={project}
      />
      <ProjectSourceIdea project={project} relation={sourceIdea} />
      <ProjectTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <section
        aria-labelledby={`tab-${activeTab}`}
        className="project-tab-panel"
        id={`panel-${activeTab}`}
        role="tabpanel"
      >
        {ActivePanel && <ActivePanel {...panelProps[activeTab]} />}
        {activeTab === 'checklist' && (
          <ChecklistMemoPanel
            checklist={checklist.items}
            error={checklist.error}
            isItemPending={checklist.isItemPending}
            isLoading={checklist.isLoading}
            mode="checklist"
            onToggle={checklist.toggleItem}
          />
        )}
        {activeTab === 'memos' && (
          <ProjectMemoPanel
            error={projectMemos.error}
            isCreating={projectMemos.isCreating}
            isDeleting={projectMemos.isDeleting}
            isLoading={projectMemos.isLoading}
            isUpdating={projectMemos.isUpdating}
            items={projectMemos.items}
            key={`project-memos-${project.id}`}
            onAdd={projectMemos.addMemo}
            onDelete={projectMemos.deleteMemo}
            onUpdate={projectMemos.updateMemo}
          />
        )}
        {activeTab === 'references' && (
          <Link
            className="secondary-button detail-tab-cta"
            to={`${ROUTES.reference}${projectQuery}`}
          >
            유튜브 레퍼런스 검색
          </Link>
        )}
        {activeTab === 'brolls' && (
          <Link
            className="secondary-button detail-tab-cta"
            to={`${ROUTES.broll}${projectQuery}`}
          >
            B-roll 검색
          </Link>
        )}
        {activeTab === 'checklist' && (
          <Link
            className="secondary-button detail-tab-cta"
            to={`${ROUTES.checklist}${projectQuery}`}
          >
            체크리스트로 이동
          </Link>
        )}
      </section>

      {isEditOpen && (
        <div
          className="form-overlay"
          role="presentation"
          onMouseDown={() => {
            if (!pendingAction) {
              setIsEditOpen(false)
            }
          }}
        >
          <section
            aria-labelledby="detail-project-form-title"
            aria-modal="true"
            className="project-form-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="project-form-heading">
              <div>
                <p className="page-eyebrow">EDIT PROJECT</p>
                <h2 id="detail-project-form-title">프로젝트 수정</h2>
              </div>
              <button
                aria-label="프로젝트 수정 닫기"
                className="icon-button"
                disabled={Boolean(pendingAction)}
                onClick={() => setIsEditOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            {actionError && (
              <div className="reference-state error-state" role="alert">
                <p>{actionError}</p>
              </div>
            )}
            <ProjectForm
              initialValue={project}
              isSubmitting={pendingAction === 'edit'}
              onCancel={() => setIsEditOpen(false)}
              onSubmit={submitProjectEdit}
            />
          </section>
        </div>
      )}

      {isStatusOpen && (
        <ProjectStatusDialog
          error={actionError}
          isSubmitting={pendingAction === 'status'}
          onCancel={() => {
            if (!pendingAction) {
              setIsStatusOpen(false)
            }
          }}
          onChange={setSelectedStatus}
          onSave={submitStatusChange}
          value={selectedStatus}
        />
      )}
    </main>
  )
}

export default ProjectDetailPage
