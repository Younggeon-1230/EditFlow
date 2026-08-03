import { STORAGE_KEYS } from '../constants/app.js'

export function loadStoredProjectMemos() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.projectMemos) ?? '{}',
    )
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

export function persistProjectMemos(memosByProject) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.projectMemos,
      JSON.stringify(memosByProject),
    )
  } catch {
    // Keep local memo editing available in memory when storage is blocked.
  }
}

export function removeStoredProjectMemos(projectId) {
  const memosByProject = loadStoredProjectMemos()
  if (!Object.prototype.hasOwnProperty.call(memosByProject, projectId)) {
    return
  }
  const next = { ...memosByProject }
  delete next[projectId]
  persistProjectMemos(next)
}
