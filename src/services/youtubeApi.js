const API_BASE_URL = 'https://www.googleapis.com/youtube/v3'
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

function decodeHtml(value) {
  const parser = new DOMParser()
  return parser.parseFromString(value, 'text/html').documentElement.textContent
}

async function requestYoutube(endpoint, params, signal) {
  const url = new URL(`${API_BASE_URL}/${endpoint}`)
  url.search = new URLSearchParams({ ...params, key: API_KEY }).toString()

  const response = await fetch(url, { signal })
  const data = await response.json()

  if (!response.ok) {
    const apiMessage = data.error?.message
    throw new Error(apiMessage || 'YouTube API 요청에 실패했습니다.')
  }

  return data
}

export async function fetchYoutubeVideos({ query, order, signal }) {
  if (!API_KEY) {
    throw new Error('YouTube API Key가 설정되지 않았습니다.')
  }

  const searchData = await requestYoutube(
    'search',
    {
      part: 'snippet',
      type: 'video',
      maxResults: '10',
      q: query,
      order,
    },
    signal,
  )

  const videoIds = searchData.items
    .map((item) => item.id?.videoId)
    .filter(Boolean)

  if (videoIds.length === 0) {
    return []
  }

  const videoData = await requestYoutube(
    'videos',
    {
      part: 'statistics,contentDetails',
      id: videoIds.join(','),
    },
    signal,
  )

  const statisticsById = new Map(
    videoData.items.map((item) => [item.id, item.statistics ?? {}]),
  )

  return searchData.items.map((item) => {
    const id = item.id.videoId
    const statistics = statisticsById.get(id) ?? {}

    return {
      id,
      title: decodeHtml(item.snippet.title),
      channelTitle: decodeHtml(item.snippet.channelTitle),
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl:
        item.snippet.thumbnails?.medium?.url ??
        item.snippet.thumbnails?.default?.url ??
        '',
      viewCount: Number(statistics.viewCount ?? 0),
      likeCount: Number(statistics.likeCount ?? 0),
      commentCount: Number(statistics.commentCount ?? 0),
      videoUrl: `https://www.youtube.com/watch?v=${id}`,
    }
  })
}
