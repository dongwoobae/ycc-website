import { rapidApiConfig, rapidApiHeaders } from '@/lib/rapidapi'
import type { YouTubeVideo } from './client'

/** "1:16:44" / "41:17" / "59" 형태의 길이 문자열을 초로 변환한다. */
export function parseLengthText(text: unknown): number {
  if (typeof text !== 'string') return 0
  const parts = text.split(':').map((p) => Number(p.trim()))
  if (parts.some((n) => !Number.isFinite(n))) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

interface RawThumb {
  url?: unknown
  width?: unknown
}

/** 썸네일 배열에서 가장 큰 해상도의 url을 고른다. */
export function pickThumbnail(thumbnails: unknown): string | null {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null
  let best: { url: string; width: number } | null = null
  for (const t of thumbnails as RawThumb[]) {
    const url = typeof t.url === 'string' ? t.url : ''
    if (!url) continue
    const width = Number(t.width) || 0
    if (!best || width >= best.width) best = { url, width }
  }
  return best?.url ?? null
}

interface RawChannelItem {
  type?: unknown
  videoId?: unknown
  title?: unknown
  publishedAt?: unknown
  publishDate?: unknown
  thumbnail?: unknown
  lengthText?: unknown
}

/** yt-api 채널 응답의 data[]를 YouTubeVideo[]로 정규화한다. (type==='video'만) */
export function normalizeChannelItems(items: unknown): YouTubeVideo[] {
  if (!Array.isArray(items)) return []
  const out: YouTubeVideo[] = []
  for (const it of items as RawChannelItem[]) {
    if (it.type !== 'video') continue
    const videoId = typeof it.videoId === 'string' ? it.videoId : ''
    if (!videoId) continue
    const publishedAt =
      (typeof it.publishedAt === 'string' && it.publishedAt) ||
      (typeof it.publishDate === 'string' && it.publishDate) ||
      ''
    out.push({
      videoId,
      title: typeof it.title === 'string' ? it.title : '',
      publishedAt,
      thumbnailUrl: pickThumbnail(it.thumbnail),
      durationSeconds: parseLengthText(it.lengthText),
    })
  }
  return out
}

interface ChannelVideosResponse {
  data?: unknown
  continuation?: string | null
}

/** yt-api로 채널 영상 목록을 continuation 페이지네이션으로 수집한다. */
export async function fetchChannelVideos(channelId: string, maxPages = 4): Promise<YouTubeVideo[]> {
  const { host } = rapidApiConfig()
  const headers = rapidApiHeaders()
  const collected: YouTubeVideo[] = []
  const seen = new Set<string>()
  let token: string | null = null

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`https://${host}/channel/videos`)
    url.searchParams.set('id', channelId)
    if (token) url.searchParams.set('token', token)

    const res = await fetch(url.toString(), { headers })
    if (!res.ok) throw new Error(`yt-api channel/videos ${res.status}`)
    const data = (await res.json()) as ChannelVideosResponse

    for (const v of normalizeChannelItems(data.data)) {
      if (seen.has(v.videoId)) continue
      seen.add(v.videoId)
      collected.push(v)
    }

    token = data.continuation ?? null
    if (!token) break
  }
  return collected
}
