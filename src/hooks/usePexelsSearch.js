import { useEffect, useRef, useState } from 'react'
import { fetchPexelsAssets } from '../services/pexelsApi'

function usePexelsSearch() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('videos')
  const [results, setResults] = useState([])
  const [page, setPage] = useState(1)
  const [nextPage, setNextPage] = useState(null)
  const [prevPage, setPrevPage] = useState(null)
  const [totalResults, setTotalResults] = useState(null)
  const [orientation, setOrientation] = useState(null)
  const [size, setSize] = useState(null)
  const [cached, setCached] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestController = useRef(null)
  const requestSequence = useRef(0)
  const activeRequestKey = useRef(null)

  async function runSearch(
    searchQuery,
    searchType,
    requestedPage = 1,
    filters = { orientation, size },
  ) {
    const normalizedQuery = searchQuery.trim()

    if (!normalizedQuery) {
      return
    }

    const requestKey = [
      normalizedQuery,
      searchType,
      requestedPage,
      filters.orientation ?? '',
      filters.size ?? '',
    ].join('\u0000')

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
    if (requestedPage === 1) {
      setPage(1)
      setNextPage(null)
      setPrevPage(null)
    }

    try {
      const searchResponse = await fetchPexelsAssets({
        query: normalizedQuery,
        type: searchType,
        page: requestedPage,
        orientation: filters.orientation,
        size: filters.size,
        signal: controller.signal,
      })

      if (requestSequence.current !== sequence) {
        return
      }

      setResults(searchResponse.items)
      setPage(searchResponse.page)
      setNextPage(searchResponse.nextPage)
      setPrevPage(searchResponse.prevPage)
      setTotalResults(searchResponse.totalResults)
      setCached(searchResponse.cached)
    } catch (searchError) {
      if (
        searchError.name !== 'AbortError' &&
        requestSequence.current === sequence
      ) {
        setResults([])
        setPage(1)
        setNextPage(null)
        setPrevPage(null)
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

  function searchAssets(searchQuery) {
    runSearch(searchQuery, type)
  }

  function changeType(nextType) {
    setType(nextType)

    if (query) {
      runSearch(query, nextType, 1)
    }
  }

  function changeFilters(nextFilters) {
    const filters = {
      orientation: nextFilters.orientation ?? null,
      size: nextFilters.size ?? null,
    }
    setOrientation(filters.orientation)
    setSize(filters.size)

    if (query) {
      runSearch(query, type, 1, filters)
    }
  }

  function searchNextPage() {
    if (query && nextPage) {
      runSearch(query, type, nextPage)
    }
  }

  function searchPreviousPage() {
    if (query && prevPage) {
      runSearch(query, type, prevPage)
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
    type,
    results,
    page,
    nextPage,
    prevPage,
    totalResults,
    orientation,
    size,
    cached,
    isLoading,
    error,
    searchAssets,
    changeType,
    changeFilters,
    searchNextPage,
    searchPreviousPage,
  }
}

export default usePexelsSearch
