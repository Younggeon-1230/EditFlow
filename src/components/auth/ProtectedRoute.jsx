import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ROUTES } from '../../constants/app.js'
import AuthStateScreen from './AuthStateScreen.jsx'

function ProtectedRoute() {
  const { authError, isAuthenticated, isLoading, refreshUser } = useAuth()
  const location = useLocation()

  if (isLoading) return <AuthStateScreen isLoading />
  if (authError) return <AuthStateScreen error={authError} onRetry={refreshUser} />
  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to={ROUTES.login} />
  }
  return <Outlet />
}

export default ProtectedRoute
