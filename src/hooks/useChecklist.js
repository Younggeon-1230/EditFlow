import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import initialChecklist, {
  defaultChecklistTemplate,
} from '../data/initialChecklist.js'
import {
  createChecklistItem,
  createDefaultChecklist,
  deleteChecklistItem,
  getChecklistItems,
  updateChecklistItem,
} from '../services/checklistItemsApi.js'
import useUserStorageKey from './useUserStorageKey.js'

function isBackendProjectId(value) {
  return Number.isInteger(value) && value > 0
}

function loadChecklists(storageKey) {
  if (!storageKey) return initialChecklist
  try {
    const storedChecklists = localStorage.getItem(storageKey)

    if (!storedChecklists) {
      return initialChecklist
    }

    const parsedChecklists = JSON.parse(storedChecklists)
    return parsedChecklists &&
      typeof parsedChecklists === 'object' &&
      !Array.isArray(parsedChecklists)
      ? parsedChecklists
      : initialChecklist
  } catch {
    return initialChecklist
  }
}

function persistChecklists(storageKey, checklists) {
  if (!storageKey) return
  try {
    localStorage.setItem(storageKey, JSON.stringify(checklists))
  } catch {
    // Keep local checklist editing available in memory when storage is blocked.
  }
}

function createChecklistItemId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `task-${Date.now()}`
}

function cloneChecklistItems(items) {
  return items.map((item) => ({ ...item }))
}

function sortServerItems(items) {
  return [...items].sort(
    (left, right) =>
      left.position - right.position ||
      left.id - right.id,
  )
}

function getChangedFields(item, changes) {
  const changed = {}

  if (
    Object.prototype.hasOwnProperty.call(changes, 'text') ||
    Object.prototype.hasOwnProperty.call(changes, 'title')
  ) {
    const text = String(changes.text ?? changes.title ?? '').trim()
    if (text && text !== item.text) {
      changed.text = text
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(changes, 'description') &&
    changes.description !== item.description
  ) {
    changed.description = changes.description
  }
  if (
    Object.prototype.hasOwnProperty.call(changes, 'done') ||
    Object.prototype.hasOwnProperty.call(changes, 'isCompleted')
  ) {
    const done = Boolean(changes.done ?? changes.isCompleted)
    if (done !== item.done) {
      changed.done = done
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(changes, 'position') &&
    changes.position !== item.position
  ) {
    changed.position = changes.position
  }

  return changed
}

function useChecklist(projectTarget) {
  const checklistStorageKey = useUserStorageKey('checklists')
  const isSyncedProject = projectTarget?.kind === 'server'
  const backendProjectId = isSyncedProject ? projectTarget.id : null
  const projectId = projectTarget?.kind === 'local'
    ? projectTarget.id
    : isSyncedProject
      ? String(projectTarget.id)
      : ''
  const [checklists, setChecklists] = useState(() =>
    projectTarget?.kind === 'local' ? loadChecklists(checklistStorageKey) : {},
  )
  const [serverItems, setServerItems] = useState([])
  const [itemsBackendProjectId, setItemsBackendProjectId] = useState(null)
  const [isLoadingState, setIsLoadingState] = useState(false)
  const [pendingKeys, setPendingKeys] = useState(() => new Set())
  const [isImportingDefault, setIsImportingDefault] = useState(false)
  const [error, setError] = useState(null)
  const listController = useRef(null)
  const listSequence = useRef(0)
  const itemsBackendProjectIdRef = useRef(itemsBackendProjectId)
  const currentBackendProjectId = useRef(backendProjectId)
  const mutationControllers = useRef(new Map())
  const pendingKeysRef = useRef(new Set())
  const exclusiveController = useRef(null)
  const isMounted = useRef(true)

  currentBackendProjectId.current = backendProjectId
  itemsBackendProjectIdRef.current = itemsBackendProjectId

  const localItems = useMemo(
    () => (
      projectTarget?.kind === 'local' && Array.isArray(checklists[projectId])
        ? checklists[projectId]
        : []
    ),
    [checklists, projectId, projectTarget?.kind],
  )
  const visibleServerItems =
    itemsBackendProjectId === backendProjectId ? serverItems : []
  const items = isSyncedProject ? visibleServerItems : localItems
  const completedCount = useMemo(
    () => items.filter((item) => item.done).length,
    [items],
  )
  const progress =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0
  const isWaitingForProject =
    isSyncedProject && itemsBackendProjectId !== backendProjectId
  const isLoading = isLoadingState || isWaitingForProject
  const isSaving =
    pendingKeys.size > 0 || isImportingDefault

  useEffect(() => {
    if (projectTarget?.kind === 'local') {
      setChecklists(loadChecklists(checklistStorageKey))
    } else {
      setChecklists({})
    }
  }, [checklistStorageKey, projectId, projectTarget?.kind])

  const loadServerItems = useCallback(async () => {
    if (!isBackendProjectId(backendProjectId)) {
      listController.current?.abort()
      listSequence.current += 1
      setServerItems([])
      setItemsBackendProjectId(null)
      itemsBackendProjectIdRef.current = null
      setIsLoadingState(false)
      setError(null)
      return []
    }

    listController.current?.abort()
    const controller = new AbortController()
    const sequence = listSequence.current + 1
    listSequence.current = sequence
    listController.current = controller
    if (itemsBackendProjectIdRef.current !== backendProjectId) {
      setServerItems([])
    }
    setItemsBackendProjectId(backendProjectId)
    itemsBackendProjectIdRef.current = backendProjectId
    setIsLoadingState(true)
    setError(null)

    try {
      const nextItems = await getChecklistItems(
        backendProjectId,
        controller.signal,
      )
      if (
        isMounted.current &&
        listSequence.current === sequence &&
        currentBackendProjectId.current === backendProjectId
      ) {
        const mappedItems = nextItems.map((item) => ({ ...item, projectId }))
        setServerItems(mappedItems)
        return mappedItems
      }
    } catch (loadError) {
      if (
        loadError.name !== 'AbortError' &&
        isMounted.current &&
        listSequence.current === sequence &&
        currentBackendProjectId.current === backendProjectId
      ) {
        setError(loadError.message)
      }
    } finally {
      if (
        isMounted.current &&
        listSequence.current === sequence &&
        currentBackendProjectId.current === backendProjectId
      ) {
        setIsLoadingState(false)
        listController.current = null
      }
    }

    return []
  }, [backendProjectId, projectId])

  useEffect(() => {
    loadServerItems()
    return () => {
      listSequence.current += 1
      listController.current?.abort()
    }
  }, [loadServerItems])

  useEffect(() => {
    mutationControllers.current.forEach((controller) => controller.abort())
    mutationControllers.current.clear()
    pendingKeysRef.current.clear()
    exclusiveController.current?.abort()
    exclusiveController.current = null
    setPendingKeys(new Set())
    setIsImportingDefault(false)

    return () => {
      mutationControllers.current.forEach((controller) => controller.abort())
      mutationControllers.current.clear()
      exclusiveController.current?.abort()
    }
  }, [backendProjectId, projectId])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  function updateLocalProjectItems(updateItems, targetProjectId = projectId) {
    if (projectTarget?.kind !== 'local' || !targetProjectId) {
      return
    }

    setChecklists((currentChecklists) => {
      const currentItems = Array.isArray(currentChecklists[targetProjectId])
        ? currentChecklists[targetProjectId]
        : []
      const nextChecklists = {
        ...currentChecklists,
        [targetProjectId]: updateItems(currentItems),
      }
      persistChecklists(checklistStorageKey, nextChecklists)
      return nextChecklists
    })
  }

  function beginMutation(key) {
    if (
      exclusiveController.current ||
      pendingKeysRef.current.has(key)
    ) {
      return null
    }

    const controller = new AbortController()
    pendingKeysRef.current.add(key)
    mutationControllers.current.set(key, controller)
    setPendingKeys((current) => new Set(current).add(key))
    setError(null)
    return controller
  }

  function endMutation(key, controller) {
    if (mutationControllers.current.get(key) !== controller) {
      return
    }
    pendingKeysRef.current.delete(key)
    mutationControllers.current.delete(key)
    if (isMounted.current) {
      setPendingKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function addItem(text) {
    const normalizedText = text.trim()
    if (!normalizedText || !projectId) {
      return null
    }

    if (!isSyncedProject) {
      const newItem = {
        id: createChecklistItemId(),
        text: normalizedText,
        done: false,
      }
      updateLocalProjectItems((currentItems) => [...currentItems, newItem])
      return newItem
    }

    const targetBackendProjectId = backendProjectId
    const key = `${targetBackendProjectId}:add`
    const controller = beginMutation(key)
    if (!controller) {
      return null
    }

    try {
      const created = await createChecklistItem(
        targetBackendProjectId,
        { title: normalizedText },
        controller.signal,
      )
      if (
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        const mapped = { ...created, projectId }
        setServerItems((current) => sortServerItems([...current, mapped]))
        return mapped
      }
    } catch (createError) {
      if (
        createError.name !== 'AbortError' &&
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        setError(createError.message)
      }
    } finally {
      endMutation(key, controller)
    }

    return null
  }

  async function updateItem(itemId, changes) {
    const target = items.find((item) => item.id === itemId)
    if (!target) {
      return null
    }
    const changedFields = getChangedFields(target, changes)
    if (Object.keys(changedFields).length === 0) {
      return target
    }

    if (!isSyncedProject) {
      updateLocalProjectItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId ? { ...item, ...changedFields } : item,
        ),
      )
      return { ...target, ...changedFields }
    }

    const targetBackendProjectId = backendProjectId
    const key = `${targetBackendProjectId}:item:${target.id}`
    const controller = beginMutation(key)
    if (!controller) {
      return null
    }

    try {
      const updated = await updateChecklistItem(
        target.id,
        changedFields,
        controller.signal,
      )
      if (
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        const mapped = { ...updated, projectId }
        setServerItems((current) =>
          sortServerItems(
            current.map((item) => (item.id === itemId ? mapped : item)),
          ),
        )
        return mapped
      }
    } catch (updateError) {
      if (
        updateError.name !== 'AbortError' &&
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        setError(updateError.message)
      }
    } finally {
      endMutation(key, controller)
    }

    return null
  }

  function toggleItem(itemId) {
    const target = items.find((item) => item.id === itemId)
    return target ? updateItem(itemId, { done: !target.done }) : null
  }

  function isItemPending(itemId) {
    if (!isSyncedProject) {
      return false
    }

    const item = items.find((candidate) => candidate.id === itemId)
    return item
      ? pendingKeys.has(
          `${backendProjectId}:item:${item.id}`,
        )
      : false
  }

  async function deleteItem(itemId) {
    const target = items.find((item) => item.id === itemId)
    if (!target) {
      return false
    }

    if (!isSyncedProject) {
      updateLocalProjectItems((currentItems) =>
        currentItems.filter((item) => item.id !== itemId),
      )
      return true
    }

    const targetBackendProjectId = backendProjectId
    const key = `${targetBackendProjectId}:item:${target.id}`
    const controller = beginMutation(key)
    if (!controller) {
      return false
    }

    try {
      await deleteChecklistItem(
        target.id,
        controller.signal,
      )
      if (
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        setServerItems((current) =>
          current.filter((item) => item.id !== itemId),
        )
      }
      return true
    } catch (deleteError) {
      if (
        deleteError.name !== 'AbortError' &&
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        setError(deleteError.message)
      }
      return false
    } finally {
      endMutation(key, controller)
    }
  }

  async function importDefaultChecklist(targetProjectId = projectId) {
    if (!targetProjectId || items.length > 0) {
      return false
    }

    if (!isSyncedProject) {
      updateLocalProjectItems(
        () => cloneChecklistItems(defaultChecklistTemplate),
        targetProjectId,
      )
      return true
    }

    if (exclusiveController.current || pendingKeysRef.current.size > 0) {
      return false
    }

    const targetBackendProjectId = backendProjectId
    const controller = new AbortController()
    exclusiveController.current = controller
    setIsImportingDefault(true)
    setError(null)

    try {
      const createdItems = await createDefaultChecklist(
        targetBackendProjectId,
        controller.signal,
      )
      if (
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        setServerItems(
          createdItems.map((item) => ({ ...item, projectId })),
        )
      }
      return true
    } catch (createError) {
      if (
        createError.name !== 'AbortError' &&
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        await loadServerItems()
        if (
          isMounted.current &&
          currentBackendProjectId.current === targetBackendProjectId
        ) {
          setError(createError.message || '기본 체크리스트를 불러오지 못했습니다.')
        }
      }
      return false
    } finally {
      if (exclusiveController.current === controller) {
        exclusiveController.current = null
      }
      if (
        isMounted.current &&
        currentBackendProjectId.current === targetBackendProjectId
      ) {
        setIsImportingDefault(false)
      }
    }
  }

  return {
    items,
    completedCount,
    progress,
    isLoading,
    isSaving,
    isImportingDefault,
    error,
    storageMode: isSyncedProject ? 'server' : 'local',
    isSyncedProject,
    addItem,
    updateItem,
    toggleItem,
    isItemPending,
    deleteItem,
    importDefaultChecklist,
    refetch: loadServerItems,
  }
}

export default useChecklist
