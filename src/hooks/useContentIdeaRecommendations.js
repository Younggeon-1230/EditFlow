import { useEffect, useMemo, useRef, useState } from 'react'
import {
  normalizeRecommendationError,
  recommendContentIdeas,
  saveContentIdeaRecommendation,
} from '../services/contentIdeaRecommendationsApi.js'

function withoutKey(object, key) {
  const next = { ...object }
  delete next[key]
  return next
}

function useContentIdeaRecommendations() {
  const [recommendations, setRecommendations] = useState([])
  const [responseMeta, setResponseMeta] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState(null)
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const [savingKeys, setSavingKeys] = useState(() => new Set())
  const [savedKeys, setSavedKeys] = useState(() => new Set())
  const [unavailableKeys, setUnavailableKeys] = useState(() => new Set())
  const [itemErrors, setItemErrors] = useState({})
  const [isSavingBatch, setIsSavingBatch] = useState(false)
  const recommendationsRef = useRef([])
  const generationController = useRef(null)
  const generationSequence = useRef(0)
  const generationLock = useRef(false)
  const saveControllers = useRef(new Map())
  const saveLocks = useRef(new Set())
  const savedTokens = useRef(new Set())
  const batchLock = useRef(false)
  const sessionVersion = useRef(0)
  const isMounted = useRef(true)

  useEffect(() => {
    recommendationsRef.current = recommendations
  }, [recommendations])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      generationSequence.current += 1
      generationController.current?.abort()
      saveControllers.current.forEach((controller) => controller.abort())
    }
  }, [])

  async function generate(values) {
    if (generationLock.current) return null
    generationLock.current = true
    generationController.current?.abort()
    const controller = new AbortController()
    const sequence = ++generationSequence.current
    const currentSession = sessionVersion.current
    generationController.current = controller
    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await recommendContentIdeas(values, controller.signal)
      if (
        !isMounted.current ||
        sequence !== generationSequence.current ||
        currentSession !== sessionVersion.current
      ) return null
      recommendationsRef.current = response.recommendations
      setRecommendations(response.recommendations)
      setResponseMeta(response)
      setSelectedKeys(new Set(response.recommendations.map((item) => item.clientKey)))
      setSavingKeys(new Set())
      setSavedKeys(new Set())
      setUnavailableKeys(new Set())
      setItemErrors({})
      savedTokens.current.clear()
      return response
    } catch (error) {
      if (
        isMounted.current &&
        sequence === generationSequence.current &&
        currentSession === sessionVersion.current
      ) {
        const normalized = normalizeRecommendationError(error)
        if (normalized) setGenerationError(normalized)
      }
      return null
    } finally {
      if (sequence === generationSequence.current) {
        generationLock.current = false
        generationController.current = null
        if (isMounted.current && currentSession === sessionVersion.current) {
          setIsGenerating(false)
        }
      }
    }
  }

  async function persistItem(clientKey) {
    const recommendation = recommendationsRef.current.find(
      (item) => item.clientKey === clientKey,
    )
    if (
      !recommendation ||
      saveLocks.current.has(clientKey) ||
      savedTokens.current.has(recommendation.saveToken)
    ) return null

    const currentSession = sessionVersion.current
    const controller = new AbortController()
    saveLocks.current.add(clientKey)
    saveControllers.current.set(clientKey, controller)
    setSavingKeys((current) => new Set(current).add(clientKey))
    setItemErrors((current) => withoutKey(current, clientKey))

    try {
      const savedIdea = await saveContentIdeaRecommendation(
        recommendation.saveToken,
        controller.signal,
      )
      if (!isMounted.current || currentSession !== sessionVersion.current) return null
      savedTokens.current.add(recommendation.saveToken)
      setSavedKeys((current) => new Set(current).add(clientKey))
      setSelectedKeys((current) => {
        const next = new Set(current)
        next.delete(clientKey)
        return next
      })
      return savedIdea
    } catch (error) {
      if (isMounted.current && currentSession === sessionVersion.current) {
        const normalized = normalizeRecommendationError(error)
        if (normalized) {
          setItemErrors((current) => ({ ...current, [clientKey]: normalized }))
          if (normalized.isPermanentTokenError) {
            setUnavailableKeys((current) => new Set(current).add(clientKey))
            setSelectedKeys((current) => {
              const next = new Set(current)
              next.delete(clientKey)
              return next
            })
          }
        }
      }
      return null
    } finally {
      saveLocks.current.delete(clientKey)
      saveControllers.current.delete(clientKey)
      if (isMounted.current && currentSession === sessionVersion.current) {
        setSavingKeys((current) => {
          const next = new Set(current)
          next.delete(clientKey)
          return next
        })
      }
    }
  }

  async function saveOne(clientKey) {
    const savedIdea = await persistItem(clientKey)
    return { savedIdea, successCount: savedIdea ? 1 : 0 }
  }

  async function saveSelected() {
    if (batchLock.current) return { successCount: 0, failureCount: 0 }
    const keys = recommendationsRef.current
      .map((item) => item.clientKey)
      .filter((key) => selectedKeys.has(key) && !savedKeys.has(key) && !unavailableKeys.has(key))
    if (!keys.length) return { successCount: 0, failureCount: 0 }

    batchLock.current = true
    setIsSavingBatch(true)
    const batchSession = sessionVersion.current
    let successCount = 0
    let failureCount = 0
    try {
      for (const key of keys) {
        if (batchSession !== sessionVersion.current) break
        const saved = await persistItem(key)
        if (batchSession !== sessionVersion.current) break
        if (saved) successCount += 1
        else failureCount += 1
      }
    } finally {
      batchLock.current = false
      if (isMounted.current) setIsSavingBatch(false)
    }
    return { successCount, failureCount }
  }

  function toggleSelection(clientKey) {
    if (savedKeys.has(clientKey) || unavailableKeys.has(clientKey) || savingKeys.has(clientKey)) return
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(clientKey)) next.delete(clientKey)
      else next.add(clientKey)
      return next
    })
  }

  function selectAllAvailable() {
    const available = recommendationsRef.current
      .map((item) => item.clientKey)
      .filter((key) => !savedKeys.has(key) && !unavailableKeys.has(key))
    const allSelected = available.length > 0 && available.every((key) => selectedKeys.has(key))
    setSelectedKeys(allSelected ? new Set() : new Set(available))
  }

  function reset() {
    sessionVersion.current += 1
    generationSequence.current += 1
    generationController.current?.abort()
    generationController.current = null
    generationLock.current = false
    saveControllers.current.forEach((controller) => controller.abort())
    saveControllers.current.clear()
    saveLocks.current.clear()
    savedTokens.current.clear()
    batchLock.current = false
    recommendationsRef.current = []
    setRecommendations([])
    setResponseMeta(null)
    setGenerationError(null)
    setIsGenerating(false)
    setSelectedKeys(new Set())
    setSavingKeys(new Set())
    setSavedKeys(new Set())
    setUnavailableKeys(new Set())
    setItemErrors({})
    setIsSavingBatch(false)
  }

  const availableKeys = useMemo(
    () => recommendations
      .map((item) => item.clientKey)
      .filter((key) => !savedKeys.has(key) && !unavailableKeys.has(key)),
    [recommendations, savedKeys, unavailableKeys],
  )
  const selectedAvailableCount = availableKeys.filter((key) => selectedKeys.has(key)).length
  const hasUnsavedResults = recommendations.some((item) => !savedKeys.has(item.clientKey))
  const hasPendingWork = isGenerating || savingKeys.size > 0 || isSavingBatch

  return {
    recommendations,
    responseMeta,
    isGenerating,
    generationError,
    selectedKeys,
    savingKeys,
    savedKeys,
    unavailableKeys,
    itemErrors,
    isSavingBatch,
    selectedAvailableCount,
    availableCount: availableKeys.length,
    hasUnsavedResults,
    hasPendingWork,
    generate,
    saveOne,
    saveSelected,
    toggleSelection,
    selectAllAvailable,
    reset,
  }
}

export default useContentIdeaRecommendations
