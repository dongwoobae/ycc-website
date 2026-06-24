import { rapidApiConfig, rapidApiHeaders } from '@/lib/rapidapi'
import type { YouTubeVideo } from './client'

/** "1:16:44" / "41:17" / "59" 형태의 길이 문자열을 초로 변환한다. */
export function parseLengthText(text: unknown): number {
  if (typeof text !== 'string') return 0
  const parts = text.split(':').map((p) => Number(p.trim()))
  if (parts.some((n) => !Number.isFinite(n))) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

/** videoId로 안정적인 YouTube 썸네일 URL을 만든다. (서명 없는 고정 주소) */
export function thumbnailUrlFor(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

interface RawChannelItem {
  type?: unknown
  videoId?: unknown
  title?: unknown
  publishedAt?: unknown
  publishDate?: unknown
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
      thumbnailUrl: thumbnailUrlFor(videoId),
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
    // 한국어 원본 제목을 받기 위해 한국 로케일을 지정한다(일부 영상은 영어 번역 제목이 등록돼 있음).
    url.searchParams.set('geo', 'KR')
    url.searchParams.set('lang', 'ko')
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
