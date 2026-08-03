import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../../constants/app'

function isBackendProjectId(value) {
  return Number.isInteger(value) && value > 0
}

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

function SaveToProjectButton({ video, project, savedReferences }) {
  const externalId = video.externalId ?? video.id
  const usesBackend = isBackendProjectId(project?.backendProjectId)
  const [isSavedLocally, setIsSavedLocally] = useState(() =>
    isVideoSaved(video.id),
  )

  useEffect(() => {
    setIsSavedLocally(isVideoSaved(video.id))
  }, [project?.id, video.id])

  async function handleSave() {
    if (!project) {
      return
    }

    if (usesBackend) {
      await savedReferences.save(video)
      return
    }

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

      setIsSavedLocally(true)
      window.alert(
        '레퍼런스를 브라우저에 임시 저장했습니다. 이 프로젝트는 아직 서버와 동기화되지 않았습니다.',
      )
    } catch {
      window.alert('브라우저 저장소를 사용할 수 없어 저장하지 못했습니다.')
    }
  }

  const isSaved = usesBackend
    ? savedReferences.isSaved(externalId)
    : isSavedLocally
  const isSaving = usesBackend && savedReferences.isSavingItem(externalId)
  const isChecking = usesBackend && savedReferences.isLoading
  const label = !project
    ? '프로젝트 선택'
    : isSaved
      ? '저장됨'
      : isSaving
        ? '저장 중'
        : isChecking
          ? '저장 확인 중'
          : '프로젝트에 저장'

  return (
    <button
      className="save-reference-button"
      disabled={!project || isSaved || isSaving || isChecking}
      onClick={handleSave}
      type="button"
    >
      {label}
    </button>
  )
}

export default SaveToProjectButton
