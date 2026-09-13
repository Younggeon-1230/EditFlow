import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getAuthDestination } from '../../auth/authNavigation.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import AuthStateScreen from './AuthStateScreen.jsx'

function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <AuthStateScreen isLoading />
  if (isAuthenticated) {
    return <Navigate replace to={getAuthDestination(location.state?.from)} />
  }
  return <Outlet />
}

export default PublicOnlyRoute
