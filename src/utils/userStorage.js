import { STORAGE_KEYS } from '../constants/app.js'

export const USER_STORAGE_RESOURCES = Object.freeze({
  projects: 'projects',
  checklists: 'checklist',
  savedReferences: 'saved-references',
  savedBrolls: 'saved-brolls',
  projectMemos: 'project-memos',
})

export const LEGACY_IMPORT_STATUS_RESOURCE = 'legacy-import-status'

const RESOURCE_CONFIG = Object.freeze({
  projects: { legacyKey: STORAGE_KEYS.projects, empty: [] },
  checklists: { legacyKey: STORAGE_KEYS.checklists, empty: {} },
  savedReferences: { legacyKey: STORAGE_KEYS.savedReferences, empty: [] },
  savedBrolls: { legacyKey: STORAGE_KEYS.savedBrolls, empty: [] },
  projectMemos: { legacyKey: STORAGE_KEYS.projectMemos, empty: {} },
})

function assertUserId(userId) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('A valid authenticated user ID is required.')
  }
}

export function getUserStorageKey(userId, resource) {
  assertUserId(userId)
  if (!Object.values(USER_STORAGE_RESOURCES).includes(resource) &&
      resource !== LEGACY_IMPORT_STATUS_RESOURCE) {
    throw new Error(`Unknown user storage resource: ${resource}`)
  }
  return `editflow:v2:user:${userId}:${resource}`
}

export function getLegacyImportStatusKey(userId) {
  return getUserStorageKey(userId, LEGACY_IMPORT_STATUS_RESOURCE)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isMeaningful(value) {
  return Array.isArray(value)
    ? value.length > 0
    : isRecord(value) && Object.keys(value).length > 0
}

function readJson(storage, key, fallback) {
  const raw = storage.getItem(key)
  if (raw === null) return { value: fallback, exists: false, corrupt: false }
  try {
    return { value: JSON.parse(raw), exists: true, corrupt: false }
  } catch {
    return { value: fallback, exists: true, corrupt: true }
  }
}

function hasExpectedShape(resource, value) {
  return resource === 'projects' || resource === 'savedReferences' || resource === 'savedBrolls'
    ? Array.isArray(value)
    : isRecord(value)
}

export function getLegacyStorageSummary(storage = localStorage) {
  const resources = {}
  let hasLegacyData = false
  let hasCorruptData = false

  for (const [resource, config] of Object.entries(RESOURCE_CONFIG)) {
    const result = readJson(storage, config.legacyKey, config.empty)
    const invalidShape = result.exists && !result.corrupt && !hasExpectedShape(resource, result.value)
    const corrupt = result.corrupt || invalidShape
    const meaningful = !corrupt && isMeaningful(result.value)
    resources[resource] = { meaningful, corrupt, legacyKey: config.legacyKey }
    hasLegacyData ||= meaningful
    hasCorruptData ||= corrupt
  }

  return { hasLegacyData, hasCorruptData, resources }
}

export function hasCompletedLegacyImport(storage, userId) {
  const result = readJson(storage, getLegacyImportStatusKey(userId), null)
  return !result.corrupt && result.value?.status === 'imported'
}

function stripBackendMappings(value) {
  if (Array.isArray(value)) return value.map(stripBackendMappings)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/^(backend|server).+Id$/i.test(key))
      .map(([key, child]) => [key, stripBackendMappings(child)]),
  )
}

function normalizeLegacyValue(resource, value) {
  const stripped = stripBackendMappings(value)
  if (resource !== 'projects') return stripped
  return stripped.map((project) => ({
    ...project,
    backendProjectId: null,
    syncStatus: 'local_only',
    lastSyncError: null,
  }))
}

function mergeArray(existing, legacy) {
  const merged = [...existing]
  const seenIds = new Set(
    existing.map((item) => item?.id).filter((id) => id !== undefined),
  )
  for (const item of legacy) {
    if (item?.id !== undefined && seenIds.has(item.id)) continue
    merged.push(item)
    if (item?.id !== undefined) seenIds.add(item.id)
  }
  return merged
}

function mergeKeyedArrays(existing, legacy) {
  const merged = { ...legacy, ...existing }
  for (const key of Object.keys(legacy)) {
    if (Array.isArray(existing[key]) && Array.isArray(legacy[key])) {
      merged[key] = mergeArray(existing[key], legacy[key])
    }
  }
  return merged
}

function mergeResource(resource, existing, legacy) {
  if (Array.isArray(existing) && Array.isArray(legacy)) {
    return mergeArray(existing, legacy)
  }
  if (resource === 'checklists' || resource === 'projectMemos') {
    return mergeKeyedArrays(existing, legacy)
  }
  return { ...legacy, ...existing }
}

export function importLegacyStorageForUser(storage, userId, now = () => new Date().toISOString()) {
  assertUserId(userId)
  if (hasCompletedLegacyImport(storage, userId)) {
    return { status: 'already-imported', importedResources: [] }
  }

  const prepared = []
  const importedResources = []
  for (const [resource, config] of Object.entries(RESOURCE_CONFIG)) {
    const legacy = readJson(storage, config.legacyKey, config.empty)
    if (legacy.corrupt || (legacy.exists && !hasExpectedShape(resource, legacy.value))) {
      throw new Error(`기존 ${resource} 데이터를 읽을 수 없습니다. 원본은 변경되지 않았습니다.`)
    }

    const targetKey = getUserStorageKey(userId, USER_STORAGE_RESOURCES[resource])
    const scoped = readJson(storage, targetKey, config.empty)
    if (scoped.corrupt || (scoped.exists && !hasExpectedShape(resource, scoped.value))) {
      throw new Error(`현재 계정의 ${resource} 데이터를 읽을 수 없습니다. 가져오기를 중단했습니다.`)
    }

    const normalizedLegacy = normalizeLegacyValue(resource, legacy.value)
    const merged = mergeResource(resource, scoped.value, normalizedLegacy)
    prepared.push({ key: targetKey, value: JSON.stringify(merged) })
    if (isMeaningful(legacy.value)) importedResources.push(resource)
  }

  const markerKey = getLegacyImportStatusKey(userId)
  prepared.push({
    key: markerKey,
    value: JSON.stringify({ status: 'imported', importedAt: now() }),
  })

  const snapshots = new Map(prepared.map(({ key }) => [key, storage.getItem(key)]))
  try {
    prepared.forEach(({ key, value }) => storage.setItem(key, value))
  } catch (error) {
    for (const [key, previous] of snapshots) {
      try {
        if (previous === null) storage.removeItem(key)
        else storage.setItem(key, previous)
      } catch {
        // Best-effort rollback; legacy source keys are never modified.
      }
    }
    throw new Error('브라우저 저장소에 기록하지 못했습니다. 기존 데이터는 그대로 유지됩니다.', { cause: error })
  }

  return { status: 'imported', importedResources }
}
