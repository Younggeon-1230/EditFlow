import { useCallback, useEffect, useRef, useState } from 'react'
import { getProject } from '../services/projectsApi.js'

function useContentIdeaProjectRelation(backendProjectId) {
  const [project, setProject] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const sequenceRef = useRef(0)
  const controllerRef = useRef(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const sequence = ++sequenceRef.current
    if (!Number.isInteger(backendProjectId) || backendProjectId <= 0) {
      setProject(null)
      setIsLoading(false)
      setError(null)
      return null
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setIsLoading(true)
    setError(null)
    try {
      const nextProject = await getProject(backendProjectId, controller.signal)
      if (sequence === sequenceRef.current) setProject(nextProject)
      return nextProject
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && sequence === sequenceRef.current) {
        setProject(null)
        setError(loadError.message || '연결된 프로젝트를 불러오지 못했습니다.')
      }
      return null
    } finally {
      if (sequence === sequenceRef.current) setIsLoading(false)
    }
  }, [backendProjectId])

  useEffect(() => {
    load()
    return () => {
      sequenceRef.current += 1
      controllerRef.current?.abort()
    }
  }, [load])

  return { project, isLoading, error, reload: load }
}

export default useContentIdeaProjectRelation
