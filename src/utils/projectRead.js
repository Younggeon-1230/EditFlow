export function parseServerProjectId(value) {
  if (!/^[1-9]\d*$/.test(String(value ?? ''))) return null
  const projectId = Number(value)
  return Number.isSafeInteger(projectId) ? projectId : null
}

export function readStoredProjects(storage, storageKey) {
  if (!storageKey) return []
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeStoredProjects(storage, storageKey, projects) {
  if (!storageKey) return false
  try {
    storage.setItem(storageKey, JSON.stringify(projects))
    return true
  } catch {
    return false
  }
}

export function updateStoredProject(storage, storageKey, projectId, changes) {
  const projects = readStoredProjects(storage, storageKey)
  let updated = null
  const nextProjects = projects.map((project) => {
    if (project?.id !== projectId) return project
    const { projectKind: _projectKind, legacyState: _legacyState, ...clean } = project
    updated = { ...clean, ...changes, updatedAt: new Date().toISOString() }
    return updated
  })
  return updated && writeStoredProjects(storage, storageKey, nextProjects)
    ? updated
    : null
}

export function removeStoredProject(storage, storageKey, projectId) {
  const projects = readStoredProjects(storage, storageKey)
  const nextProjects = projects.filter((project) => project?.id !== projectId)
  return nextProjects.length !== projects.length &&
    writeStoredProjects(storage, storageKey, nextProjects)
}

export function classifyLegacyProjects(
  storedProjects,
  serverProjects = [],
  hasServerResult = false,
) {
  const serverIds = new Set(serverProjects.map((project) => project.id))
  return storedProjects.flatMap((project) => {
    const migratedProjectId = parseServerProjectId(project?.migratedToProjectId)
    if (migratedProjectId) {
      if (!hasServerResult || serverIds.has(migratedProjectId)) return []
      return [{
        ...project,
        projectKind: 'local',
        legacyState: 'stale-migration',
        isMigratedSource: true,
      }]
    }
    const backendProjectId = parseServerProjectId(project?.backendProjectId)
    if (!backendProjectId || project?.syncStatus === 'local_only') {
      return [{ ...project, projectKind: 'local', legacyState: 'local-only' }]
    }
    if (!hasServerResult || serverIds.has(backendProjectId)) return []
    return [{ ...project, projectKind: 'local', legacyState: 'stale-mapping' }]
  })
}

export function resolveLegacyProjectRoute(localProjectId, storedProjects) {
  const project = storedProjects.find((item) => item?.id === localProjectId)
  if (!project) return null
  return `/projects/local/${encodeURIComponent(localProjectId)}`
}

export function createProjectDashboardStats(projects) {
  const activeStatuses = new Set(['planning', 'in_progress'])
  return [
    {
      id: 'projects',
      title: '진행 중 프로젝트',
      value: projects.filter((project) => activeStatuses.has(project.status)).length,
      to: '/projects',
    },
    {
      id: 'references',
      title: '저장한 레퍼런스',
      value: projects.reduce((sum, project) => sum + project.referenceCount, 0),
      to: '/reference',
    },
    {
      id: 'checklists',
      title: '완료한 체크리스트',
      value: projects.reduce((sum, project) => sum + project.checklistCompleted, 0),
      to: '/checklist',
    },
  ]
}
