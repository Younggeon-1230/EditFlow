import { Route, Routes } from 'react-router-dom'
import Header from './components/layout/Header'
import { ROUTES } from './constants/app'
import BrollSearchPage from './pages/BrollSearchPage'
import ChecklistPage from './pages/ChecklistPage'
import MainDashboardPage from './pages/MainDashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectListPage from './pages/ProjectListPage'
import ReferenceSearchPage from './pages/ReferenceSearchPage'

function App() {
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path={ROUTES.home} element={<MainDashboardPage />} />
        <Route path={ROUTES.reference} element={<ReferenceSearchPage />} />
        <Route path={ROUTES.broll} element={<BrollSearchPage />} />
        <Route path={ROUTES.projects} element={<ProjectListPage />} />
        <Route path={ROUTES.projectDetail} element={<ProjectDetailPage />} />
        <Route path={ROUTES.checklist} element={<ChecklistPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

export default App
