import ContentIdeaCard from './ContentIdeaCard.jsx'

function ContentIdeaList({ items, onEdit, onDelete, updatingIds, deletingIds }) {
  return (
    <section className="idea-grid" aria-label="콘텐츠 소재 목록">
      {items.map((idea) => (
        <ContentIdeaCard
          idea={idea}
          isDeleting={deletingIds.has(idea.id)}
          isUpdating={updatingIds.has(idea.id)}
          key={idea.id}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </section>
  )
}

export default ContentIdeaList
