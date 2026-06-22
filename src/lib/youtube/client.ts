const API = 'https://www.googleapis.com/youtube/v3'
const MAX_PAGES = 20

export interface YouTubeVideo {
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string | null
  durationSeconds: number
}

export function parseIso8601Duration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) return 0
  const [, h, min, s] = m
  return Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
}

interface PlaylistItemsResponse {
  items?: Array<{
    contentDetails?: { videoId?: string }
    snippet?: {
      title?: string
      publishedAt?: string
      thumbnails?: Record<string, { url?: string } | undefined>
    }
  }>
  nextPageToken?: string
}

interface VideosResponse {
  items?: Array<{
    id: string
    contentDetails?: { duration?: string }
  }>
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`youtube api ${res.status}`)
  return res.json() as Promise<T>
}

export async function listPlaylistVideos(playlistId: string, apiKey: string): Promise<YouTubeVideo[]> {
  const items: { videoId: string; title: string; publishedAt: string; thumbnailUrl: string | null }[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${API}/playlistItems`)
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('maxResults', '50')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('key', apiKey)
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const data = await getJson<PlaylistItemsResponse>(url.toString())
    for (const it of data.items ?? []) {
      const videoId = it.contentDetails?.videoId
      if (!videoId) continue
      const thumbs = it.snippet?.thumbnails ?? {}
      const thumb = thumbs.maxres ?? thumbs.high ?? thumbs.medium ?? thumbs.default
      items.push({
        videoId,
        title: it.snippet?.title ?? '',
        publishedAt: it.snippet?.publishedAt ?? '',
        thumbnailUrl: thumb?.url ?? null,
      })
    }
    pageToken = data.nextPageToken
    if (!pageToken) break
  }

  const durations = await fetchDurations(
    items.map((i) => i.videoId),
    apiKey
  )
  return items
    .filter((i) => durations.has(i.videoId))
    .map((i) => ({ ...i, durationSeconds: durations.get(i.videoId)! }))
}

async function fetchDurations(ids: string[], apiKey: string): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const url = new URL(`${API}/videos`)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('key', apiKey)
    const data = await getJson<VideosResponse>(url.toString())
    for (const it of data.items ?? []) {
      result.set(it.id, parseIso8601Duration(it.contentDetails?.duration ?? ''))
    }
  }
  return result
}
