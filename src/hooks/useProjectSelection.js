import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useProjects from './useProjects'

function useProjectSelection() {
  const { projects } = useProjects()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryProjectId = searchParams.get('project') ?? ''
  const [selectedProjectId, setSelectedProjectIdState] = useState(
    queryProjectId,
  )

  useEffect(() => {
    const queryProject = projects.find(
      (project) => project.id === queryProjectId,
    )
    if (queryProject && queryProject.id !== selectedProjectId) {
      setSelectedProjectIdState(queryProject.id)
      return
    }

    if (
      projects.length > 0 &&
      !projects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectIdState(projects[0].id)
    }

    if (projects.length === 0 && selectedProjectId) {
      setSelectedProjectIdState('')
    }
  }, [projects, queryProjectId, selectedProjectId])

  function setSelectedProjectId(projectId) {
    setSelectedProjectIdState(projectId)
    const nextParams = new URLSearchParams(searchParams)
    if (projectId) {
      nextParams.set('project', projectId)
    } else {
      nextParams.delete('project')
    }
    setSearchParams(nextParams, { replace: true })
  }

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  return {
    projects,
    selectedProject,
    selectedProjectId,
    setSelectedProjectId,
  }
}

export default useProjectSelection
