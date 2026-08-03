import { getJson } from './apiClient'

const DEFAULT_PER_PAGE = 12

function mapPexelsVideo(item) {
  return {
    id: `pexels-video-${item.external_id}`,
    externalId: item.external_id,
    provider: item.provider,
    type: 'Video',
    title: item.title ?? 'Video asset',
    creatorName: item.creator_name ?? 'Pexels Creator',
    thumbnailUrl: item.thumbnail_url ?? item.preview_url ?? '',
    previewUrl: item.preview_url,
    originalUrl: item.url,
    url: item.url,
    durationSeconds: item.duration_seconds,
    width: item.width,
    height: item.height,
  }
}

export async function fetchPexelsAssets({
  query,
  type,
  page = 1,
  perPage = DEFAULT_PER_PAGE,
  orientation,
  size,
  signal,
}) {
  if (type === 'photos') {
    throw new Error('현재 백엔드 프록시는 Pexels 영상 검색만 지원합니다.')
  }

  const data = await getJson('/api/external/pexels/search', {
    params: {
      query,
      page,
      per_page: perPage,
      orientation,
      size,
    },
    signal,
  })

  return {
    items: (data?.items ?? []).map(mapPexelsVideo),
    page: data?.page ?? page,
    perPage: data?.per_page ?? perPage,
    totalResults: data?.total_results ?? null,
    nextPage: data?.next_page ?? null,
    prevPage: data?.prev_page ?? null,
    cached: Boolean(data?.cached),
  }
}
