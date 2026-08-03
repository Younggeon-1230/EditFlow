import { STORAGE_KEYS } from '../constants/app.js'
import {
  createProject,
  mergeBackendProject,
} from '../services/projectsApi.js'

function isBackendProjectId(value) {
  return Number.isInteger(value) && value > 0
}

function loadStoredProjects() {
  try {
    const storedProjects = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.projects) ?? '[]',
    )
    return Array.isArray(storedProjects) ? storedProjects : []
  } catch {
    return []
  }
}

function persistProjects(projects) {
  try {
    localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects))
  } catch {
    // The caller still receives the migrated in-memory projects for retry.
  }
}

export function getProjectMigrationStatus(projects = loadStoredProjects()) {
  return projects.reduce(
    (status, project) => {
      if (isBackendProjectId(project.backendProjectId)) {
        status.linked += 1
      } else {
        status.pending += 1
        if (project.syncStatus === 'sync_failed') {
          status.failed += 1
        }
      }
      return status
    },
    {
      total: projects.length,
      linked: 0,
      pending: 0,
      failed: 0,
    },
  )
}

export async function migrateSingleProjectToBackend(
  localProject,
  createProjectRequest = createProject,
) {
  if (isBackendProjectId(localProject.backendProjectId)) {
    return {
      status: 'skipped',
      project: localProject,
    }
  }

  try {
    const backendProject = await createProjectRequest(localProject)
    return {
      status: 'migrated',
      project: mergeBackendProject(localProject, backendProject),
    }
  } catch (error) {
    return {
      status: 'failed',
      project: localProject,
      message: error.message || '프로젝트를 서버에 저장하지 못했습니다.',
    }
  }
}

export async function migrateLocalProjectsToBackend({
  projects = loadStoredProjects(),
  createProjectRequest = createProject,
} = {}) {
  let nextProjects = [...projects]
  const result = {
    total: nextProjects.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  }

  for (let index = 0; index < nextProjects.length; index += 1) {
    const localProject = nextProjects[index]
    const migration = await migrateSingleProjectToBackend(
      localProject,
      createProjectRequest,
    )

    if (migration.status === 'skipped') {
      result.skipped += 1
      continue
    }
    if (migration.status === 'failed') {
      result.failed += 1
      result.failures.push({
        localProjectId: localProject.id,
        message: migration.message,
      })
      continue
    }

    nextProjects[index] = migration.project
    result.migrated += 1
    persistProjects(nextProjects)
  }

  return {
    ...result,
    projects: nextProjects,
  }
}
