const API_BASE_URL = 'https://api.pexels.com'
const API_KEY = import.meta.env.VITE_PEXELS_API_KEY

async function requestPexels(path, query, signal) {
  const url = new URL(`${API_BASE_URL}${path}`)
  url.search = new URLSearchParams({
    query,
    per_page: '12',
  }).toString()

  const response = await fetch(url, {
    headers: {
      Authorization: API_KEY,
    },
    signal,
  })

  let data

  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || 'Pexels API 요청에 실패했습니다.',
    )
  }

  return data
}

function normalizeVideos(videos = []) {
  return videos.map((video) => ({
    id: `pexels-video-${video.id}`,
    type: 'Video',
    title: 'Video asset',
    creatorName: video.user?.name ?? 'Pexels Creator',
    thumbnailUrl: video.image ?? '',
    originalUrl: video.url,
  }))
}

function normalizePhotos(photos = []) {
  return photos.map((photo) => ({
    id: `pexels-photo-${photo.id}`,
    type: 'Photo',
    title: 'Photo asset',
    creatorName: photo.photographer ?? 'Pexels Creator',
    thumbnailUrl: photo.src?.large ?? photo.src?.medium ?? '',
    originalUrl: photo.url,
  }))
}

export async function fetchPexelsAssets({ query, type, signal }) {
  if (!API_KEY) {
    throw new Error('Pexels API Key가 설정되지 않았습니다.')
  }

  if (type === 'photos') {
    const data = await requestPexels('/v1/search', query, signal)
    return normalizePhotos(data.photos)
  }

  const data = await requestPexels('/videos/search', query, signal)
  return normalizeVideos(data.videos)
}
