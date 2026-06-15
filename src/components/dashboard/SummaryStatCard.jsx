import { Link } from 'react-router-dom'

function SummaryStatCard({ title, value, to, icon }) {
  return (
    <Link className="summary-card" to={to}>
      <div className="summary-card-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <p className="summary-card-title">{title}</p>
        <strong className="summary-card-value">{value}</strong>
      </div>
      <span className="summary-card-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  )
}

export default SummaryStatCard
