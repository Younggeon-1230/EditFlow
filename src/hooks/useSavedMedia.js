import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../services/apiClient'

const UNSYNCED_PROJECT_MESSAGE =
  '이 프로젝트는 아직 서버와 동기화되지 않았습니다.'

function isResourceId(value) {
  return Number.isInteger(value) && value > 0
}

function useSavedMedia({
  resourceId,
  listItems,
  createItem,
  updateNote,
  deleteItem,
  enabled = true,
  duplicateMessage = null,
}) {
  const [items, setItems] = useState([])
  const [itemsResourceId, setItemsResourceId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [savingExternalIds, setSavingExternalIds] = useState(() => new Set())
  const [updatingIds, setUpdatingIds] = useState(() => new Set())
  const [deletingIds, setDeletingIds] = useState(() => new Set())
  const [error, setError] = useState(null)
  const listController = useRef(null)
  const listSequence = useRef(0)
  const mutationControllers = useRef(new Set())
  const savingExternalIdsRef = useRef(new Set())
  const updatingIdsRef = useRef(new Set())
  const deletingIdsRef = useRef(new Set())
  const currentResourceId = useRef(resourceId)
  const itemsResourceIdRef = useRef(itemsResourceId)

  currentResourceId.current = resourceId
  itemsResourceIdRef.current = itemsResourceId

  const loadItems = useCallback(async () => {
    if (!enabled) {
      listController.current?.abort()
      listSequence.current += 1
      setIsLoading(false)
      return
    }
    if (!isResourceId(resourceId)) {
      listController.current?.abort()
      listSequence.current += 1
      setItems([])
      setItemsResourceId(null)
      itemsResourceIdRef.current = null
      setIsLoading(false)
      setError(null)
      return
    }

    listController.current?.abort()
    const controller = new AbortController()
    const sequence = listSequence.current + 1
    listSequence.current = sequence
    listController.current = controller
    if (itemsResourceIdRef.current !== resourceId) {
      setItems([])
    }
    setItemsResourceId(resourceId)
    itemsResourceIdRef.current = resourceId
    setIsLoading(true)
    setError(null)

    try {
      const nextItems = await listItems(resourceId, controller.signal)
      if (listSequence.current === sequence) {
        setItems(nextItems)
      }
    } catch (loadError) {
      if (
        loadError.name !== 'AbortError' &&
        listSequence.current === sequence
      ) {
        setError(loadError.message)
      }
    } finally {
      if (listSequence.current === sequence) {
        setIsLoading(false)
        listController.current = null
      }
    }
  }, [resourceId, enabled, listItems])

  useEffect(() => {
    loadItems()

    return () => {
      listSequence.current += 1
      listController.current?.abort()
    }
  }, [loadItems])

  useEffect(
    () => () => {
      mutationControllers.current.forEach((controller) => controller.abort())
      mutationControllers.current.clear()
    },
    [resourceId, enabled],
  )

  const savedExternalIds = useMemo(
    () =>
      new Set(
        (itemsResourceId === resourceId ? items : []).map(
          (item) => item.externalId,
        ),
      ),
    [items, itemsResourceId, resourceId],
  )
  const visibleItems = itemsResourceId === resourceId ? items : []
  const isWaitingForResource =
    isResourceId(resourceId) &&
    itemsResourceId !== resourceId

  async function save(searchItem) {
    if (!isResourceId(resourceId)) {
      setError(UNSYNCED_PROJECT_MESSAGE)
      return null
    }

    const externalId = searchItem.externalId ?? searchItem.id
    if (
      !externalId ||
      savedExternalIds.has(externalId) ||
      savingExternalIdsRef.current.has(externalId)
    ) {
      return null
    }

    const controller = new AbortController()
    const targetResourceId = resourceId
    mutationControllers.current.add(controller)
    savingExternalIdsRef.current.add(externalId)
    setSavingExternalIds((current) => new Set(current).add(externalId))
    setError(null)

    try {
      const savedItem = await createItem(
        targetResourceId,
        searchItem,
        controller.signal,
      )
      if (currentResourceId.current === targetResourceId) {
        setItems((current) => [
          savedItem,
          ...current.filter((item) => item.id !== savedItem.id),
        ])
      }
      return savedItem
    } catch (saveError) {
      if (saveError.name === 'AbortError') {
        return null
      }
      if (saveError instanceof ApiError && saveError.status === 409) {
        if (currentResourceId.current === targetResourceId) {
          await loadItems()
          if (duplicateMessage) setError(duplicateMessage)
        }
        return null
      }
      if (currentResourceId.current === targetResourceId) {
        setError(saveError.message)
      }
      return null
    } finally {
      mutationControllers.current.delete(controller)
      savingExternalIdsRef.current.delete(externalId)
      setSavingExternalIds((current) => {
        const next = new Set(current)
        next.delete(externalId)
        return next
      })
    }
  }

  async function changeNote(itemId, note) {
    if (!isResourceId(resourceId)) {
      return null
    }

    if (updatingIdsRef.current.has(itemId)) {
      return null
    }

    const controller = new AbortController()
    const targetResourceId = resourceId
    mutationControllers.current.add(controller)
    updatingIdsRef.current.add(itemId)
    setUpdatingIds((current) => new Set(current).add(itemId))
    setError(null)

    try {
      const updatedItem = await updateNote(itemId, note, controller.signal)
      if (currentResourceId.current === targetResourceId) {
        setItems((current) =>
          current.map((item) => (item.id === itemId ? updatedItem : item)),
        )
      }
      return updatedItem
    } catch (updateError) {
      if (
        updateError.name !== 'AbortError' &&
        currentResourceId.current === targetResourceId
      ) {
        setError(updateError.message)
      }
      return null
    } finally {
      mutationControllers.current.delete(controller)
      updatingIdsRef.current.delete(itemId)
      setUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(itemId)
        return next
      })
    }
  }

  async function remove(itemId) {
    if (!isResourceId(resourceId)) {
      return false
    }

    if (deletingIdsRef.current.has(itemId)) {
      return false
    }

    const controller = new AbortController()
    const targetResourceId = resourceId
    mutationControllers.current.add(controller)
    deletingIdsRef.current.add(itemId)
    setDeletingIds((current) => new Set(current).add(itemId))
    setError(null)

    try {
      await deleteItem(itemId, controller.signal)
      if (currentResourceId.current === targetResourceId) {
        setItems((current) => current.filter((item) => item.id !== itemId))
      }
      return true
    } catch (deleteError) {
      if (
        deleteError.name !== 'AbortError' &&
        currentResourceId.current === targetResourceId
      ) {
        setError(deleteError.message)
      }
      return false
    } finally {
      mutationControllers.current.delete(controller)
      deletingIdsRef.current.delete(itemId)
      setDeletingIds((current) => {
        const next = new Set(current)
        next.delete(itemId)
        return next
      })
    }
  }

  return {
    items: visibleItems,
    isLoading: isLoading || isWaitingForResource,
    isSaving: savingExternalIds.size > 0,
    error,
    savedExternalIds,
    isSaved: (externalId) => savedExternalIds.has(externalId),
    isSavingItem: (externalId) => savingExternalIds.has(externalId),
    isUpdatingItem: (itemId) => updatingIds.has(itemId),
    isDeletingItem: (itemId) => deletingIds.has(itemId),
    reload: loadItems,
    save,
    changeNote,
    remove,
  }
}

export default useSavedMedia
