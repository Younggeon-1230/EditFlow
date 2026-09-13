import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { getUserStorageKey, USER_STORAGE_RESOURCES } from '../utils/userStorage.js'

function useUserStorageKey(resourceName) {
  const { user } = useAuth()
  return useMemo(() => {
    const resource = USER_STORAGE_RESOURCES[resourceName]
    return user && resource ? getUserStorageKey(user.id, resource) : null
  }, [resourceName, user])
}

export default useUserStorageKey
