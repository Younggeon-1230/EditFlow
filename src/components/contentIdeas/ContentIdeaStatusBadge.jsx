import {
  CONTENT_IDEA_PRIORITIES,
  CONTENT_IDEA_STATUSES,
} from '../../constants/contentIdeas.js'

function ContentIdeaStatusBadge({ type = 'status', value }) {
  const labels = type === 'priority' ? CONTENT_IDEA_PRIORITIES : CONTENT_IDEA_STATUSES
  return (
    <span className={`idea-badge idea-badge--${type}-${value}`}>
      {labels[value] ?? value}
    </span>
  )
}

export default ContentIdeaStatusBadge
