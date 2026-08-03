import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/apiClient.js'
import {
  createProjectMemo,
  deleteProjectMemo,
  getProjectMemos,
  updateProjectMemo,
} from '../services/projectMemosApi.js'
import {
  loadStoredProjectMemos,
  persistProjectMemos,
} from '../utils/projectMemosStorage.js'

function isBackendProjectId(value) {
  return Number.isInteger(value) && value > 0
}

function createLocalMemoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `local-memo-${crypto.randomUUID()}`
  }
  return `local-memo-${Date.now()}`
}

function normalizeContent(content) {
  const normalized = String(content ?? '').trim()
  if (!normalized) {
    throw new Error('메모 내용을 입력해 주세요.')
  }
  if (normalized.length > 5000) {
    throw new Error('메모는 5,000자 이하로 입력해 주세요.')
  }
  return normalized
}

function sortMemos(items) {
  return [...items].sort((left, right) => {
    const positionDifference = left.position - right.position
    return positionDifference || String(left.id).localeCompare(String(right.id))
  })
}

function useProjectMemos(localProjectId, backendProjectId = null) {
  const [localMemos, setLocalMemos] = useState(loadStoredProjectMemos)
  const [serverItems, setServerItems] = useState([])
  const [itemsProjectId, setItemsProjectId] = useState(null)
  const [isLoadingState, setIsLoadingState] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [updatingIds, setUpdatingIds] = useState(() => new Set())
  const [deletingIds, setDeletingIds] = useState(() => new Set())
  const [error, setError] = useState(null)
  const listController = useRef(null)
  const listSequence = useRef(0)
  const itemsProjectIdRef = useRef(itemsProjectId)
  const currentProjectId = useRef(backendProjectId)
  const mutationControllers = useRef(new Set())
  const creatingRef = useRef(false)
  const updatingIdsRef = useRef(new Set())
  const deletingIdsRef = useRef(new Set())
  const isMounted = useRef(true)

  const isServerMode = isBackendProjectId(backendProjectId)
  currentProjectId.current = backendProjectId
  itemsProjectIdRef.current = itemsProjectId
  const localItems = Array.isArray(localMemos[localProjectId])
    ? sortMemos(localMemos[localProjectId])
    : []
  const items =
    isServerMode && itemsProjectId === backendProjectId
      ? serverItems
      : isServerMode
        ? []
        : localItems
  const isLoading =
    isLoadingState || (isServerMode && itemsProjectId !== backendProjectId)

  const refetch = useCallback(async () => {
    if (!isBackendProjectId(backendProjectId)) {
      listController.current?.abort()
      listSequence.current += 1
      setServerItems([])
      setItemsProjectId(null)
      itemsProjectIdRef.current = null
      setIsLoadingState(false)
      setError(null)
      return []
    }

    listController.current?.abort()
    const controller = new AbortController()
    const sequence = listSequence.current + 1
    listSequence.current = sequence
    listController.current = controller
    if (itemsProjectIdRef.current !== backendProjectId) {
      setServerItems([])
    }
    setItemsProjectId(backendProjectId)
    itemsProjectIdRef.current = backendProjectId
    setIsLoadingState(true)
    setError(null)

    try {
      const nextItems = await getProjectMemos(
        backendProjectId,
        controller.signal,
      )
      if (
        isMounted.current &&
        listSequence.current === sequence &&
        currentProjectId.current === backendProjectId
      ) {
        setServerItems(nextItems)
        return nextItems
      }
    } catch (loadError) {
      if (
        loadError.name !== 'AbortError' &&
        isMounted.current &&
        listSequence.current === sequence &&
        currentProjectId.current === backendProjectId
      ) {
        setError(loadError.message)
      }
    } finally {
      if (
        isMounted.current &&
        listSequence.current === sequence &&
        currentProjectId.current === backendProjectId
      ) {
        setIsLoadingState(false)
        listController.current = null
      }
    }
    return []
  }, [backendProjectId])

  useEffect(() => {
    refetch()
    return () => {
      listSequence.current += 1
      listController.current?.abort()
    }
  }, [refetch])

  useEffect(() => {
    mutationControllers.current.forEach((controller) => controller.abort())
    mutationControllers.current.clear()
    creatingRef.current = false
    updatingIdsRef.current.clear()
    deletingIdsRef.current.clear()
    setIsCreating(false)
    setUpdatingIds(new Set())
    setDeletingIds(new Set())

    return () => {
      mutationControllers.current.forEach((controller) => controller.abort())
      mutationControllers.current.clear()
    }
  }, [backendProjectId, localProjectId])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  function updateLocalItems(updater) {
    setLocalMemos((current) => {
      const currentItems = Array.isArray(current[localProjectId])
        ? current[localProjectId]
        : []
      const next = {
        ...current,
        [localProjectId]: sortMemos(updater(currentItems)),
      }
      persistProjectMemos(next)
      return next
    })
  }

  async function addMemo(content) {
    if (creatingRef.current || !localProjectId) {
      return null
    }
    let normalized
    try {
      normalized = normalizeContent(content)
    } catch (validationError) {
      setError(validationError.message)
      return null
    }

    if (!isServerMode) {
      const currentItems = localItems
      const maxPosition = currentItems.reduce(
        (maximum, memo) => Math.max(maximum, memo.position),
        -1,
      )
      const timestamp = new Date().toISOString()
      const memo = {
        id: createLocalMemoId(),
        content: normalized,
        position: maxPosition + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      updateLocalItems((items) => [...items, memo])
      setError(null)
      return memo
    }

    const controller = new AbortController()
    const targetProjectId = backendProjectId
    creatingRef.current = true
    mutationControllers.current.add(controller)
    setIsCreating(true)
    setError(null)
    try {
      const memo = await createProjectMemo(
        targetProjectId,
        normalized,
        controller.signal,
      )
      if (currentProjectId.current === targetProjectId) {
        setServerItems((current) => sortMemos([...current, memo]))
      }
      return memo
    } catch (createError) {
      if (
        createError.name !== 'AbortError' &&
        currentProjectId.current === targetProjectId
      ) {
        setError(createError.message)
      }
      return null
    } finally {
      creatingRef.current = false
      mutationControllers.current.delete(controller)
      if (isMounted.current && currentProjectId.current === targetProjectId) {
        setIsCreating(false)
      }
    }
  }

  async function updateMemo(memoId, changes) {
    if (updatingIdsRef.current.has(memoId)) {
      return null
    }
    let normalizedChanges
    try {
      normalizedChanges = {
        ...changes,
        ...(Object.prototype.hasOwnProperty.call(changes, 'content')
          ? { content: normalizeContent(changes.content) }
          : {}),
      }
      if (
        Object.prototype.hasOwnProperty.call(changes, 'position') &&
        (!Number.isInteger(changes.position) || changes.position < 0)
      ) {
        throw new Error('메모 순서를 확인해 주세요.')
      }
      if (Object.keys(normalizedChanges).length === 0) {
        throw new Error('수정할 메모 내용이 없습니다.')
      }
    } catch (validationError) {
      setError(validationError.message)
      return null
    }

    if (!isServerMode) {
      const existing = localItems.find((memo) => memo.id === memoId)
      if (!existing) {
        return null
      }
      const updated = {
        ...existing,
        ...normalizedChanges,
        updatedAt: new Date().toISOString(),
      }
      updateLocalItems((items) =>
        items.map((memo) => (memo.id === memoId ? updated : memo)),
      )
      setError(null)
      return updated
    }

    const controller = new AbortController()
    const targetProjectId = backendProjectId
    updatingIdsRef.current.add(memoId)
    mutationControllers.current.add(controller)
    setUpdatingIds((current) => new Set(current).add(memoId))
    setError(null)
    try {
      const updated = await updateProjectMemo(
        memoId,
        normalizedChanges,
        controller.signal,
      )
      if (currentProjectId.current === targetProjectId) {
        setServerItems((current) =>
          sortMemos(
            current.map((memo) => (memo.id === memoId ? updated : memo)),
          ),
        )
      }
      return updated
    } catch (updateError) {
      if (
        updateError.name !== 'AbortError' &&
        currentProjectId.current === targetProjectId
      ) {
        setError(updateError.message)
      }
      return null
    } finally {
      updatingIdsRef.current.delete(memoId)
      mutationControllers.current.delete(controller)
      if (isMounted.current && currentProjectId.current === targetProjectId) {
        setUpdatingIds((current) => {
          const next = new Set(current)
          next.delete(memoId)
          return next
        })
      }
    }
  }

  async function deleteMemo(memoId) {
    if (deletingIdsRef.current.has(memoId)) {
      return false
    }
    if (!isServerMode) {
      const exists = localItems.some((memo) => memo.id === memoId)
      if (!exists) {
        return false
      }
      updateLocalItems((items) => items.filter((memo) => memo.id !== memoId))
      setError(null)
      return true
    }

    const controller = new AbortController()
    const targetProjectId = backendProjectId
    deletingIdsRef.current.add(memoId)
    mutationControllers.current.add(controller)
    setDeletingIds((current) => new Set(current).add(memoId))
    setError(null)
    try {
      await deleteProjectMemo(memoId, controller.signal)
      if (currentProjectId.current === targetProjectId) {
        setServerItems((current) =>
          current.filter((memo) => memo.id !== memoId),
        )
      }
      return true
    } catch (deleteError) {
      if (deleteError instanceof ApiError && deleteError.status === 404) {
        if (currentProjectId.current === targetProjectId) {
          setServerItems((current) =>
            current.filter((memo) => memo.id !== memoId),
          )
        }
        return true
      }
      if (
        deleteError.name !== 'AbortError' &&
        currentProjectId.current === targetProjectId
      ) {
        setError(deleteError.message)
      }
      return false
    } finally {
      deletingIdsRef.current.delete(memoId)
      mutationControllers.current.delete(controller)
      if (isMounted.current && currentProjectId.current === targetProjectId) {
        setDeletingIds((current) => {
          const next = new Set(current)
          next.delete(memoId)
          return next
        })
      }
    }
  }

  return {
    items,
    isLoading,
    error,
    storageMode: isServerMode ? 'server' : 'local',
    isCreating,
    isUpdating: (memoId) => updatingIds.has(memoId),
    isDeleting: (memoId) => deletingIds.has(memoId),
    addMemo,
    updateMemo,
    deleteMemo,
    refetch,
  }
}

export default useProjectMemos
