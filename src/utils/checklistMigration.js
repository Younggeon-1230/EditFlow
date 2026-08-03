import { STORAGE_KEYS } from '../constants/app.js'
import {
  createChecklistItem,
  getChecklistItems,
} from '../services/checklistItemsApi.js'

const BLOCKED_MESSAGE =
  '서버에 이미 체크리스트가 있어 자동 동기화할 수 없습니다.'
const PARTIAL_FAILURE_MESSAGE =
  '일부 체크리스트 항목을 동기화하지 못했습니다.'

function isBackendProjectId(value) {
  return Number.isInteger(value) && value > 0
}

export function getLocalChecklistItems(localProjectId) {
  if (!localProjectId) {
    return []
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.checklists) ?? '{}',
    )
    return stored &&
      typeof stored === 'object' &&
      !Array.isArray(stored) &&
      Array.isArray(stored[localProjectId])
      ? stored[localProjectId].map((item) => ({ ...item }))
      : []
  } catch {
    return []
  }
}

export async function getChecklistMigrationStatus({
  localProjectId,
  backendProjectId,
  localItems: providedLocalItems,
  signal,
}) {
  if (!isBackendProjectId(backendProjectId)) {
    throw new Error('이 프로젝트는 아직 서버와 동기화되지 않았습니다.')
  }

  const localItems = Array.isArray(providedLocalItems)
    ? providedLocalItems.map((item) => ({ ...item }))
    : getLocalChecklistItems(localProjectId)
  const serverItems = await getChecklistItems(backendProjectId, signal)

  return {
    localItemCount: localItems.length,
    serverItemCount: serverItems.length,
    blocked: serverItems.length > 0,
    canMigrate: localItems.length > 0 && serverItems.length === 0,
    message: serverItems.length > 0 ? BLOCKED_MESSAGE : null,
  }
}

export async function migrateProjectChecklistToBackend({
  localProjectId,
  backendProjectId,
  localItems: providedLocalItems,
  signal,
}) {
  if (!isBackendProjectId(backendProjectId)) {
    throw new Error('이 프로젝트는 아직 서버와 동기화되지 않았습니다.')
  }

  const localItems = Array.isArray(providedLocalItems)
    ? providedLocalItems.map((item) => ({ ...item }))
    : getLocalChecklistItems(localProjectId)
  const serverItems = await getChecklistItems(backendProjectId, signal)
  const result = {
    total: localItems.length,
    migrated: 0,
    failed: 0,
    blocked: false,
    failures: [],
    mappings: [],
    message: null,
  }

  if (serverItems.length > 0) {
    return {
      ...result,
      blocked: true,
      message: BLOCKED_MESSAGE,
    }
  }

  for (const [index, localItem] of localItems.entries()) {
    try {
      const created = await createChecklistItem(
        backendProjectId,
        {
          title: localItem.title ?? localItem.text,
          description: localItem.description ?? null,
          isCompleted: localItem.isCompleted ?? localItem.done ?? false,
          position:
            Number.isInteger(localItem.position) && localItem.position >= 0
              ? localItem.position
              : index,
        },
        signal,
        { includePosition: true },
      )
      result.migrated += 1
      result.mappings.push({
        localItemId: localItem.id,
        backendChecklistItemId: created.backendChecklistItemId,
      })
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error
      }
      result.failed += 1
      result.failures.push({
        localItemId: localItem.id,
        message: error.message || '체크리스트 처리 중 오류가 발생했습니다.',
      })
    }
  }

  if (result.failed > 0) {
    result.message = PARTIAL_FAILURE_MESSAGE
  }

  return result
}

export const checklistMigrationMessages = {
  blocked: BLOCKED_MESSAGE,
  partialFailure: PARTIAL_FAILURE_MESSAGE,
}
