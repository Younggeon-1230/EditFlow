import { useEffect, useMemo, useRef, useState } from 'react'
import { getContentIdeas } from '../services/contentIdeasApi.js'

function useContentIdeaSelection(initialIdeaId = null) {
  const [ideas, setIdeas] = useState([])
  const [selectedIdeaId, setSelectedIdeaId] = useState(initialIdeaId)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const sequence = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const request = ++sequence.current
    setIsLoading(true)
    getContentIdeas({}, controller.signal)
      .then((items) => {
        if (request !== sequence.current) return
        setIdeas(items)
        setSelectedIdeaId((current) => {
          if (items.some((idea) => idea.id === current)) return current
          if (items.some((idea) => idea.id === initialIdeaId)) return initialIdeaId
          return items[0]?.id ?? null
        })
        setError(null)
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError' && request === sequence.current) {
          setError(loadError.message || '콘텐츠 소재 목록을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (request === sequence.current) setIsLoading(false)
      })
    return () => {
      sequence.current += 1
      controller.abort()
    }
  }, [initialIdeaId])

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
    [ideas, selectedIdeaId],
  )

  return { ideas, selectedIdea, selectedIdeaId, setSelectedIdeaId, isLoading, error }
}

export default useContentIdeaSelection
