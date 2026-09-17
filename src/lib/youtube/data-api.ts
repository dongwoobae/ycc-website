import { thumbnailUrlFor } from './rapidapi-channel'
import type { YouTubeVideo, YouTubeVideoCandidate } from './types'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

/** 누락분 조회 상한. 쿼터는 메서드 단위라 50을 받아도 1 unit이다. */
const MAX_RESULTS = 50

export interface VideoDetail {
  durationSeconds: number
  isLiveOrUpcoming: boolean
}

/** 채널의 uploads 재생목록 ID. UC→UU 치환은 YouTube가 보장하는 규칙이다. */
export function uploadsPlaylistId(channelId: string): string {
  return `UU${channelId.slice(2)}`
}

/** ISO8601 duration(PT1H3M23S)을 초로. 형식이 아니거나 구성요소가 없으면 null. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value)
  if (!m || m.slice(1).every((g) => g === undefined)) return null
  const [, d, h, min, s] = m
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
}

interface RawPlaylistItem {
  snippet?: { title?: unknown }
  contentDetails?: { videoId?: unknown; videoPublishedAt?: unknown }
}

/**
 * playlistItems.list 응답을 후보 목록으로 정규화한다.
 * 업로드 시각은 contentDetails.videoPublishedAt이다 — snippet.publishedAt은 재생목록에 담긴 시각이라 다르다.
 */
export function normalizePlaylistItems(raw: unknown): YouTubeVideoCandidate[] {
  const items = (raw as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) return []
  const out: YouTubeVideoCandidate[] = []
  for (const it of items as RawPlaylistItem[]) {
    const videoId = typeof it.contentDetails?.videoId === 'string' ? it.contentDetails.videoId : ''
    if (!videoId) continue
    out.push({
      videoId,
      title: typeof it.snippet?.title === 'string' ? it.snippet.title : '',
      publishedAt: typeof it.contentDetails?.videoPublishedAt === 'string' ? it.contentDetails.videoPublishedAt : '',
    })
  }
  return out
}

interface RawVideoItem {
  id?: unknown
  snippet?: { liveBroadcastContent?: unknown }
  contentDetails?: { duration?: unknown }
}

/**
 * videos.list 응답을 videoId → 상세 맵으로 정규화한다.
 * 길이를 못 읽었거나 0 이하인 항목은 넣지 않는다 — 0초로 저장되면 오디오 받아쓰기의 길이 검사가 기준을 잃는다.
 * snippet은 liveBroadcastContent 때문에 받는다. 제목은 후보에 이미 있어 쓰지 않는다.
 */
export function normalizeVideoDetails(raw: unknown): Map<string, VideoDetail> {
  const items = (raw as { items?: unknown } | null)?.items
  const out = new Map<string, VideoDetail>()
  if (!Array.isArray(items)) return out
  for (const it of items as RawVideoItem[]) {
    const id = typeof it.id === 'string' ? it.id : ''
    if (!id) continue
    const durationSeconds = parseIsoDuration(it.contentDetails?.duration)
    // 0 이하(P0D·PT0S)는 방송 중이거나 방송 종료 후 VOD 처리가 끝나지 않은 영상의 신호다 —
    // liveBroadcastContent가 이미 'none'으로 넘어간 뒤에도 나타날 수 있어 그 필드로는 못 거른다.
    if (durationSeconds === null || durationSeconds <= 0) continue
    out.set(id, {
      durationSeconds,
      isLiveOrUpcoming: it.snippet?.liveBroadcastContent !== 'none',
    })
  }
  return out
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY is not set')
  return key
}

/** 요청 URL은 키를 쿼리스트링에 싣는다. 오류 메시지에 URL을 넣지 않는다. */
async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${API_BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', apiKey())
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`youtube data api ${path} ${res.status}`)
  return res.json()
}

/** uploads 재생목록의 최신 영상 후보를 최신순으로 가져온다. (1 unit) */
export async function listUploadCandidates(channelId: string): Promise<YouTubeVideoCandidate[]> {
  const raw = await getJson('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId(channelId),
    maxResults: String(MAX_RESULTS),
  })
  return normalizePlaylistItems(raw)
}

/** 영상 상세를 한 번에 가져온다. (1 unit, id는 50개까지) */
export async function fetchVideoDetails(videoIds: string[]): Promise<Map<string, VideoDetail>> {
  if (videoIds.length === 0) return new Map()
  const raw = await getJson('videos', {
    part: 'snippet,contentDetails',
    id: videoIds.slice(0, MAX_RESULTS).join(','),
  })
  return normalizeVideoDetails(raw)
}

/** 후보 + 상세를 등록 가능한 완성 타입으로 합친다. */
export function toYouTubeVideo(candidate: YouTubeVideoCandidate, detail: VideoDetail): YouTubeVideo {
  return {
    ...candidate,
    thumbnailUrl: thumbnailUrlFor(candidate.videoId),
    durationSeconds: detail.durationSeconds,
  }
}
