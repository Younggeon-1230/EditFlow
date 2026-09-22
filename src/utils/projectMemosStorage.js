export function loadStoredProjectMemos(storageKey) {
  if (!storageKey) return {}
  try {
    const parsed = JSON.parse(
      localStorage.getItem(storageKey) ?? '{}',
    )
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

export function persistProjectMemos(storageKey, memosByProject) {
  if (!storageKey) return
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(memosByProject),
    )
  } catch {
    // Keep local memo editing available in memory when storage is blocked.
  }
}
