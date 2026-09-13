import ContentIdeaCard from './ContentIdeaCard.jsx'

function ContentIdeaList({ items, onEdit, onDelete, onConvert, onMediaChanged, updatingIds, deletingIds, convertingIds }) {
  return (
    <section className="idea-grid" aria-label="콘텐츠 소재 목록">
      {items.map((idea) => (
        <ContentIdeaCard
          idea={idea}
          isDeleting={deletingIds.has(idea.id)}
          isConverting={convertingIds.has(idea.id)}
          isUpdating={updatingIds.has(idea.id)}
          key={idea.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onConvert={onConvert}
          onMediaChanged={onMediaChanged}
        />
      ))}
    </section>
  )
}

export default ContentIdeaList
