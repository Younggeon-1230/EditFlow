import DashboardStats from '../components/dashboard/DashboardStats'
import HeroSection from '../components/dashboard/HeroSection'
import useDashboardSummary from '../hooks/useDashboardSummary'

function MainDashboardPage() {
  const { stats, isLoading, error } = useDashboardSummary()

  return (
    <main className="dashboard-page">
      <HeroSection />
      <DashboardStats stats={stats} isLoading={isLoading} error={error} />
    </main>
  )
}

export default MainDashboardPage
