import { useRef, useState } from 'react'
import useUserStorageKey from './useUserStorageKey.js'
import {
  createProject,
  deleteProject as deleteProjectRequest,
  importLocalProject,
  updateProject as updateProjectRequest,
} from '../services/projectsApi.js'
import {
  countUnassignedLegacyMedia,
  createLegacyProjectImportPayload,
  markLegacyProjectMigrated,
  readLegacyProjectChildren,
} from '../utils/legacyProjectMigration.js'
import {
  removeStoredProject,
  updateStoredProject,
} from '../utils/projectRead.js'

function useProjectMutations({ onServerChanged, onLocalChanged } = {}) {
  const storageKey = useUserStorageKey('projects')
  const checklistKey = useUserStorageKey('checklists')
  const memoKey = useUserStorageKey('projectMemos')
  const referenceKey = useUserStorageKey('savedReferences')
  const brollKey = useUserStorageKey('savedBrolls')
  const [isCreating, setIsCreating] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [pendingMutation, setPendingMutation] = useState(null)
  const [error, setError] = useState(null)
  const pendingMutationRef = useRef(null)

  function beginMutation(kind, project = null, projectKind = null) {
    if (pendingMutationRef.current) return false
    const mutation = {
      kind,
      projectId: project?.id ?? null,
      projectKind,
    }
    pendingMutationRef.current = mutation
    setPendingMutation(mutation)
    setError(null)
    return true
  }

  function finishMutation() {
    pendingMutationRef.current = null
    setPendingMutation(null)
  }

  async function addProject(values) {
    if (!beginMutation('create')) return null
    setIsCreating(true)
    try {
      const serverProject = await createProject(values)
      await onServerChanged?.()
      return serverProject
    } catch (mutationError) {
      setError(mutationError.message || '프로젝트를 서버에 저장하지 못했습니다.')
      return null
    } finally {
      setIsCreating(false)
      finishMutation()
    }
  }

  async function updateProject(project, values, projectKind) {
    if (!beginMutation('update', project, projectKind)) return null
    try {
      if (projectKind === 'local') {
        const updated = updateStoredProject(
          localStorage,
          storageKey,
          project.id,
          values,
        )
        if (!updated) throw new Error('로컬 프로젝트를 수정하지 못했습니다.')
        onLocalChanged?.()
        return updated
      }
      const updated = await updateProjectRequest(project.id, values)
      await onServerChanged?.()
      return updated
    } catch (mutationError) {
      setError(mutationError.message || '프로젝트를 수정하지 못했습니다.')
      return null
    } finally {
      finishMutation()
    }
  }

  async function deleteProject(project, projectKind) {
    if (!beginMutation('delete', project, projectKind)) return false
    try {
      if (projectKind === 'local') {
        const removed = removeStoredProject(
          localStorage,
          storageKey,
          project.id,
        )
        if (!removed) throw new Error('로컬 프로젝트를 삭제하지 못했습니다.')
        onLocalChanged?.()
        return removed
      }
      await deleteProjectRequest(project.id)
      await onServerChanged?.()
      return true
    } catch (mutationError) {
      setError(mutationError.message || '프로젝트를 삭제하지 못했습니다.')
      return false
    } finally {
      finishMutation()
    }
  }

  async function migrateProject(project) {
    if (!beginMutation('migrate', project, 'local')) return null
    setIsMigrating(true)
    try {
      const children = readLegacyProjectChildren(localStorage, project.id, {
        checklistKey,
        memoKey,
      })
      const payload = createLegacyProjectImportPayload(project, children)
      const serverProject = await importLocalProject(payload)
      const markerSaved = markLegacyProjectMigrated(
        localStorage,
        storageKey,
        project.id,
        serverProject.id,
      )
      const excludedMedia = countUnassignedLegacyMedia(localStorage, {
        referenceKey,
        brollKey,
      })
      await onServerChanged?.()
      if (markerSaved) onLocalChanged?.()
      return { project: serverProject, markerSaved, excludedMedia }
    } catch (migrationError) {
      setError(
        migrationError.message ||
        '로컬 프로젝트를 서버로 가져오지 못했습니다.',
      )
      return null
    } finally {
      setIsMigrating(false)
      finishMutation()
    }
  }

  return {
    addProject,
    updateProject,
    deleteProject,
    migrateProject,
    isCreating,
    isMigrating,
    isMutating: Boolean(pendingMutation),
    pendingMutation,
    error,
    clearError: () => setError(null),
  }
}

export default useProjectMutations
