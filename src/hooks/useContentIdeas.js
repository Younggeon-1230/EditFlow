import { useCallback, useEffect, useRef, useState } from 'react'
import { EMPTY_CONTENT_IDEA_FILTERS } from '../constants/contentIdeas.js'
import { ApiError } from '../services/apiClient.js'
import {
  createContentIdea,
  deleteContentIdea,
  getContentIdeas,
  updateContentIdea,
} from '../services/contentIdeasApi.js'

function useContentIdeas() {
  const [filters, setFilters] = useState(EMPTY_CONTENT_IDEA_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorTitle, setErrorTitle] = useState('콘텐츠 소재를 불러오지 못했습니다.')
  const [isCreating, setIsCreating] = useState(false)
  const [updatingIds, setUpdatingIds] = useState(() => new Set())
  const [deletingIds, setDeletingIds] = useState(() => new Set())
  const requestSequence = useRef(0)
  const listController = useRef(null)
  const createLock = useRef(false)
  const updateLocks = useRef(new Set())
  const deleteLocks = useRef(new Set())

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [filters.search])

  const loadIdeas = useCallback(async (nextFilters) => {
    listController.current?.abort()
    const controller = new AbortController()
    listController.current = controller
    const sequence = ++requestSequence.current
    setIsLoading(true)
    try {
      const ideas = await getContentIdeas(nextFilters, controller.signal)
      if (sequence === requestSequence.current) {
        setItems(ideas)
        setError(null)
      }
      return ideas
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && sequence === requestSequence.current) {
        setErrorTitle('콘텐츠 소재를 불러오지 못했습니다.')
        setError(loadError.message || '콘텐츠 소재를 불러오지 못했습니다.')
      }
      return null
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadIdeas({ ...filters, search: debouncedSearch })
    return () => listController.current?.abort()
  }, [debouncedSearch, filters.status, filters.platform, filters.priority, filters.source, loadIdeas])

  const refetch = useCallback(
    () => loadIdeas({ ...filters, search: filters.search.trim() }),
    [filters, loadIdeas],
  )

  async function addIdea(values) {
    if (createLock.current) return null
    createLock.current = true
    setIsCreating(true)
    setError(null)
    try {
      const created = await createContentIdea(values)
      await refetch()
      return created
    } catch (mutationError) {
      setErrorTitle('콘텐츠 소재를 등록하지 못했습니다.')
      setError(mutationError.message || '콘텐츠 소재를 등록하지 못했습니다.')
      return null
    } finally {
      createLock.current = false
      setIsCreating(false)
    }
  }

  async function editIdea(ideaId, changes) {
    if (updateLocks.current.has(ideaId)) return null
    updateLocks.current.add(ideaId)
    setUpdatingIds((current) => new Set(current).add(ideaId))
    setError(null)
    try {
      const updated = await updateContentIdea(ideaId, changes)
      await refetch()
      return updated
    } catch (mutationError) {
      setErrorTitle('콘텐츠 소재를 수정하지 못했습니다.')
      setError(mutationError.message || '콘텐츠 소재를 수정하지 못했습니다.')
      return null
    } finally {
      updateLocks.current.delete(ideaId)
      setUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(ideaId)
        return next
      })
    }
  }

  async function removeIdea(ideaId) {
    if (deleteLocks.current.has(ideaId)) return false
    deleteLocks.current.add(ideaId)
    setDeletingIds((current) => new Set(current).add(ideaId))
    setError(null)
    try {
      await deleteContentIdea(ideaId)
      setItems((current) => current.filter((item) => item.id !== ideaId))
      return true
    } catch (mutationError) {
      if (mutationError instanceof ApiError && mutationError.status === 404) {
        setItems((current) => current.filter((item) => item.id !== ideaId))
        return true
      }
      setErrorTitle('콘텐츠 소재를 삭제하지 못했습니다.')
      setError(mutationError.message || '콘텐츠 소재를 삭제하지 못했습니다.')
      return false
    } finally {
      deleteLocks.current.delete(ideaId)
      setDeletingIds((current) => {
        const next = new Set(current)
        next.delete(ideaId)
        return next
      })
    }
  }

  function clearFilters() {
    setFilters({ ...EMPTY_CONTENT_IDEA_FILTERS })
  }

  return {
    filters, setFilters, items, isLoading, error, errorTitle, isCreating,
    updatingIds, deletingIds, refetch, addIdea, updateIdea: editIdea,
    removeIdea, clearFilters,
  }
}

export default useContentIdeas
