import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/apiClient.js'
import {
  convertContentIdeaToProject,
  deleteContentIdea,
  getContentIdea,
  updateContentIdea,
} from '../services/contentIdeasApi.js'

function useContentIdeaDetail(ideaId) {
  const [idea, setIdea] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(ideaId))
  const [error, setError] = useState(null)
  const [isNotFound, setIsNotFound] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [conversionError, setConversionError] = useState(null)
  const controllerRef = useRef(null)
  const requestSequence = useRef(0)
  const actionLock = useRef(false)
  const isMounted = useRef(true)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    if (!ideaId) {
      setIdea(null)
      setIsLoading(false)
      return null
    }
    const controller = new AbortController()
    controllerRef.current = controller
    const sequence = ++requestSequence.current
    setIsLoading(true)
    setError(null)
    setIsNotFound(false)
    try {
      const nextIdea = await getContentIdea(ideaId, controller.signal)
      if (isMounted.current && sequence === requestSequence.current) {
        setIdea(nextIdea)
      }
      return nextIdea
    } catch (loadError) {
      if (loadError.name !== 'AbortError' && isMounted.current && sequence === requestSequence.current) {
        setIsNotFound(loadError instanceof ApiError && loadError.status === 404)
        setError(loadError.message || '콘텐츠 소재를 불러오지 못했습니다.')
      }
      return null
    } finally {
      if (isMounted.current && sequence === requestSequence.current) setIsLoading(false)
    }
  }, [ideaId])

  useEffect(() => {
    isMounted.current = true
    load()
    return () => {
      isMounted.current = false
      requestSequence.current += 1
      controllerRef.current?.abort()
    }
  }, [load])

  async function runAction(name, action) {
    if (actionLock.current) return null
    actionLock.current = true
    setPendingAction(name)
    setActionError(null)
    if (name === 'convert') setConversionError(null)
    try {
      return await action()
    } catch (mutationError) {
      const message = mutationError.message || '요청을 처리하지 못했습니다.'
      if (isMounted.current) {
        setActionError(message)
        if (name === 'convert') setConversionError(message)
      }
      return null
    } finally {
      actionLock.current = false
      if (isMounted.current) setPendingAction(null)
    }
  }

  async function update(values) {
    return runAction('update', async () => {
      const updated = await updateContentIdea(ideaId, values)
      if (isMounted.current) setIdea(updated)
      return updated
    })
  }

  async function remove() {
    const result = await runAction('delete', async () => {
      try {
        await deleteContentIdea(ideaId)
      } catch (deleteError) {
        if (!(deleteError instanceof ApiError && deleteError.status === 404)) throw deleteError
      }
      return true
    })
    return Boolean(result)
  }

  async function convert(values) {
    return runAction('convert', async () => {
      const result = await convertContentIdeaToProject(ideaId, values)
      if (isMounted.current) setIdea(result.contentIdea)
      return result
    })
  }

  return {
    idea,
    isLoading,
    error,
    isNotFound,
    pendingAction,
    actionError,
    conversionError,
    reload: load,
    update,
    remove,
    convert,
    clearActionError: () => setActionError(null),
  }
}

export default useContentIdeaDetail
