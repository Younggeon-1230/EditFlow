import { useCallback, useEffect, useRef, useState } from 'react'
import { EMPTY_CONTENT_IDEA_FILTERS } from '../constants/contentIdeas.js'
import { ApiError } from '../services/apiClient.js'
import {
  createContentIdea,
  convertContentIdeaToProject,
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
  const [convertingIds, setConvertingIds] = useState(() => new Set())
  const [conversionError, setConversionError] = useState(null)
  const [mutationVersion, setMutationVersion] = useState(0)
  const requestSequence = useRef(0)
  const listController = useRef(null)
  const createLock = useRef(false)
  const updateLocks = useRef(new Set())
  const deleteLocks = useRef(new Set())
  const itemLocks = useRef(new Set())
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      listController.current?.abort()
    }
  }, [])

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
  }, [debouncedSearch, filters.status, filters.platform, filters.priority, filters.source, filters.sort, loadIdeas])

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
      setMutationVersion((current) => current + 1)
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
    if (itemLocks.current.has(ideaId)) return null
    itemLocks.current.add(ideaId)
    updateLocks.current.add(ideaId)
    setUpdatingIds((current) => new Set(current).add(ideaId))
    setError(null)
    try {
      const updated = await updateContentIdea(ideaId, changes)
      await refetch()
      setMutationVersion((current) => current + 1)
      return updated
    } catch (mutationError) {
      setErrorTitle('콘텐츠 소재를 수정하지 못했습니다.')
      setError(mutationError.message || '콘텐츠 소재를 수정하지 못했습니다.')
      return null
    } finally {
      itemLocks.current.delete(ideaId)
      updateLocks.current.delete(ideaId)
      setUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(ideaId)
        return next
      })
    }
  }

  async function removeIdea(ideaId) {
    if (itemLocks.current.has(ideaId)) return false
    itemLocks.current.add(ideaId)
    deleteLocks.current.add(ideaId)
    setDeletingIds((current) => new Set(current).add(ideaId))
    setError(null)
    try {
      await deleteContentIdea(ideaId)
      setItems((current) => current.filter((item) => item.id !== ideaId))
      setMutationVersion((current) => current + 1)
      return true
    } catch (mutationError) {
      if (mutationError instanceof ApiError && mutationError.status === 404) {
        setItems((current) => current.filter((item) => item.id !== ideaId))
        setMutationVersion((current) => current + 1)
        return true
      }
      setErrorTitle('콘텐츠 소재를 삭제하지 못했습니다.')
      setError(mutationError.message || '콘텐츠 소재를 삭제하지 못했습니다.')
      return false
    } finally {
      itemLocks.current.delete(ideaId)
      deleteLocks.current.delete(ideaId)
      setDeletingIds((current) => {
        const next = new Set(current)
        next.delete(ideaId)
        return next
      })
    }
  }

  async function convertIdeaToProject(ideaId, projectData) {
    if (itemLocks.current.has(ideaId)) return null
    itemLocks.current.add(ideaId)
    setConvertingIds((current) => new Set(current).add(ideaId))
    setConversionError(null)
    setError(null)
    try {
      const result = await convertContentIdeaToProject(ideaId, projectData)
      if (isMounted.current) {
        setItems((current) =>
          filters.status && filters.status !== 'converted'
            ? current.filter((idea) => idea.id !== ideaId)
            : current.map((idea) =>
                idea.id === ideaId ? result.contentIdea : idea,
              ),
        )
        setMutationVersion((current) => current + 1)
      }
      return result
    } catch (conversionError) {
      if (isMounted.current) {
        setConversionError(
          conversionError.message ||
            '콘텐츠 소재를 프로젝트로 전환하지 못했습니다.',
        )
        setErrorTitle('프로젝트로 전환하지 못했습니다.')
        setError(
          conversionError.message ||
            '콘텐츠 소재를 프로젝트로 전환하지 못했습니다.',
        )
      }
      return null
    } finally {
      itemLocks.current.delete(ideaId)
      if (isMounted.current) {
        setConvertingIds((current) => {
          const next = new Set(current)
          next.delete(ideaId)
          return next
        })
      }
    }
  }

  function clearFilters() {
    setFilters((current) => ({ ...EMPTY_CONTENT_IDEA_FILTERS, sort: current.sort }))
  }

  return {
    filters, setFilters, items, isLoading, error, errorTitle, isCreating,
    updatingIds, deletingIds, convertingIds, conversionError, refetch, addIdea,
    updateIdea: editIdea, removeIdea, convertIdeaToProject, clearFilters,
    mutationVersion, clearConversionError: () => setConversionError(null),
  }
}

export default useContentIdeas
