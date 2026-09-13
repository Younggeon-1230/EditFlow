import { useAuth } from '../auth/AuthContext.jsx'
import AuthStateScreen from '../components/auth/AuthStateScreen.jsx'
import MainDashboardPage from './MainDashboardPage.jsx'
import PublicHomePage from './PublicHomePage.jsx'

function HomePage() {
  const { authError, isAuthenticated, isLoading, refreshUser } = useAuth()

  if (isLoading) return <AuthStateScreen isLoading />
  if (authError) return <AuthStateScreen error={authError} onRetry={refreshUser} />
  if (isAuthenticated) return <MainDashboardPage />

  return <PublicHomePage />
}

export default HomePage
