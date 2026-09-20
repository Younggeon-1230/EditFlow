import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/apiClient.js'
import { getProject } from '../services/projectsApi.js'

function useServerProject(projectId) {
  const [project, setProject] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(projectId))
  const [error, setError] = useState(null)
  const [isNotFound, setIsNotFound] = useState(false)
  const controllerRef = useRef(null)
  const sequenceRef = useRef(0)

  const reload = useCallback(async () => {
    controllerRef.current?.abort()
    const sequence = ++sequenceRef.current
    if (!projectId) {
      setProject(null)
      setIsLoading(false)
      setError(null)
      setIsNotFound(false)
      return null
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setIsLoading(true)
    setError(null)
    setIsNotFound(false)
    try {
      const nextProject = await getProject(projectId, controller.signal)
      if (sequence === sequenceRef.current) setProject(nextProject)
      return nextProject
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && sequence === sequenceRef.current) {
        setProject(null)
        if (loadError instanceof ApiError && loadError.status === 404) {
          setIsNotFound(true)
        } else {
          setError(loadError.message || '서버 프로젝트를 불러오지 못했습니다.')
        }
      }
      return null
    } finally {
      if (sequence === sequenceRef.current) {
        setIsLoading(false)
        controllerRef.current = null
      }
    }
  }, [projectId])

  useEffect(() => {
    setProject(null)
    reload()
    return () => {
      sequenceRef.current += 1
      controllerRef.current?.abort()
    }
  }, [reload])

  const applyProject = useCallback((nextProject) => {
    setProject(nextProject)
    setError(null)
    setIsNotFound(false)
  }, [])

  return { project, isLoading, error, isNotFound, reload, applyProject }
}

export default useServerProject
