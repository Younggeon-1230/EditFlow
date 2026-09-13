import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ApiError, subscribeToUnauthorized } from '../services/apiClient.js'
import * as authApi from '../services/authApi.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const mountedRef = useRef(false)
  const operationVersionRef = useRef(0)

  const applySignedOut = useCallback(() => {
    operationVersionRef.current += 1
    if (!mountedRef.current) return
    setUser(null)
    setAuthError(null)
    setIsLoading(false)
  }, [])

  const refreshUser = useCallback(async () => {
    const operationVersion = ++operationVersionRef.current
    setIsLoading(true)
    setAuthError(null)

    try {
      const currentUser = await authApi.getMe()
      if (mountedRef.current && operationVersion === operationVersionRef.current) {
        setUser(currentUser)
      }
      return currentUser
    } catch (error) {
      if (!mountedRef.current || operationVersion !== operationVersionRef.current) {
        return null
      }
      setUser(null)
      if (error instanceof ApiError && error.status === 401) {
        setAuthError(null)
        return null
      }
      setAuthError(error)
      throw error
    } finally {
      if (mountedRef.current && operationVersion === operationVersionRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const unsubscribe = subscribeToUnauthorized(applySignedOut)
    refreshUser().catch(() => {})

    return () => {
      mountedRef.current = false
      operationVersionRef.current += 1
      unsubscribe()
    }
  }, [applySignedOut, refreshUser])

  const runAuthOperation = useCallback(async (operation, credentials) => {
    const operationVersion = ++operationVersionRef.current
    setAuthError(null)
    const authenticatedUser = await operation(credentials)
    if (mountedRef.current && operationVersion === operationVersionRef.current) {
      setUser(authenticatedUser)
      setIsLoading(false)
    }
    return authenticatedUser
  }, [])

  const login = useCallback(
    (credentials) => runAuthOperation(authApi.login, credentials),
    [runAuthOperation],
  )

  const signup = useCallback(
    (credentials) => runAuthOperation(authApi.signup, credentials),
    [runAuthOperation],
  )

  const logout = useCallback(async () => {
    const operationVersion = ++operationVersionRef.current
    try {
      await authApi.logout()
      if (mountedRef.current && operationVersion === operationVersionRef.current) {
        setUser(null)
        setAuthError(null)
        setIsLoading(false)
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        applySignedOut()
        return
      }
      throw error
    }
  }, [applySignedOut])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      authError,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [authError, isLoading, login, logout, refreshUser, signup, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return context
}
