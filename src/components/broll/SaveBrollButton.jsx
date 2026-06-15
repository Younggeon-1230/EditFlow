import { useState } from 'react'
import { STORAGE_KEYS } from '../../constants/app'

function isAssetSaved(assetId) {
  try {
    const savedAssets = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.savedBrolls) ?? '[]',
    )
    return Array.isArray(savedAssets)
      ? savedAssets.some((asset) => asset.id === assetId)
      : false
  } catch {
    return false
  }
}

function SaveBrollButton({ asset }) {
  const [isSaved, setIsSaved] = useState(() => isAssetSaved(asset.id))

  function handleSave() {
    try {
      const storedValue = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.savedBrolls) ?? '[]',
      )
      const savedAssets = Array.isArray(storedValue) ? storedValue : []

      if (!savedAssets.some((savedAsset) => savedAsset.id === asset.id)) {
        localStorage.setItem(
          STORAGE_KEYS.savedBrolls,
          JSON.stringify([
            ...savedAssets,
            { ...asset, savedAt: new Date().toISOString() },
          ]),
        )
      }

      setIsSaved(true)
      window.alert('B-roll 소스를 임시 저장했습니다. 프로젝트 연결은 이후 제공됩니다.')
    } catch {
      window.alert('브라우저 저장소를 사용할 수 없어 저장하지 못했습니다.')
    }
  }

  return (
    <button
      className="save-broll-button"
      disabled={isSaved}
      onClick={handleSave}
      type="button"
    >
      {isSaved ? '저장됨' : '프로젝트에 저장'}
    </button>
  )
}

export default SaveBrollButton
