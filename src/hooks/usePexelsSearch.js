import { useEffect, useRef, useState } from 'react'
import { fetchPexelsAssets } from '../services/pexelsApi'

function usePexelsSearch() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('videos')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestController = useRef(null)

  async function runSearch(searchQuery, searchType) {
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
      const assets = await fetchPexelsAssets({
        query: normalizedQuery,
        type: searchType,
        signal: controller.signal,
      })
      setResults(assets)
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

  function searchAssets(searchQuery) {
    runSearch(searchQuery, type)
  }

  function changeType(nextType) {
    setType(nextType)

    if (query) {
      runSearch(query, nextType)
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
    type,
    results,
    isLoading,
    error,
    searchAssets,
    changeType,
  }
}

export default usePexelsSearch
