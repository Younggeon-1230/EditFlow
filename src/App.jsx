import { Route, Routes } from 'react-router-dom'
import Header from './components/layout/Header'
import BrollSearchPage from './pages/BrollSearchPage'
import ChecklistPage from './pages/ChecklistPage'
import MainDashboardPage from './pages/MainDashboardPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectListPage from './pages/ProjectListPage'
import ReferenceSearchPage from './pages/ReferenceSearchPage'

function App() {
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<MainDashboardPage />} />
        <Route path="/reference" element={<ReferenceSearchPage />} />
        <Route path="/broll" element={<BrollSearchPage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/checklist" element={<ChecklistPage />} />
      </Routes>
    </div>
  )
}

export default App
