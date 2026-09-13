import DashboardStats from '../components/dashboard/DashboardStats'
import HeroSection from '../components/dashboard/HeroSection'
import useDashboardSummary from '../hooks/useDashboardSummary'
import ContentIdeaDashboardCard from '../components/dashboard/ContentIdeaDashboardCard.jsx'
import useContentIdeaSummary from '../hooks/useContentIdeaSummary.js'
import useLegacyProjects from '../hooks/useLegacyProjects.js'

function MainDashboardPage() {
  const projects = useDashboardSummary()
  const legacy = useLegacyProjects(projects.projects, projects.hasResult)
  const ideas = useContentIdeaSummary()

  return (
    <main className="dashboard-page">
      <HeroSection />
      <DashboardStats stats={projects.stats} isLoading={projects.isLoading} error={projects.error} onRetry={projects.refetch} />
      {legacy.projects.length > 0 && <section className="dashboard-status"><strong>로컬 프로젝트 {legacy.projects.length}개</strong><p>서버 통계에는 포함되지 않으며 프로젝트 목록에서 따로 확인할 수 있습니다.</p></section>}
      <ContentIdeaDashboardCard error={ideas.error} isLoading={ideas.isLoading} onRetry={ideas.refetch} summary={ideas.summary} />
    </main>
  )
}

export default MainDashboardPage
