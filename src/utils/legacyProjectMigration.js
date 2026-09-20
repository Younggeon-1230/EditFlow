import { createProjectPayload } from '../services/projectsApi.js'
import {
  readStoredProjects,
  writeStoredProjects,
} from './projectRead.js'

function readRecord(storage, key) {
  if (!key) return {}
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

function readArray(storage, key) {
  if (!key) return []
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function readLegacyProjectChildren(
  storage,
  localProjectId,
  { checklistKey, memoKey },
) {
  const checklists = readRecord(storage, checklistKey)
  const memos = readRecord(storage, memoKey)
  return {
    checklistItems: Array.isArray(checklists[localProjectId])
      ? checklists[localProjectId]
      : [],
    memos: Array.isArray(memos[localProjectId])
      ? memos[localProjectId]
      : [],
  }
}

export function countUnassignedLegacyMedia(
  storage,
  { referenceKey, brollKey },
) {
  return {
    references: readArray(storage, referenceKey).length,
    brolls: readArray(storage, brollKey).length,
  }
}

export function createLegacyProjectImportPayload(
  project,
  { checklistItems = [], memos = [] } = {},
) {
  const sourceLocalId = String(project?.id ?? '').trim()
  if (!sourceLocalId) {
    throw new Error('A local project ID is required.')
  }

  return {
    source_local_id: sourceLocalId,
    ...createProjectPayload(project),
    checklist_items: checklistItems.map((item, index) => ({
      title: String(item.title ?? item.text ?? '').trim(),
      description: String(item.description ?? '').trim() || null,
      is_completed: Boolean(item.isCompleted ?? item.done ?? false),
      position:
        Number.isInteger(item.position) && item.position >= 0
          ? item.position
          : index,
    })),
    memos: memos.flatMap((memo, index) => {
      const content = String(memo?.content ?? memo ?? '').trim()
      if (!content) return []
      return [{
        content,
        position:
          Number.isInteger(memo?.position) && memo.position >= 0
            ? memo.position
            : index,
      }]
    }),
  }
}

export function markLegacyProjectMigrated(
  storage,
  storageKey,
  localProjectId,
  serverProjectId,
  migratedAt = new Date().toISOString(),
) {
  const projects = readStoredProjects(storage, storageKey)
  let found = false
  const nextProjects = projects.map((project) => {
    if (project?.id !== localProjectId) return project
    found = true
    const {
      backendProjectId: _backendProjectId,
      lastSyncError: _lastSyncError,
      syncStatus: _syncStatus,
      ...localSource
    } = project
    return {
      ...localSource,
      migratedToProjectId: serverProjectId,
      migratedAt,
    }
  })
  return found && writeStoredProjects(storage, storageKey, nextProjects)
}
