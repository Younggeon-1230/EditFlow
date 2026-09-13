import { useCallback, useEffect, useRef, useState } from 'react'
import { getProjects } from '../services/projectsApi.js'

function useServerProjects() {
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const controllerRef = useRef(null)
  const sequenceRef = useRef(0)

  const refetch = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    const sequence = ++sequenceRef.current
    controllerRef.current = controller
    setIsLoading(true)
    setError(null)
    try {
      const nextProjects = await getProjects(controller.signal)
      if (sequence === sequenceRef.current) setProjects(nextProjects)
      return nextProjects
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && sequence === sequenceRef.current) {
        setError(loadError.message || '서버 프로젝트를 불러오지 못했습니다.')
      }
      return null
    } finally {
      if (sequence === sequenceRef.current) {
        setIsLoading(false)
        controllerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    refetch()
    return () => {
      sequenceRef.current += 1
      controllerRef.current?.abort()
    }
  }, [refetch])

  return {
    projects,
    isLoading,
    error,
    hasResult: !isLoading && !error,
    refetch,
  }
}

export default useServerProjects
