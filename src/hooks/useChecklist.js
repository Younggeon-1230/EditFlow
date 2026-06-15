import { useEffect, useMemo, useState } from 'react'
import initialChecklist from '../data/initialChecklist'

const STORAGE_KEY = 'editflow_checklists'

function loadChecklists() {
  try {
    const storedChecklists = localStorage.getItem(STORAGE_KEY)

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

function createChecklistItemId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `task-${Date.now()}`
}

function useChecklist(projectId) {
  const [checklists, setChecklists] = useState(loadChecklists)
  const items = useMemo(
    () => (Array.isArray(checklists[projectId]) ? checklists[projectId] : []),
    [checklists, projectId],
  )
  const completedCount = useMemo(
    () => items.filter((item) => item.done).length,
    [items],
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists))
    } catch {
      // Keep checklist editing available in memory when storage is blocked.
    }
  }, [checklists])

  function updateProjectItems(updateItems) {
    if (!projectId) {
      return
    }

    setChecklists((currentChecklists) => {
      const currentItems = Array.isArray(currentChecklists[projectId])
        ? currentChecklists[projectId]
        : []

      return {
        ...currentChecklists,
        [projectId]: updateItems(currentItems),
      }
    })
  }

  function toggleItem(itemId) {
    updateProjectItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item,
      ),
    )
  }

  function addItem(text) {
    const normalizedText = text.trim()

    if (!normalizedText) {
      return
    }

    updateProjectItems((currentItems) => [
      ...currentItems,
      {
        id: createChecklistItemId(),
        text: normalizedText,
        done: false,
      },
    ])
  }

  function deleteItem(itemId) {
    updateProjectItems((currentItems) =>
      currentItems.filter((item) => item.id !== itemId),
    )
  }

  return {
    items,
    completedCount,
    addItem,
    toggleItem,
    deleteItem,
  }
}

export default useChecklist
