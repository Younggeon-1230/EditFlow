import { useEffect, useState } from 'react'
import useUserStorageKey from '../../hooks/useUserStorageKey.js'

function isAssetSaved(storageKey, assetId) {
  if (!storageKey) return false
  try {
    const savedAssets = JSON.parse(
      localStorage.getItem(storageKey) ?? '[]',
    )
    return Array.isArray(savedAssets)
      ? savedAssets.some((asset) => asset.id === assetId)
      : false
  } catch {
    return false
  }
}

function SaveBrollButton({
  asset,
  project,
  savedBrolls,
  destinationType = 'project',
  idea,
  savedIdeaBrolls,
}) {
  const storageKey = useUserStorageKey('savedBrolls')
  const externalId = asset.externalId ?? asset.id
  const usesBackend = project?.projectKind === 'server'
  const usesLocalStorage = project?.projectKind === 'local'
  const [isSavedLocally, setIsSavedLocally] = useState(() =>
    usesLocalStorage ? isAssetSaved(storageKey, asset.id) : false,
  )

  useEffect(() => {
    setIsSavedLocally(
      usesLocalStorage ? isAssetSaved(storageKey, asset.id) : false,
    )
  }, [asset.id, storageKey, usesLocalStorage])

  async function handleSave() {
    if (destinationType === 'idea') {
      if (idea) await savedIdeaBrolls.save(asset)
      return
    }

    if (!project) {
      return
    }

    if (usesBackend) {
      await savedBrolls.save(asset)
      return
    }

    if (!usesLocalStorage) return

    try {
      const storedValue = JSON.parse(
        localStorage.getItem(storageKey) ?? '[]',
      )
      const savedAssets = Array.isArray(storedValue) ? storedValue : []

      if (!savedAssets.some((savedAsset) => savedAsset.id === asset.id)) {
        localStorage.setItem(
          storageKey,
          JSON.stringify([
            ...savedAssets,
            { ...asset, savedAt: new Date().toISOString() },
          ]),
        )
      }

      setIsSavedLocally(true)
      window.alert(
        'B-roll 소스를 브라우저에 임시 저장했습니다. 이 프로젝트는 아직 서버와 동기화되지 않았습니다.',
      )
    } catch {
      window.alert('브라우저 저장소를 사용할 수 없어 저장하지 못했습니다.')
    }
  }

  const isIdeaDestination = destinationType === 'idea'
  const isSaved = isIdeaDestination
    ? savedIdeaBrolls.isSaved(externalId)
    : usesBackend
      ? savedBrolls.isSaved(externalId)
      : isSavedLocally
  const isSaving = isIdeaDestination
    ? savedIdeaBrolls.isSavingItem(externalId)
    : usesBackend && savedBrolls.isSavingItem(externalId)
  const isChecking = isIdeaDestination
    ? savedIdeaBrolls.isLoading
    : usesBackend && savedBrolls.isLoading
  const hasDestination = isIdeaDestination ? Boolean(idea) : Boolean(project)
  const label = !hasDestination
    ? isIdeaDestination ? '콘텐츠 소재 선택' : '프로젝트 선택'
    : isSaved
      ? '저장됨'
      : isSaving
        ? '저장 중'
        : isChecking
          ? '저장 확인 중'
          : isIdeaDestination ? '소재에 저장' : '프로젝트에 저장'

  return (
    <button
      className="save-broll-button"
      disabled={!hasDestination || isSaved || isSaving || isChecking}
      onClick={handleSave}
      type="button"
    >
      {label}
    </button>
  )
}

export default SaveBrollButton
