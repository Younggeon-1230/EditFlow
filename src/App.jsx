import { Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute'
import PublicOnlyRoute from './components/auth/PublicOnlyRoute'
import AppLayout from './components/layout/AppLayout'
import { ROUTES } from './constants/app'
import BrollSearchPage from './pages/BrollSearchPage'
import ChecklistPage from './pages/ChecklistPage'
import ContentIdeasPage from './pages/ContentIdeasPage'
import ContentIdeaDetailPage from './pages/ContentIdeaDetailPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectListPage from './pages/ProjectListPage'
import ReferenceSearchPage from './pages/ReferenceSearchPage'
import SignupPage from './pages/SignupPage'

function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.signup} element={<SignupPage />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.reference} element={<ReferenceSearchPage />} />
          <Route path={ROUTES.broll} element={<BrollSearchPage />} />
          <Route path={ROUTES.projects} element={<ProjectListPage />} />
          <Route path={ROUTES.projectDetail} element={<ProjectDetailPage />} />
          <Route path={ROUTES.checklist} element={<ChecklistPage />} />
          <Route path={ROUTES.ideas} element={<ContentIdeasPage />} />
          <Route path={ROUTES.ideaDetail} element={<ContentIdeaDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
