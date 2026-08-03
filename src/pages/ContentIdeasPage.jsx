import { useState } from 'react'
import ContentIdeaFilters from '../components/contentIdeas/ContentIdeaFilters.jsx'
import ContentIdeaForm from '../components/contentIdeas/ContentIdeaForm.jsx'
import ContentIdeaList from '../components/contentIdeas/ContentIdeaList.jsx'
import useContentIdeas from '../hooks/useContentIdeas.js'

function ContentIdeasPage() {
  const {
    filters, setFilters, items, isLoading, error, errorTitle, isCreating,
    updatingIds, deletingIds, refetch, addIdea, updateIdea, removeIdea, clearFilters,
  } = useContentIdeas()
  const [formIdea, setFormIdea] = useState(undefined)
  const isFormOpen = formIdea !== undefined
  const hasFilters = Object.values(filters).some((value) => value.trim())

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

  return (
    <main className="content-ideas-page">
      <header className="ideas-heading">
        <div><p className="page-eyebrow">CONTENT IDEAS</p><h1>콘텐츠 소재</h1><p>영상으로 만들고 싶은 아이디어를 저장하고 관리해 보세요.</p></div>
        <button className="primary-button" onClick={openCreateForm} type="button"><span aria-hidden="true">+</span> 새 소재 등록</button>
      </header>

      <ContentIdeaFilters filters={filters} onChange={setFilters} onClear={clearFilters} />
      <div className="idea-results-heading"><strong>전체 결과 {items.length}개</strong>{isLoading && items.length > 0 && <span role="status">새로고침 중…</span>}</div>

      {error && <section className="idea-state idea-error" role="alert"><div><strong>{errorTitle}</strong><p>{error}</p></div><button className="secondary-button" onClick={refetch} type="button">다시 시도</button></section>}
      {error && items.length === 0 ? null : isLoading && items.length === 0 ? (
        <section className="idea-state" role="status"><p>콘텐츠 소재를 불러오는 중입니다.</p></section>
      ) : items.length > 0 ? (
        <ContentIdeaList deletingIds={deletingIds} items={items} onDelete={handleDelete} onEdit={setFormIdea} updatingIds={updatingIds} />
      ) : (
        <section className="idea-state idea-empty">
          <h2>{hasFilters ? '조건에 맞는 콘텐츠 소재가 없습니다.' : '등록된 콘텐츠 소재가 없습니다.'}</h2>
          <p>{hasFilters ? '필터를 초기화하고 다시 확인해 보세요.' : '첫 콘텐츠 소재를 등록해 아이디어를 모아 보세요.'}</p>
          <button className="secondary-button" onClick={hasFilters ? clearFilters : openCreateForm} type="button">{hasFilters ? '필터 초기화' : '첫 소재 등록'}</button>
        </section>
      )}

      {isFormOpen && <div className="form-overlay idea-form-overlay" onMouseDown={closeForm} role="presentation"><section aria-labelledby="idea-form-title" aria-modal="true" className="idea-form-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="idea-form-heading"><div><p className="page-eyebrow">{formIdea ? 'EDIT IDEA' : 'NEW IDEA'}</p><h2 id="idea-form-title">{formIdea ? '콘텐츠 소재 수정' : '새 콘텐츠 소재 등록'}</h2></div><button aria-label="창 닫기" className="icon-button" disabled={isCreating || Boolean(formIdea && updatingIds.has(formIdea.id))} onClick={closeForm} type="button">×</button></div><ContentIdeaForm initialValue={formIdea} isSubmitting={formIdea ? updatingIds.has(formIdea.id) : isCreating} onCancel={closeForm} onSubmit={handleSubmit} /></section></div>}
    </main>
  )
}

export default ContentIdeasPage
