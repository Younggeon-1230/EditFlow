import SummaryStatCard from './SummaryStatCard'

const statIcons = {
  projects: 'P',
  references: 'R',
  checklists: 'C',
}

function DashboardStats({ stats, isLoading, error }) {
  if (isLoading) {
    return (
      <section className="dashboard-status" aria-live="polite">
        요약 정보를 불러오는 중입니다.
      </section>
    )
  }

  if (error) {
    return (
      <section className="dashboard-status dashboard-error" role="alert">
        {error}
      </section>
    )
  }

  return (
    <section className="dashboard-stats" aria-label="작업 요약">
      {stats.map((stat) => (
        <SummaryStatCard
          icon={statIcons[stat.id] ?? '·'}
          key={stat.id}
          title={stat.title}
          to={stat.to}
          value={stat.value}
        />
      ))}
    </section>
  )
}

export default DashboardStats
