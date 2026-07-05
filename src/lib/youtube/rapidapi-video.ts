import { rapidApiConfig, rapidApiHeaders } from '@/lib/rapidapi'
import { thumbnailUrlFor } from './rapidapi-channel'
import type { YouTubeVideo } from './types'

interface RawVideoInfo {
  id?: unknown
  title?: unknown
  lengthSeconds?: unknown
  publishDate?: unknown
  uploadDate?: unknown
  isLiveNow?: unknown
  isUpcoming?: unknown
}

/** publishDate가 "-07:00" 같은 오프셋 포함 문자열이라 UTC ISO로 정규화한다. 파싱 불가면 원문 유지. */
function toUtcIso(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  const t = Date.parse(value)
  return Number.isNaN(t) ? value : new Date(t).toISOString()
}

/**
 * yt-api /video/info 응답을 YouTubeVideo로 정규화한다.
 * 오류 응답(id 없음)·진행 중 라이브·예약 공개는 null — 호출측 재시도 루프가 나중에 다시 시도한다.
 */
export function normalizeVideoInfo(raw: unknown): YouTubeVideo | null {
  const it = (raw ?? {}) as RawVideoInfo
  const videoId = typeof it.id === 'string' ? it.id : ''
  if (!videoId) return null
  if (it.isLiveNow === true || it.isUpcoming === true) return null
  const length = Number(it.lengthSeconds)
  return {
    videoId,
    title: typeof it.title === 'string' ? it.title : '',
    publishedAt: toUtcIso(it.publishDate ?? it.uploadDate),
    thumbnailUrl: thumbnailUrlFor(videoId),
    durationSeconds: Number.isFinite(length) ? length : 0,
  }
}

/** yt-api로 단일 영상 정보를 조회한다. 채널 목록과 달리 캐시 지연 없이 업로드 직후에도 조회된다. */
export async function fetchVideoInfo(videoId: string): Promise<YouTubeVideo | null> {
  const { host } = rapidApiConfig()
  const url = new URL(`https://${host}/video/info`)
  url.searchParams.set('id', videoId)
  url.searchParams.set('geo', 'KR')
  url.searchParams.set('lang', 'ko')
  const res = await fetch(url.toString(), { headers: rapidApiHeaders() })
  if (!res.ok) throw new Error(`yt-api video/info ${res.status}`)
  return normalizeVideoInfo(await res.json())
}
