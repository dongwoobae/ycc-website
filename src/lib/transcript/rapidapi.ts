import { rapidApiConfig, rapidApiHeaders } from '@/lib/rapidapi'
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

interface SubtitleTrack {
  languageCode?: string
  url?: string
}

interface SubtitlesResponse {
  subtitles?: SubtitleTrack[]
}

/** 자막 트랙 목록에서 한국어 트랙의 url을 고른다. */
export function pickKoreanTrackUrl(subtitles: SubtitleTrack[] | undefined): string | null {
  if (!Array.isArray(subtitles)) return null
  const ko =
    subtitles.find((s) => s.languageCode === 'ko') ??
    subtitles.find((s) => typeof s.languageCode === 'string' && s.languageCode.startsWith('ko'))
  return ko?.url ?? null
}

/**
 * yt-api에서 한국어 자막을 가져온다.
 * 자막 미준비/없음은 빈 배열로 처리한다(상위에서 재시도/포기 판단).
 */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const { host } = rapidApiConfig()
  const headers = rapidApiHeaders()

  const listUrl = new URL(`https://${host}/subtitles`)
  listUrl.searchParams.set('id', videoId)
  listUrl.searchParams.set('lang', 'ko')

  const listRes = await fetch(listUrl.toString(), { headers })
  if (listRes.status === 404) return []
  if (!listRes.ok) throw new Error(`yt-api subtitles ${listRes.status}`)
  const list = (await listRes.json()) as SubtitlesResponse

  const trackUrl = pickKoreanTrackUrl(list.subtitles)
  if (!trackUrl) return []

  // 트랙 url은 YouTube timedtext 직접 주소라 RapidAPI 쿼터를 쓰지 않는다.
  const xmlRes = await fetch(trackUrl)
  if (!xmlRes.ok) return []
  return parseTimedTextXml(await xmlRes.text())
}
