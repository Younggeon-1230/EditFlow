import DashboardStats from '../components/dashboard/DashboardStats'
import HeroSection from '../components/dashboard/HeroSection'
import useDashboardSummary from '../hooks/useDashboardSummary'
import ContentIdeaDashboardCard from '../components/dashboard/ContentIdeaDashboardCard.jsx'
import useContentIdeaSummary from '../hooks/useContentIdeaSummary.js'

function MainDashboardPage() {
  const { stats, isLoading, error } = useDashboardSummary()
  const ideas = useContentIdeaSummary()

  return (
    <main className="dashboard-page">
      <HeroSection />
      <DashboardStats stats={stats} isLoading={isLoading} error={error} />
      <ContentIdeaDashboardCard error={ideas.error} isLoading={ideas.isLoading} onRetry={ideas.refetch} summary={ideas.summary} />
    </main>
  )
}

export default MainDashboardPage
