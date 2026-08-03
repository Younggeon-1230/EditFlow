import { getJson } from './apiClient'

const DEFAULT_MAX_RESULTS = 12

function mapYoutubeVideo(item) {
  return {
    id: item.external_id,
    externalId: item.external_id,
    provider: item.provider,
    title: item.title,
    description: item.description,
    channelTitle: item.channel_title ?? '',
    publishedAt: item.published_at,
    thumbnailUrl: item.thumbnail_url ?? '',
    videoUrl: item.url,
    url: item.url,
    viewCount: item.view_count ?? null,
    likeCount: item.like_count ?? null,
    commentCount: item.comment_count ?? null,
  }
}

export async function fetchYoutubeVideos({
  query,
  order,
  maxResults = DEFAULT_MAX_RESULTS,
  pageToken,
  signal,
}) {
  const data = await getJson('/api/external/youtube/search', {
    params: {
      query,
      order,
      max_results: maxResults,
      page_token: pageToken,
    },
    signal,
  })

  return {
    items: (data?.items ?? []).map(mapYoutubeVideo),
    nextPageToken: data?.next_page_token ?? null,
    prevPageToken: data?.prev_page_token ?? null,
    totalResults: data?.total_results ?? null,
    cached: Boolean(data?.cached),
  }
}
