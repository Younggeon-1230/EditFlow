import { NavLink } from 'react-router-dom'
import { ROUTES } from '../../constants/app'

const navigationItems = [
  { label: '레퍼런스 검색', to: ROUTES.reference },
  { label: 'B-roll 검색', to: ROUTES.broll },
  { label: '프로젝트', to: ROUTES.projects },
  { label: '체크리스트', to: ROUTES.checklist },
]

function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <NavLink className="logo" end to={ROUTES.home}>
          EditFlow
        </NavLink>

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
      </div>
    </header>
  )
}

export default Header
