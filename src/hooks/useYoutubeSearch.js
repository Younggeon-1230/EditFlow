import { useEffect, useRef, useState } from 'react'
import { fetchYoutubeVideos } from '../services/youtubeApi'

function useYoutubeSearch() {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('relevance')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestController = useRef(null)

  async function runSearch(searchQuery, searchOrder) {
    const normalizedQuery = searchQuery.trim()

    if (!normalizedQuery) {
      return
    }

    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller

    setQuery(normalizedQuery)
    setIsLoading(true)
    setError(null)

    try {
      const videos = await fetchYoutubeVideos({
        query: normalizedQuery,
        order: searchOrder,
        signal: controller.signal,
      })
      setResults(videos)
    } catch (searchError) {
      if (searchError.name !== 'AbortError') {
        setResults([])
        setError(searchError.message)
      }
    } finally {
      if (requestController.current === controller) {
        setIsLoading(false)
        requestController.current = null
      }
    }
  }

  function searchVideos(searchQuery) {
    runSearch(searchQuery, order)
  }

  function changeOrder(nextOrder) {
    setOrder(nextOrder)

    if (query) {
      runSearch(query, nextOrder)
    }
  }

  useEffect(
    () => () => {
      requestController.current?.abort()
    },
    [],
  )

  return {
    query,
    order,
    results,
    isLoading,
    error,
    searchVideos,
    changeOrder,
  }
}

export default useYoutubeSearch
