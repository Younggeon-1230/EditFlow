import { useMemo } from 'react'
import useServerProjects from './useServerProjects.js'
import { createProjectDashboardStats } from '../utils/projectRead.js'

function useDashboardSummary() {
  const server = useServerProjects()
  const stats = useMemo(
    () => createProjectDashboardStats(server.projects),
    [server.projects],
  )
  return { ...server, stats }
}

export default useDashboardSummary
