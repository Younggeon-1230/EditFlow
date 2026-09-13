import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { ROUTES } from '../../constants/app'

const navigationItems = [
  { label: '콘텐츠 소재', to: ROUTES.ideas },
  { label: '레퍼런스 검색', to: ROUTES.reference },
  { label: 'B-roll 검색', to: ROUTES.broll },
  { label: '프로젝트', to: ROUTES.projects },
  { label: '체크리스트', to: ROUTES.checklist },
]

function Header() {
  const { isAuthenticated, isLoading, logout, user } = useAuth()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError('')
    try {
      await logout()
      navigate(ROUTES.login, { replace: true })
    } catch {
      setLogoutError('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <NavLink className="logo" end to={ROUTES.home}>
          EditFlow
        </NavLink>

        {!isLoading && isAuthenticated && (
          <div className="header-content">
            <nav className="main-navigation" aria-label="주요 메뉴">
              {navigationItems.map((item) => (
                <NavLink
                  className={({ isActive }) =>
                    `navigation-link${isActive ? ' active' : ''}`
                  }
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="header-account">
              <span className="header-user-email" title={user?.email}>{user?.email}</span>
              <button disabled={isLoggingOut} onClick={handleLogout} type="button">
                {isLoggingOut ? '로그아웃 중…' : '로그아웃'}
              </button>
            </div>
          </div>
        )}
        {!isLoading && !isAuthenticated && (
          <nav className="public-navigation" aria-label="계정 메뉴">
            <Link className="public-navigation-login" to={ROUTES.login}>로그인</Link>
            <Link className="public-navigation-signup" to={ROUTES.signup}>회원가입</Link>
          </nav>
        )}
      </div>
      {logoutError && <p className="header-auth-error" role="alert">{logoutError}</p>}
    </header>
  )
}

export default Header
