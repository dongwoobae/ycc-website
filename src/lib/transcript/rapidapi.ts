import type { TranscriptSegment } from './prompt'

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

/** HTML 엔티티를 디코드한다. YouTube timedtext는 이중 인코딩(&amp;gt;)이라 안정될 때까지 반복한다. */
export function decodeEntities(text: string): string {
  let prev = ''
  let cur = text
  for (let i = 0; i < 3 && cur !== prev; i++) {
    prev = cur
    cur = cur
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&[a-z]+;/gi, (m) => ENTITIES[m] ?? m)
  }
  return cur
}

/** YouTube timedtext XML(<text start dur>...)을 TranscriptSegment[]로 파싱한다. */
export function parseTimedTextXml(xml: unknown): TranscriptSegment[] {
  if (typeof xml !== 'string') return []
  const out: TranscriptSegment[] = []
  const re = /<text\s+start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const start = Number(m[1])
    const text = decodeEntities(m[2]).replace(/\s+/g, ' ').trim()
    if (!text) continue
    out.push({ startSeconds: Number.isFinite(start) ? Math.floor(start) : 0, text })
  }
  return out
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * YouTube timedtext 직접 주소를 가져온다. 429/5xx는 백오프 재시도 후에도 실패하면 throw(자막 없음과 구분).
 * 그 외 비정상 응답(404 등)은 자막 없음으로 보고 빈 문자열을 반환한다.
 */
async function fetchTimedText(url: string, maxAttempts = 4): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.text()
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxAttempts - 1) {
        await sleep(1000 * 2 ** attempt + Math.floor(Math.random() * 500))
        continue
      }
      throw new Error(`timedtext rate-limited (${res.status})`)
    }
    return ''
  }
  return ''
}

interface SubtitleTrack {
  languageCode?: string
  url?: string
}

interface SubtitlesResponse {
  subtitles?: SubtitleTrack[]
}

interface DirectTranscriptResponse {
  success?: boolean
  transcript?: unknown
  data?: unknown
}

interface DirectTranscriptItem {
  text?: unknown
  offset?: unknown
  start?: unknown
  startSeconds?: unknown
}

function transcriptRapidApiConfig(): { key: string; host: string } {
  const key = process.env.RAPIDAPI_KEY
  const host = process.env.RAPIDAPI_TRANSCRIPT_HOST ?? process.env.RAPIDAPI_HOST
  if (!key || !host) throw new Error('RAPIDAPI_KEY / RAPIDAPI_TRANSCRIPT_HOST not set')
  return { key, host }
}

function rapidApiHeaders(key: string, host: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-key': key,
    'x-rapidapi-host': host,
  }
}

function numberFrom(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export function normalizeDirectTranscript(input: unknown): TranscriptSegment[] {
  const items = Array.isArray(input)
    ? input
    : typeof input === 'object' && input !== null
      ? ((input as DirectTranscriptResponse).transcript ?? (input as DirectTranscriptResponse).data)
      : null
  if (!Array.isArray(items)) return []

  const out: TranscriptSegment[] = []
  for (const item of items as DirectTranscriptItem[]) {
    const text = typeof item.text === 'string' ? item.text.replace(/\s+/g, ' ').trim() : ''
    if (!text) continue
    // 현재 제공자(youtube-transcript3)는 offset/start를 '초' 단위로 반환한다.
    // ms로 반환하는 제공자로 교체하면 타임스탬프가 1000배 어긋나므로 환산 보정이 필요하다.
    const start = numberFrom(item.offset ?? item.startSeconds ?? item.start)
    out.push({ startSeconds: Math.max(0, Math.floor(start)), text })
  }
  return out
}

/** 자막 트랙 목록에서 한국어 트랙의 url을 고른다. */
export function pickKoreanTrackUrl(subtitles: SubtitleTrack[] | undefined): string | null {
  if (!Array.isArray(subtitles)) return null
  const ko =
    subtitles.find((s) => s.languageCode === 'ko') ??
    subtitles.find((s) => typeof s.languageCode === 'string' && s.languageCode.startsWith('ko'))
  return ko?.url ?? null
}

async function fetchTranscriptFromYoutubeTranscript3(
  videoId: string,
  host: string,
  headers: Record<string, string>
): Promise<TranscriptSegment[]> {
  const url = new URL(`https://${host}/api/transcript`)
  url.searchParams.set('videoId', videoId)

  const res = await fetch(url.toString(), { headers })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`youtube-transcript3 transcript ${res.status}`)
  const data = (await res.json()) as DirectTranscriptResponse
  if (data.success === false) return []
  return normalizeDirectTranscript(data)
}

async function fetchTranscriptFromYtApi(
  videoId: string,
  host: string,
  headers: Record<string, string>
): Promise<TranscriptSegment[]> {
  const listUrl = new URL(`https://${host}/subtitles`)
  listUrl.searchParams.set('id', videoId)
  listUrl.searchParams.set('lang', 'ko')

  const listRes = await fetch(listUrl.toString(), { headers })
  if (listRes.status === 404) return []
  if (!listRes.ok) throw new Error(`yt-api subtitles ${listRes.status}`)
  const list = (await listRes.json()) as SubtitlesResponse

  const trackUrl = pickKoreanTrackUrl(list.subtitles)
  if (!trackUrl) return []

  const xml = await fetchTimedText(trackUrl)
  if (!xml) return []
  return parseTimedTextXml(xml)
}

/**
 * yt-api에서 한국어 자막을 가져온다.
 * 자막 미준비/없음은 빈 배열로 처리한다(상위에서 재시도/포기 판단).
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const { key, host } = transcriptRapidApiConfig()
  const headers = rapidApiHeaders(key, host)

  if (host === 'youtube-transcript3.p.rapidapi.com') {
    return fetchTranscriptFromYoutubeTranscript3(videoId, host, headers)
  }

  return fetchTranscriptFromYtApi(videoId, host, headers)
}
