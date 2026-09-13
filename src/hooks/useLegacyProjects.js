import { useCallback, useEffect, useMemo, useState } from 'react'
import useUserStorageKey from './useUserStorageKey.js'
import {
  classifyLegacyProjects,
  readStoredProjects,
} from '../utils/projectRead.js'

function useLegacyProjects(serverProjects = [], hasServerResult = false) {
  const storageKey = useUserStorageKey('projects')
  const [storedProjects, setStoredProjects] = useState(() =>
    readStoredProjects(localStorage, storageKey),
  )

  const reload = useCallback(() => {
    setStoredProjects(readStoredProjects(localStorage, storageKey))
  }, [storageKey])

  useEffect(() => {
    reload()
    function handleStorage(event) {
      if (event.key === storageKey) reload()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [reload, storageKey])

  const projects = useMemo(
    () => classifyLegacyProjects(storedProjects, serverProjects, hasServerResult),
    [hasServerResult, serverProjects, storedProjects],
  )

  return { projects, storedProjects, storageKey, reload }
}

export default useLegacyProjects
