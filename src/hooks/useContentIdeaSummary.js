import { useCallback, useEffect, useRef, useState } from 'react'
import { getContentIdeaSummary } from '../services/contentIdeasApi.js'

function useContentIdeaSummary(refreshKey = 0) {
  const [summary, setSummary] = useState(null)
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
    try {
      const nextSummary = await getContentIdeaSummary(controller.signal)
      if (sequence === sequenceRef.current) {
        setSummary(nextSummary)
        setError(null)
      }
      return nextSummary
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && sequence === sequenceRef.current) {
        setError(loadError.message || '콘텐츠 소재 통계를 불러오지 못했습니다.')
      }
      return null
    } finally {
      if (sequence === sequenceRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
    return () => controllerRef.current?.abort()
  }, [refetch, refreshKey])

  return { summary, isLoading, error, refetch }
}

export default useContentIdeaSummary
