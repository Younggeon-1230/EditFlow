const tabs = [
  { id: 'references', label: '유튜브 레퍼런스' },
  { id: 'thumbnails', label: '썸네일' },
  { id: 'brolls', label: 'B-roll' },
  { id: 'checklist', label: '체크리스트' },
  { id: 'memos', label: '메모' },
]

function ProjectTabs({ activeTab, onTabChange }) {
  return (
    <div className="project-tabs" aria-label="프로젝트 자료" role="tablist">
      {tabs.map((tab) => (
        <button
          aria-controls={`panel-${tab.id}`}
          aria-selected={activeTab === tab.id}
          className={`project-tab${activeTab === tab.id ? ' active' : ''}`}
          id={`tab-${tab.id}`}
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default ProjectTabs
