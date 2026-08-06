import { useRef, useState } from 'react'
import AIContentIdeaRecommendationDialog from '../components/contentIdeas/AIContentIdeaRecommendationDialog.jsx'
import ContentIdeaFilters from '../components/contentIdeas/ContentIdeaFilters.jsx'
import ContentIdeaConversionDialog from '../components/contentIdeas/ContentIdeaConversionDialog.jsx'
import ContentIdeaForm from '../components/contentIdeas/ContentIdeaForm.jsx'
import ContentIdeaList from '../components/contentIdeas/ContentIdeaList.jsx'
import ContentIdeaSummary from '../components/contentIdeas/ContentIdeaSummary.jsx'
import useContentIdeas from '../hooks/useContentIdeas.js'
import useContentIdeaSummary from '../hooks/useContentIdeaSummary.js'
import useContentIdeaRecommendations from '../hooks/useContentIdeaRecommendations.js'
import useProjects from '../hooks/useProjects.js'
import { generatePath, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/app.js'

function ContentIdeasPage() {
  const navigate = useNavigate()
  const { projects, registerBackendProject } = useProjects()
  const {
    filters, setFilters, items, isLoading, error, errorTitle, isCreating,
    updatingIds, deletingIds, convertingIds, conversionError, refetch,
    addIdea, updateIdea, removeIdea, convertIdeaToProject, clearFilters,
    clearConversionError, mutationVersion,
  } = useContentIdeas()
  const { summary, isLoading: isSummaryLoading, error: summaryError, refetch: refetchSummary } = useContentIdeaSummary(mutationVersion)
  const [formIdea, setFormIdea] = useState(undefined)
  const [conversionIdea, setConversionIdea] = useState(null)
  const [registrationError, setRegistrationError] = useState(null)
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false)
  const recommendationTriggerRef = useRef(null)
  const recommendationState = useContentIdeaRecommendations()
  const isFormOpen = formIdea !== undefined
  const hasFilters = ['search', 'status', 'platform', 'priority', 'source']
    .some((name) => filters[name].trim())

  function openCreateForm() { setFormIdea(null) }
  function closeForm() { setFormIdea(undefined) }
  async function handleSubmit(values) {
    const saved = formIdea ? await updateIdea(formIdea.id, values) : await addIdea(values)
    if (saved) closeForm()
    return saved
  }
  async function handleDelete(idea) {
    if (window.confirm(`“${idea.title}” 소재를 삭제할까요?`)) await removeIdea(idea.id)
  }
  async function handleConversion(values) {
    const result = await convertIdeaToProject(conversionIdea.id, values)
    if (!result) return null
    try {
      const localProject = registerBackendProject(result.project)
      setConversionIdea(null)
      navigate(generatePath(ROUTES.projectDetail, { projectId: localProject.id }))
    } catch (localError) {
      setConversionIdea(null)
      setRegistrationError(
        localError.message ||
          '프로젝트는 생성됐지만 화면 목록에 연결하지 못했습니다. 프로젝트 목록을 새로고침해 주세요.',
      )
    }
    return result
  }

  async function refreshAfterRecommendationSave(successCount) {
    if (successCount > 0) await Promise.all([refetch(), refetchSummary()])
  }

  async function handleSaveRecommendation(clientKey) {
    const result = await recommendationState.saveOne(clientKey)
    await refreshAfterRecommendationSave(result.successCount)
  }

  async function handleSaveSelectedRecommendations() {
    const result = await recommendationState.saveSelected()
    await refreshAfterRecommendationSave(result.successCount)
  }

  function closeRecommendations() {
    recommendationState.reset()
    setIsRecommendationOpen(false)
  }

  return (
    <main className="content-ideas-page">
      <header className="ideas-heading">
        <div><p className="page-eyebrow">CONTENT IDEAS</p><h1>콘텐츠 소재</h1><p>영상으로 만들고 싶은 아이디어를 저장하고 관리해 보세요.</p></div>
        <div className="ideas-heading-actions">
          <button className="secondary-button ai-recommendation-trigger" onClick={() => setIsRecommendationOpen(true)} ref={recommendationTriggerRef} type="button"><span aria-hidden="true">✦</span> AI 소재 추천</button>
          <button className="primary-button" onClick={openCreateForm} type="button"><span aria-hidden="true">+</span> 새 소재 등록</button>
        </div>
      </header>

      <ContentIdeaSummary error={summaryError} isLoading={isSummaryLoading} onRetry={refetchSummary} summary={summary} />

      <ContentIdeaFilters filters={filters} onChange={setFilters} onClear={clearFilters} />
      <div className="idea-results-heading"><strong>{hasFilters ? `전체 ${summary?.total ?? '–'}개 중 ${items.length}개의 소재를 표시하고 있습니다.` : `총 ${summary?.total ?? items.length}개의 콘텐츠 소재가 있습니다.`}</strong>{isLoading && items.length > 0 && <span role="status">새로고침 중…</span>}</div>

      {registrationError && <section className="idea-state idea-error" role="alert"><div><strong>프로젝트 생성은 완료됐습니다.</strong><p>{registrationError}</p></div><button className="secondary-button" onClick={() => setRegistrationError(null)} type="button">확인</button></section>}
      {error && <section className="idea-state idea-error" role="alert"><div><strong>{errorTitle}</strong><p>{error}</p></div><button className="secondary-button" onClick={refetch} type="button">다시 시도</button></section>}
      {error && items.length === 0 ? null : isLoading && items.length === 0 ? (
        <section className="idea-state" role="status"><p>콘텐츠 소재를 불러오는 중입니다.</p></section>
      ) : items.length > 0 ? (
        <ContentIdeaList convertingIds={convertingIds} deletingIds={deletingIds} items={items} onConvert={(idea) => { setRegistrationError(null); clearConversionError(); setConversionIdea(idea) }} onDelete={handleDelete} onEdit={setFormIdea} onMediaChanged={refetchSummary} projects={projects} updatingIds={updatingIds} />
      ) : (
        <section className="idea-state idea-empty">
          <h2>{hasFilters ? '조건에 맞는 콘텐츠 소재가 없습니다.' : '등록된 콘텐츠 소재가 없습니다.'}</h2>
          <p>{hasFilters ? '필터를 초기화하고 다시 확인해 보세요.' : '첫 콘텐츠 소재를 등록해 아이디어를 모아 보세요.'}</p>
          <button className="secondary-button" onClick={hasFilters ? clearFilters : openCreateForm} type="button">{hasFilters ? '필터 초기화' : '첫 소재 등록'}</button>
        </section>
      )}

      {isFormOpen && <div className="form-overlay idea-form-overlay" onMouseDown={closeForm} role="presentation"><section aria-labelledby="idea-form-title" aria-modal="true" className="idea-form-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="idea-form-heading"><div><p className="page-eyebrow">{formIdea ? 'EDIT IDEA' : 'NEW IDEA'}</p><h2 id="idea-form-title">{formIdea ? '콘텐츠 소재 수정' : '새 콘텐츠 소재 등록'}</h2></div><button aria-label="창 닫기" className="icon-button" disabled={isCreating || Boolean(formIdea && updatingIds.has(formIdea.id))} onClick={closeForm} type="button">×</button></div><ContentIdeaForm initialValue={formIdea} isSubmitting={formIdea ? updatingIds.has(formIdea.id) : isCreating} onCancel={closeForm} onSubmit={handleSubmit} /></section></div>}
      {conversionIdea && <ContentIdeaConversionDialog error={conversionError} idea={conversionIdea} isSubmitting={convertingIds.has(conversionIdea.id)} onCancel={() => setConversionIdea(null)} onSubmit={handleConversion} />}
      {isRecommendationOpen && (
        <AIContentIdeaRecommendationDialog
          onClose={closeRecommendations}
          onGenerate={recommendationState.generate}
          onSaveOne={handleSaveRecommendation}
          onSaveSelected={handleSaveSelectedRecommendations}
          state={recommendationState}
          triggerRef={recommendationTriggerRef}
        />
      )}
    </main>
  )
}

export default ContentIdeasPage
