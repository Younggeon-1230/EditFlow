import { useEffect, useMemo, useRef, useState } from 'react'
import { STORAGE_KEYS } from '../constants/app'
import { ApiError } from '../services/apiClient.js'
import initialProjects from '../data/initialProjects'
import {
  createProject,
  deleteProject as deleteProjectRequest,
  getProject,
  getProjects,
  mergeBackendProject,
  updateProject as updateProjectRequest,
} from '../services/projectsApi.js'
import { migrateLocalProjectsToBackend } from '../utils/projectMigration.js'
import { removeStoredProjectMemos } from '../utils/projectMemosStorage.js'
import {
  createLocalProject,
  createRecoveredLocalProject,
  isBackendProjectId,
} from '../utils/serverProjectRecovery.js'

function normalizeLocalProject(project) {
  const hasBackendProject = isBackendProjectId(project.backendProjectId)
  return {
    ...project,
    backendProjectId: hasBackendProject ? project.backendProjectId : null,
    syncStatus:
      project.syncStatus ?? (hasBackendProject ? 'synced' : 'local_only'),
    lastSyncError: project.lastSyncError ?? null,
  }
}

function loadProjects() {
  try {
    const storedProjects = localStorage.getItem(STORAGE_KEYS.projects)
    const source = storedProjects ? JSON.parse(storedProjects) : initialProjects
    return Array.isArray(source)
      ? source.map(normalizeLocalProject)
      : initialProjects.map(normalizeLocalProject)
  } catch {
    return initialProjects.map(normalizeLocalProject)
  }
}

function removeProjectFromKeyedStorage(storageKey, projectId) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return
    }
    const next = { ...value }
    delete next[projectId]
    localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {
    // Project deletion remains usable when related browser storage is invalid.
  }
}

function cleanupLocalProjectData(projectId) {
  removeProjectFromKeyedStorage(STORAGE_KEYS.checklists, projectId)
  removeStoredProjectMemos(projectId)
}

function useProjects() {
  const [projects, setProjects] = useState(loadProjects)
  const [searchTerm, setSearchTerm] = useState('')
  const [syncError, setSyncError] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [restoringProjectIds, setRestoringProjectIds] = useState(() => new Set())
  const [restoreErrors, setRestoreErrors] = useState({})
  const projectsRef = useRef(projects)
  const activeControllers = useRef(new Set())
  const createInProgress = useRef(false)
  const migrationInProgress = useRef(false)
  const restoreLocks = useRef(new Set())
  const isMounted = useRef(true)

  useEffect(() => {
    projectsRef.current = projects
    try {
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects))
    } catch {
      // Keep the in-memory project list usable when browser storage is blocked.
    }
  }, [projects])

  useEffect(() => {
    const controller = new AbortController()
    activeControllers.current.add(controller)

    async function refreshLinkedProjects() {
      try {
        const backendProjects = await getProjects(controller.signal)
        const backendById = new Map(
          backendProjects.map((project) => [
            project.backendProjectId,
            project,
          ]),
        )

        setProjects((currentProjects) =>
          currentProjects.map((localProject) => {
            if (!isBackendProjectId(localProject.backendProjectId)) {
              return localProject
            }

            const backendProject = backendById.get(
              localProject.backendProjectId,
            )
            return backendProject
              ? mergeBackendProject(localProject, backendProject)
              : {
                  ...localProject,
                  syncStatus: 'sync_failed',
                  lastSyncError: '서버에서 프로젝트를 찾을 수 없습니다.',
                }
          }),
        )
      } catch (error) {
        if (error.name !== 'AbortError') {
          // localStorage remains the display source when the server is offline.
        }
      } finally {
        activeControllers.current.delete(controller)
      }
    }

    refreshLinkedProjects()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      activeControllers.current.forEach((controller) => controller.abort())
      activeControllers.current.clear()
      restoreLocks.current.clear()
    }
  }, [])

  const filteredProjects = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase('ko-KR')

    if (!normalizedSearchTerm) {
      return projects
    }

    return projects.filter((project) =>
      project.title.toLocaleLowerCase('ko-KR').includes(normalizedSearchTerm),
    )
  }, [projects, searchTerm])

  async function addProject(projectValues) {
    if (createInProgress.current) {
      return null
    }

    createInProgress.current = true
    const localProject = createLocalProject(projectValues)
    const controller = new AbortController()
    activeControllers.current.add(controller)
    setIsCreating(true)
    setSyncError(null)
    setProjects((currentProjects) => [localProject, ...currentProjects])

    try {
      const backendProject = await createProject(
        projectValues,
        controller.signal,
      )
      const syncedProject = mergeBackendProject(
        localProject,
        backendProject,
      )
      if (!isMounted.current) {
        return syncedProject
      }
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === localProject.id ? syncedProject : project,
        ),
      )
      return syncedProject
    } catch (error) {
      if (!isMounted.current) {
        return localProject
      }
      const message =
        error.message === '백엔드 서버에 연결할 수 없습니다.'
          ? '백엔드 서버에 연결할 수 없어 로컬에만 저장했습니다.'
          : error.message || '프로젝트를 서버에 저장하지 못했습니다.'
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === localProject.id
            ? {
                ...project,
                syncStatus: 'sync_failed',
                lastSyncError: message,
              }
            : project,
        ),
      )
      setSyncError(message)
      return localProject
    } finally {
      activeControllers.current.delete(controller)
      createInProgress.current = false
      if (isMounted.current) {
        setIsCreating(false)
      }
    }
  }

  async function updateProject(projectId, projectValues) {
    const existingProject = projects.find((project) => project.id === projectId)
    if (!existingProject) {
      return null
    }

    const localUpdate = {
      ...existingProject,
      ...projectValues,
      syncStatus: isBackendProjectId(existingProject.backendProjectId)
        ? 'syncing'
        : 'local_only',
      lastSyncError: null,
    }
    setSyncError(null)

    if (!isBackendProjectId(existingProject.backendProjectId)) {
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectId ? localUpdate : project,
        ),
      )
      return localUpdate
    }

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === projectId
          ? { ...project, syncStatus: 'syncing', lastSyncError: null }
          : project,
      ),
    )
    const controller = new AbortController()
    activeControllers.current.add(controller)
    try {
      const backendProject = await updateProjectRequest(
        existingProject.backendProjectId,
        projectValues,
        controller.signal,
      )
      const syncedProject = mergeBackendProject(
        localUpdate,
        backendProject,
      )
      if (!isMounted.current) {
        return syncedProject
      }
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectId ? syncedProject : project,
        ),
      )
      return syncedProject
    } catch (error) {
      if (!isMounted.current) {
        return null
      }
      const message =
        error.message || '프로젝트를 서버에서 수정하지 못했습니다.'
      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === projectId
            ? {
                ...existingProject,
                syncStatus: 'sync_failed',
                lastSyncError: message,
              }
            : project,
        ),
      )
      setSyncError(message)
      return null
    } finally {
      activeControllers.current.delete(controller)
    }
  }

  async function deleteProject(projectId) {
    const existingProject = projects.find((project) => project.id === projectId)
    if (!existingProject) {
      return false
    }

    setSyncError(null)
    if (!isBackendProjectId(existingProject.backendProjectId)) {
      cleanupLocalProjectData(projectId)
      setProjects((currentProjects) =>
        currentProjects.filter((project) => project.id !== projectId),
      )
      return true
    }

    const controller = new AbortController()
    activeControllers.current.add(controller)
    try {
      await deleteProjectRequest(
        existingProject.backendProjectId,
        controller.signal,
      )
      if (!isMounted.current) {
        cleanupLocalProjectData(projectId)
        return true
      }
      cleanupLocalProjectData(projectId)
      setProjects((currentProjects) =>
        currentProjects.filter((project) => project.id !== projectId),
      )
      return true
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        cleanupLocalProjectData(projectId)
        if (isMounted.current) {
          setProjects((currentProjects) =>
            currentProjects.filter((project) => project.id !== projectId),
          )
        }
        return true
      }
      if (!isMounted.current) {
        return false
      }
      setSyncError(
        error.message || '프로젝트를 서버에서 삭제하지 못했습니다.',
      )
      return false
    } finally {
      activeControllers.current.delete(controller)
    }
  }

  async function migrateProjects() {
    if (migrationInProgress.current) {
      return null
    }

    migrationInProgress.current = true
    setIsMigrating(true)
    setSyncError(null)
    try {
      const result = await migrateLocalProjectsToBackend({ projects })
      if (!isMounted.current) {
        return result
      }
      setProjects(result.projects)
      if (result.failed > 0) {
        setSyncError('일부 프로젝트를 동기화하지 못했습니다.')
      }
      return result
    } finally {
      migrationInProgress.current = false
      if (isMounted.current) {
        setIsMigrating(false)
      }
    }
  }

  function registerBackendProject(serverProject) {
    if (!isBackendProjectId(serverProject?.backendProjectId)) {
      throw new Error('서버 프로젝트 ID를 확인할 수 없습니다.')
    }

    const existingProject = projectsRef.current.find(
      (project) => project.backendProjectId === serverProject.backendProjectId,
    )
    if (existingProject) {
      return existingProject
    }

    const syncedProject = createRecoveredLocalProject(serverProject)
    const nextProjects = [syncedProject, ...projectsRef.current]

    try {
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(nextProjects))
    } catch {
      throw new Error(
        '프로젝트는 생성됐지만 화면 목록에 연결하지 못했습니다. 프로젝트 목록을 새로고침해 주세요.',
      )
    }

    projectsRef.current = nextProjects
    setProjects(nextProjects)
    return syncedProject
  }

  async function restoreServerProject(backendProjectId) {
    if (!isBackendProjectId(backendProjectId)) return null
    const existingProject = projectsRef.current.find(
      (project) => project.backendProjectId === backendProjectId,
    )
    if (existingProject) return existingProject
    if (restoreLocks.current.has(backendProjectId)) return null

    restoreLocks.current.add(backendProjectId)
    setRestoringProjectIds((current) => new Set(current).add(backendProjectId))
    setRestoreErrors((current) => {
      const next = { ...current }
      delete next[backendProjectId]
      return next
    })
    const controller = new AbortController()
    activeControllers.current.add(controller)
    try {
      const serverProject = await getProject(backendProjectId, controller.signal)
      if (!isMounted.current) return null
      const mappedDuringRequest = projectsRef.current.find(
        (project) => project.backendProjectId === backendProjectId,
      )
      return mappedDuringRequest ?? registerBackendProject(serverProject)
    } catch (error) {
      if (error.name !== 'AbortError' && isMounted.current) {
        setRestoreErrors((current) => ({
          ...current,
          [backendProjectId]: error.message || '서버 프로젝트를 가져오지 못했습니다.',
        }))
      }
      return null
    } finally {
      activeControllers.current.delete(controller)
      restoreLocks.current.delete(backendProjectId)
      if (isMounted.current) {
        setRestoringProjectIds((current) => {
          const next = new Set(current)
          next.delete(backendProjectId)
          return next
        })
      }
    }
  }

  return {
    projects,
    filteredProjects,
    searchTerm,
    setSearchTerm,
    syncError,
    clearSyncError: () => setSyncError(null),
    isCreating,
    isMigrating,
    restoringProjectIds,
    restoreErrors,
    addProject,
    updateProject,
    deleteProject,
    registerBackendProject,
    restoreServerProject,
    clearRestoreError: (backendProjectId) => setRestoreErrors((current) => {
      const next = { ...current }
      delete next[backendProjectId]
      return next
    }),
    migrateProjects,
  }
}

export default useProjects
