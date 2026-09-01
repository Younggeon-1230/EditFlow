import { useEffect, useRef, useState } from 'react'
import { getProjectSourceContentIdea } from '../services/projectRelationsApi.js'

function useProjectSourceContentIdea(backendProjectId) {
  const [idea, setIdea] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const sequenceRef = useRef(0)

  useEffect(() => {
    const sequence = ++sequenceRef.current
    if (!Number.isInteger(backendProjectId) || backendProjectId <= 0) {
      setIdea(null)
      setIsLoading(false)
      setError(null)
      return undefined
    }
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)
    getProjectSourceContentIdea(backendProjectId, controller.signal)
      .then((nextIdea) => {
        if (sequence === sequenceRef.current) setIdea(nextIdea)
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError' && sequence === sequenceRef.current) {
          setIdea(null)
          setError(loadError.message || '원본 콘텐츠 소재를 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (sequence === sequenceRef.current) setIsLoading(false)
      })
    return () => controller.abort()
  }, [backendProjectId])

  return { idea, isLoading, error }
}

export default useProjectSourceContentIdea
