import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BrollPanel from '../components/projectDetail/BrollPanel'
import ChecklistMemoPanel from '../components/projectDetail/ChecklistMemoPanel'
import ProjectInfo from '../components/projectDetail/ProjectInfo'
import ProjectTabs from '../components/projectDetail/ProjectTabs'
import ReferencePanel from '../components/projectDetail/ReferencePanel'
import ThumbnailPanel from '../components/projectDetail/ThumbnailPanel'
import { ROUTES } from '../constants/app'
import projectDetailSamples from '../data/projectDetailSamples'
import useProjects from '../hooks/useProjects'

const panelComponents = {
  references: ReferencePanel,
  thumbnails: ThumbnailPanel,
  brolls: BrollPanel,
}

function ProjectDetailPage() {
  const { projectId } = useParams()
  const { projects } = useProjects()
  const [activeTab, setActiveTab] = useState('references')
  const project = projects.find((item) => item.id === projectId)

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

  return (
    <main className="project-detail-page">
      <Link className="detail-back-link" to={ROUTES.projects}>
        <span aria-hidden="true">←</span> 프로젝트 목록
      </Link>

      <ProjectInfo project={project} />
      <ProjectTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <section
        aria-labelledby={`tab-${activeTab}`}
        className="project-tab-panel"
        id={`panel-${activeTab}`}
        role="tabpanel"
      >
        {ActivePanel && <ActivePanel items={projectDetailSamples[activeTab]} />}
        {activeTab === 'checklist' && (
          <ChecklistMemoPanel
            checklist={projectDetailSamples.checklist}
            mode="checklist"
          />
        )}
        {activeTab === 'memos' && (
          <ChecklistMemoPanel memos={projectDetailSamples.memos} mode="memos" />
        )}
      </section>
    </main>
  )
}

export default ProjectDetailPage
