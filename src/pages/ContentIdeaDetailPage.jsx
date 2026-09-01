import { useState } from 'react'
import { generatePath, Link, useNavigate, useParams } from 'react-router-dom'
import ContentIdeaConversionDialog from '../components/contentIdeas/ContentIdeaConversionDialog.jsx'
import ContentIdeaForm from '../components/contentIdeas/ContentIdeaForm.jsx'
import ContentIdeaMediaPanel from '../components/contentIdeas/ContentIdeaMediaPanel.jsx'
import ContentIdeaStatusBadge from '../components/contentIdeas/ContentIdeaStatusBadge.jsx'
import { ROUTES } from '../constants/app.js'
import {
  CONTENT_IDEA_PLATFORMS,
  CONTENT_IDEA_SOURCES,
} from '../constants/contentIdeas.js'
import useContentIdeaDetail from '../hooks/useContentIdeaDetail.js'
import useContentIdeaProjectRelation from '../hooks/useContentIdeaProjectRelation.js'
import useProjects from '../hooks/useProjects.js'

const PROJECT_STATUS_LABELS = {
  planning: '기획 중',
  in_progress: '진행 중',
  completed: '완료',
  archived: '보관',
}

function parseIdeaId(value) {
  if (!/^[1-9]\d*$/.test(value ?? '')) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function formatDate(value, includeTime = false) {
  if (!value) return '미입력'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '미입력'
  return new Intl.DateTimeFormat('ko-KR', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date)
}

function ContentIdeaDetailPage() {
  const { ideaId: routeIdeaId } = useParams()
  const ideaId = parseIdeaId(routeIdeaId)
  const navigate = useNavigate()
  const detail = useContentIdeaDetail(ideaId)
  const { projects, registerBackendProject } = useProjects()
  const relation = useContentIdeaProjectRelation(detail.idea?.convertedProjectId ?? null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isConversionOpen, setIsConversionOpen] = useState(false)
  const [registrationError, setRegistrationError] = useState(null)
  const localProject = projects.find(
    (project) => project.backendProjectId === detail.idea?.convertedProjectId,
  )

  if (!ideaId) {
    return (
      <main className="content-idea-detail-page">
        <section className="idea-detail-state">
          <p className="page-eyebrow">INVALID CONTENT IDEA</p>
          <h1>콘텐츠 소재 주소를 확인해 주세요.</h1>
          <p>소재 ID는 1 이상의 정수여야 합니다.</p>
          <Link className="secondary-button link-button" to={ROUTES.ideas}>콘텐츠 소재 목록으로</Link>
        </section>
      </main>
    )
  }

  if (detail.isLoading && !detail.idea) {
    return <main className="content-idea-detail-page"><section className="idea-detail-state" role="status"><p>콘텐츠 소재를 불러오는 중입니다.</p></section></main>
  }

  if (!detail.idea) {
    return (
      <main className="content-idea-detail-page">
        <section className="idea-detail-state">
          <p className="page-eyebrow">{detail.isNotFound ? 'CONTENT IDEA NOT FOUND' : 'CONTENT IDEA ERROR'}</p>
          <h1>{detail.isNotFound ? '콘텐츠 소재를 찾을 수 없습니다.' : '콘텐츠 소재를 불러오지 못했습니다.'}</h1>
          <p role={detail.isNotFound ? undefined : 'alert'}>{detail.error}</p>
          <div className="idea-detail-state-actions">
            {!detail.isNotFound && <button className="secondary-button" onClick={detail.reload} type="button">다시 시도</button>}
            <Link className="secondary-button link-button" to={ROUTES.ideas}>콘텐츠 소재 목록으로</Link>
          </div>
        </section>
      </main>
    )
  }

  const idea = detail.idea
  const canConvert = !idea.convertedProjectId && ['idea', 'researching', 'ready'].includes(idea.status)
  const mediaQuery = `?destination=idea&idea=${idea.id}`

  async function handleUpdate(values) {
    const updated = await detail.update(values)
    if (updated) setIsEditOpen(false)
  }

  async function handleDelete() {
    if (!window.confirm(`“${idea.title}” 소재를 삭제할까요?`)) return
    const deleted = await detail.remove()
    if (deleted) navigate(ROUTES.ideas, { replace: true })
  }

  async function handleConversion(values) {
    const result = await detail.convert(values)
    if (!result) return null
    try {
      const nextLocalProject = registerBackendProject(result.project)
      setIsConversionOpen(false)
      navigate(generatePath(ROUTES.projectDetail, { projectId: nextLocalProject.id }))
    } catch (error) {
      setIsConversionOpen(false)
      setRegistrationError(error.message || '프로젝트의 로컬 화면 연결을 만들지 못했습니다.')
    }
    return result
  }

  return (
    <main className="content-idea-detail-page">
      <Link className="detail-back-link" to={ROUTES.ideas}><span aria-hidden="true">←</span> 콘텐츠 소재 목록</Link>

      {(detail.actionError || registrationError) && (
        <div className="reference-state error-state" role="alert">
          <p>{registrationError || detail.actionError}</p>
        </div>
      )}

      <header className="idea-detail-header">
        <div className="idea-detail-heading-copy">
          <p className="page-eyebrow">CONTENT IDEA DETAIL</p>
          <h1>{idea.title}</h1>
          <div className="idea-card-badges" aria-label="소재 상태">
            <span className="idea-platform-badge">{CONTENT_IDEA_PLATFORMS[idea.platform] ?? idea.platform}</span>
            <span className={`idea-badge${idea.source === 'ai' ? ' ai-source-badge' : ''}`}>{CONTENT_IDEA_SOURCES[idea.source] ?? idea.source}</span>
            <ContentIdeaStatusBadge value={idea.status} />
            <ContentIdeaStatusBadge type="priority" value={idea.priority} />
          </div>
        </div>
        <div className="idea-detail-actions" aria-label="콘텐츠 소재 작업">
          <button className="secondary-button" disabled={Boolean(detail.pendingAction)} onClick={() => { detail.clearActionError(); setIsEditOpen(true) }} type="button">수정</button>
          {canConvert && <button className="primary-button" disabled={Boolean(detail.pendingAction)} onClick={() => setIsConversionOpen(true)} type="button">프로젝트로 전환</button>}
          <Link className="secondary-button link-button" to={`${ROUTES.reference}${mediaQuery}`}>Reference 관리</Link>
          <Link className="secondary-button link-button" to={`${ROUTES.broll}${mediaQuery}`}>B-roll 관리</Link>
          <button className="idea-delete-button" disabled={Boolean(detail.pendingAction)} onClick={handleDelete} type="button">{detail.pendingAction === 'delete' ? '삭제 중…' : '삭제'}</button>
        </div>
      </header>

      <div className="idea-detail-layout">
        <section aria-labelledby="idea-detail-information" className="idea-detail-card idea-detail-information">
          <h2 id="idea-detail-information">소재 정보</h2>
          <div className="idea-detail-description">
            <h3>설명</h3>
            <p>{idea.description || '미입력'}</p>
          </div>
          <dl className="idea-detail-meta">
            <div><dt>플랫폼</dt><dd>{CONTENT_IDEA_PLATFORMS[idea.platform] ?? idea.platform}</dd></div>
            <div><dt>대상 시청자</dt><dd>{idea.targetAudience || '미입력'}</dd></div>
            <div><dt>콘텐츠 형식</dt><dd>{idea.contentFormat || '미입력'}</dd></div>
            <div><dt>출처</dt><dd>{CONTENT_IDEA_SOURCES[idea.source] ?? idea.source}</dd></div>
            <div><dt>생성일</dt><dd>{formatDate(idea.createdAt, true)}</dd></div>
            <div><dt>수정일</dt><dd>{formatDate(idea.updatedAt, true)}</dd></div>
          </dl>
          <div className="idea-detail-tags">
            <h3>태그</h3>
            {idea.tags.length > 0 ? <div className="idea-tags">{idea.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : <p>미입력</p>}
          </div>
        </section>

        <section aria-labelledby="idea-project-relation-title" className="idea-detail-card relationship-card idea-project-relation">
          <div className="relationship-card-heading">
            <div><p className="page-eyebrow">PROJECT RELATION</p><h2 id="idea-project-relation-title">프로젝트 연결</h2></div>
          </div>
          {!idea.convertedProjectId ? (
            <div className="relationship-empty">
              <p>아직 프로젝트로 전환되지 않았습니다.</p>
              {canConvert ? <button className="primary-button" onClick={() => setIsConversionOpen(true)} type="button">프로젝트로 전환</button> : <p>보관된 소재는 프로젝트로 전환할 수 없습니다.</p>}
            </div>
          ) : relation.isLoading ? (
            <p role="status">연결된 프로젝트를 확인하고 있습니다.</p>
          ) : relation.error ? (
            <div className="relationship-error" role="alert"><p>{relation.error}</p><button className="secondary-button" onClick={relation.reload} type="button">다시 확인</button></div>
          ) : relation.project ? (
            <div className="idea-linked-project">
              <strong>{relation.project.title}</strong>
              <dl>
                <div><dt>상태</dt><dd>{PROJECT_STATUS_LABELS[relation.project.status] ?? relation.project.status}</dd></div>
                <div><dt>마감일</dt><dd>{formatDate(relation.project.dueDate)}</dd></div>
              </dl>
              {localProject ? (
                <Link className="primary-button link-button" to={generatePath(ROUTES.projectDetail, { projectId: localProject.id })}>프로젝트 보기</Link>
              ) : (
                <p className="relationship-mapping-warning">연결된 서버 프로젝트가 있지만 이 브라우저의 로컬 프로젝트 매핑이 없습니다. 잘못된 ID로 이동하지 않도록 링크를 제공하지 않습니다.</p>
              )}
            </div>
          ) : null}
        </section>
      </div>

      <section aria-labelledby="idea-media-title" className="idea-detail-card idea-detail-media" id="idea-media">
        <div className="relationship-card-heading"><div><p className="page-eyebrow">CONNECTED MEDIA</p><h2 id="idea-media-title">연결 자료</h2></div></div>
        <ContentIdeaMediaPanel idea={idea} loadAll />
      </section>

      {isEditOpen && (
        <div className="form-overlay idea-form-overlay" onMouseDown={() => !detail.pendingAction && setIsEditOpen(false)} role="presentation">
          <section aria-labelledby="idea-detail-edit-title" aria-modal="true" className="idea-form-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <div className="idea-form-heading"><div><p className="page-eyebrow">EDIT IDEA</p><h2 id="idea-detail-edit-title">콘텐츠 소재 수정</h2></div><button aria-label="소재 수정 창 닫기" className="icon-button" disabled={Boolean(detail.pendingAction)} onClick={() => setIsEditOpen(false)} type="button">×</button></div>
            <ContentIdeaForm initialValue={idea} isSubmitting={detail.pendingAction === 'update'} onCancel={() => setIsEditOpen(false)} onSubmit={handleUpdate} />
          </section>
        </div>
      )}

      {isConversionOpen && <ContentIdeaConversionDialog error={detail.conversionError} idea={idea} isSubmitting={detail.pendingAction === 'convert'} onCancel={() => !detail.pendingAction && setIsConversionOpen(false)} onSubmit={handleConversion} />}
    </main>
  )
}

export default ContentIdeaDetailPage
