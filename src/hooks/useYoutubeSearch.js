import { useEffect, useRef, useState } from 'react'
import { fetchYoutubeVideos } from '../services/youtubeApi'

function useYoutubeSearch() {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('relevance')
  const [results, setResults] = useState([])
  const [nextPageToken, setNextPageToken] = useState(null)
  const [prevPageToken, setPrevPageToken] = useState(null)
  const [totalResults, setTotalResults] = useState(null)
  const [cached, setCached] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestController = useRef(null)
  const requestSequence = useRef(0)
  const activeRequestKey = useRef(null)

  async function runSearch(searchQuery, searchOrder, pageToken = null) {
    const normalizedQuery = searchQuery.trim()

    if (!normalizedQuery) {
      return
    }

    const requestKey = `${normalizedQuery}\u0000${searchOrder}\u0000${pageToken ?? ''}`

    if (activeRequestKey.current === requestKey) {
      return
    }

    requestController.current?.abort()
    const controller = new AbortController()
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence
    requestController.current = controller
    activeRequestKey.current = requestKey

    setQuery(normalizedQuery)
    setIsLoading(true)
    setError(null)
    if (pageToken === null) {
      setNextPageToken(null)
      setPrevPageToken(null)
    }

    try {
      const searchResponse = await fetchYoutubeVideos({
        query: normalizedQuery,
        order: searchOrder,
        pageToken,
        signal: controller.signal,
      })

      if (requestSequence.current !== sequence) {
        return
      }

      setResults(searchResponse.items)
      setNextPageToken(searchResponse.nextPageToken)
      setPrevPageToken(searchResponse.prevPageToken)
      setTotalResults(searchResponse.totalResults)
      setCached(searchResponse.cached)
    } catch (searchError) {
      if (
        searchError.name !== 'AbortError' &&
        requestSequence.current === sequence
      ) {
        setResults([])
        setNextPageToken(null)
        setPrevPageToken(null)
        setTotalResults(null)
        setCached(false)
        setError(searchError.message)
      }
    } finally {
      if (
        requestController.current === controller &&
        requestSequence.current === sequence
      ) {
        setIsLoading(false)
        requestController.current = null
        activeRequestKey.current = null
      }
    }
  }

  function searchVideos(searchQuery) {
    runSearch(searchQuery, order)
  }

  function changeOrder(nextOrder) {
    setOrder(nextOrder)

    if (query) {
      runSearch(query, nextOrder, null)
    }
  }

  function searchNextPage() {
    if (query && nextPageToken) {
      runSearch(query, order, nextPageToken)
    }
  }

  function searchPreviousPage() {
    if (query && prevPageToken) {
      runSearch(query, order, prevPageToken)
    }
  }

  useEffect(
    () => () => {
      requestSequence.current += 1
      requestController.current?.abort()
    },
    [],
  )

  return {
    query,
    order,
    results,
    nextPageToken,
    prevPageToken,
    totalResults,
    cached,
    isLoading,
    error,
    searchVideos,
    changeOrder,
    searchNextPage,
    searchPreviousPage,
  }
}

export default useYoutubeSearch
