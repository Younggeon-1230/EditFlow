import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useLegacyProjects from './useLegacyProjects.js'
import useServerProjects from './useServerProjects.js'

function useProjectSelection() {
  const server = useServerProjects()
  const legacy = useLegacyProjects(server.projects, server.hasResult)
  const [searchParams, setSearchParams] = useSearchParams()
  const queryProjectId = searchParams.get('project') ?? ''
  const projects = useMemo(() => [
    ...server.projects.map((project) => ({ ...project, projectKind: 'server', backendProjectId: project.id, selectionId: String(project.id) })),
    ...legacy.projects.map((project) => ({ ...project, projectKind: 'local', backendProjectId: null, selectionId: `local:${project.id}` })),
  ], [legacy.projects, server.projects])
  const [selectedProjectId, setSelectedProjectIdState] = useState(queryProjectId)

  useEffect(() => {
    if (projects.some((project) => project.selectionId === queryProjectId)) {
      setSelectedProjectIdState(queryProjectId)
    } else if (!projects.some((project) => project.selectionId === selectedProjectId)) {
      setSelectedProjectIdState(projects[0]?.selectionId ?? '')
    }
  }, [projects, queryProjectId, selectedProjectId])

  function setSelectedProjectId(projectId) {
    setSelectedProjectIdState(projectId)
    const nextParams = new URLSearchParams(searchParams)
    if (projectId) nextParams.set('project', projectId)
    else nextParams.delete('project')
    setSearchParams(nextParams, { replace: true })
  }

  const selectedProject = useMemo(
    () => projects.find((project) => project.selectionId === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  return { projects, selectedProject, selectedProjectId, setSelectedProjectId, isLoading: server.isLoading, error: server.error, refetch: server.refetch }
}

export default useProjectSelection
