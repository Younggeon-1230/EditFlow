import { useState } from 'react'
import useUserStorageKey from './useUserStorageKey.js'
import {
  createProject,
  deleteProject as deleteProjectRequest,
  mergeBackendProject,
  updateProject as updateProjectRequest,
} from '../services/projectsApi.js'
import { migrateLocalProjectsToBackend } from '../utils/projectMigration.js'
import { createLocalProject } from '../utils/serverProjectRecovery.js'
import {
  readStoredProjects,
  removeStoredProject,
  updateStoredProject,
  writeStoredProjects,
} from '../utils/projectRead.js'

function useProjectMutations({ onServerChanged, onLocalChanged } = {}) {
  const storageKey = useUserStorageKey('projects')
  const [isCreating, setIsCreating] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [error, setError] = useState(null)

  async function addProject(values) {
    const localProject = createLocalProject(values)
    const stored = readStoredProjects(localStorage, storageKey)
    writeStoredProjects(localStorage, storageKey, [localProject, ...stored])
    onLocalChanged?.()
    setIsCreating(true)
    setError(null)
    try {
      const serverProject = await createProject(values)
      updateStoredProject(
        localStorage,
        storageKey,
        localProject.id,
        mergeBackendProject(localProject, serverProject),
      )
      await onServerChanged?.()
      onLocalChanged?.()
      return serverProject
    } catch (mutationError) {
      const message = mutationError.message || '프로젝트를 서버에 저장하지 못했습니다.'
      updateStoredProject(localStorage, storageKey, localProject.id, {
        syncStatus: 'sync_failed',
        lastSyncError: message,
      })
      onLocalChanged?.()
      setError(`${message} 로컬 프로젝트는 보존했습니다.`)
      return localProject
    } finally {
      setIsCreating(false)
    }
  }

  async function updateProject(project, values, projectKind) {
    setError(null)
    try {
      if (projectKind === 'local') {
        const updated = updateStoredProject(localStorage, storageKey, project.id, values)
        onLocalChanged?.()
        return updated
      }
      const updated = await updateProjectRequest(project.id, values)
      await onServerChanged?.()
      return updated
    } catch (mutationError) {
      setError(mutationError.message || '프로젝트를 수정하지 못했습니다.')
      return null
    }
  }

  async function deleteProject(project, projectKind) {
    setError(null)
    try {
      if (projectKind === 'local') {
        const removed = removeStoredProject(localStorage, storageKey, project.id)
        onLocalChanged?.()
        return removed
      }
      await deleteProjectRequest(project.id)
      await onServerChanged?.()
      return true
    } catch (mutationError) {
      setError(mutationError.message || '프로젝트를 삭제하지 못했습니다.')
      return false
    }
  }

  async function migrateProjects() {
    setIsMigrating(true)
    setError(null)
    try {
      const result = await migrateLocalProjectsToBackend({ storageKey })
      await onServerChanged?.()
      onLocalChanged?.()
      return result
    } catch (migrationError) {
      setError(migrationError.message || '로컬 프로젝트 동기화에 실패했습니다.')
      return null
    } finally {
      setIsMigrating(false)
    }
  }

  return { addProject, updateProject, deleteProject, migrateProjects, isCreating, isMigrating, error }
}

export default useProjectMutations
