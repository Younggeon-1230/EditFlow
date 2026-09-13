import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'

function AppLayout() {
  return (
    <div className="app">
      <Header />
      <Outlet />
    </div>
  )
}

export default AppLayout
