import { useState } from 'react'
import { Link } from 'react-router-dom'
import ReferencePanel from '../projectDetail/ReferencePanel.jsx'
import BrollPanel from '../projectDetail/BrollPanel.jsx'
import useContentIdeaReferences from '../../hooks/useContentIdeaReferences.js'
import useContentIdeaBrolls from '../../hooks/useContentIdeaBrolls.js'
import { ROUTES } from '../../constants/app.js'

function ContentIdeaMediaPanel({ idea, onMediaChanged }) {
  const [activeTab, setActiveTab] = useState('references')
  const references = useContentIdeaReferences(idea.id, activeTab === 'references')
  const brolls = useContentIdeaBrolls(idea.id, activeTab === 'brolls')
  const media = activeTab === 'references' ? references : brolls
  const searchPath = activeTab === 'references' ? ROUTES.reference : ROUTES.broll
  const searchLabel = activeTab === 'references' ? '레퍼런스 검색' : 'B-roll 검색'
  async function removeMedia(itemId) {
    const removed = await media.remove(itemId)
    if (removed) onMediaChanged?.()
    return removed
  }

  return (
    <section className="idea-media-panel" aria-label={`${idea.title} 연결 자료`}>
      <div className="idea-media-tabs" role="tablist" aria-label="연결 자료 종류">
        <button aria-selected={activeTab === 'references'} className={activeTab === 'references' ? 'active' : ''} onClick={() => setActiveTab('references')} role="tab" type="button">Reference {references.items.length > 0 && `(${references.items.length})`}</button>
        <button aria-selected={activeTab === 'brolls'} className={activeTab === 'brolls' ? 'active' : ''} onClick={() => setActiveTab('brolls')} role="tab" type="button">B-roll {brolls.items.length > 0 && `(${brolls.items.length})`}</button>
      </div>

      {idea.status === 'converted' && <p className="idea-media-independence">이곳의 변경 사항은 이미 생성된 프로젝트의 저장 자료에 자동 반영되지 않습니다.</p>}

      <div className="idea-media-toolbar">
        <Link className="secondary-button link-button" to={`${searchPath}?destination=idea&idea=${idea.id}`}>{searchLabel}</Link>
        <button className="secondary-button" disabled={media.isLoading} onClick={media.reload} type="button">새로고침</button>
      </div>

      {activeTab === 'references' ? (
        <ReferencePanel
          error={references.error}
          isDeletingItem={references.isDeletingItem}
          isLoading={references.isLoading}
          isUpdatingItem={references.isUpdatingItem}
          items={references.items}
          onChangeNote={references.changeNote}
          onRemove={removeMedia}
          removeConfirmMessage="이 레퍼런스를 콘텐츠 소재에서 삭제할까요?"
        />
      ) : (
        <BrollPanel
          error={brolls.error}
          isDeletingItem={brolls.isDeletingItem}
          isLoading={brolls.isLoading}
          isUpdatingItem={brolls.isUpdatingItem}
          items={brolls.items}
          onChangeNote={brolls.changeNote}
          onRemove={removeMedia}
          removeConfirmMessage="이 B-roll을 콘텐츠 소재에서 삭제할까요?"
        />
      )}
    </section>
  )
}

export default ContentIdeaMediaPanel
