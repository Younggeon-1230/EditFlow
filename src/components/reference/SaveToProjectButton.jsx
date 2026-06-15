import { useState } from 'react'
import { STORAGE_KEYS } from '../../constants/app'

function isVideoSaved(videoId) {
  try {
    const savedVideos = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.savedReferences) ?? '[]',
    )
    return Array.isArray(savedVideos)
      ? savedVideos.some((video) => video.id === videoId)
      : false
  } catch {
    return false
  }
}

function SaveToProjectButton({ video }) {
  const [isSaved, setIsSaved] = useState(() => isVideoSaved(video.id))

  function handleSave() {
    try {
      const storedValue = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.savedReferences) ?? '[]',
      )
      const savedVideos = Array.isArray(storedValue) ? storedValue : []

      if (!savedVideos.some((savedVideo) => savedVideo.id === video.id)) {
        localStorage.setItem(
          STORAGE_KEYS.savedReferences,
          JSON.stringify([
            ...savedVideos,
            { ...video, savedAt: new Date().toISOString() },
          ]),
        )
      }

      setIsSaved(true)
      window.alert('레퍼런스를 임시 저장했습니다. 프로젝트 연결은 이후 제공됩니다.')
    } catch {
      window.alert('브라우저 저장소를 사용할 수 없어 저장하지 못했습니다.')
    }
  }

  return (
    <button
      className="save-reference-button"
      disabled={isSaved}
      onClick={handleSave}
      type="button"
    >
      {isSaved ? '저장됨' : '프로젝트에 저장'}
    </button>
  )
}

export default SaveToProjectButton
