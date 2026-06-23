import type { TranscriptSegment } from './prompt'

interface RawSegment {
  text?: unknown
  offset?: unknown
}

/** RapidAPI 응답 배열을 TranscriptSegment[]로 정규화하고 빈 텍스트는 제거한다. */
export function normalizeTranscript(raw: unknown): TranscriptSegment[] {
  if (!Array.isArray(raw)) return []
  const out: TranscriptSegment[] = []
  for (const item of raw as RawSegment[]) {
    const text = typeof item.text === 'string' ? item.text.trim() : ''
    if (!text) continue
    const offset = Number(item.offset)
    out.push({ startSeconds: Number.isFinite(offset) ? Math.floor(offset) : 0, text })
  }
  return out
}

/** RapidAPI에서 자막을 가져온다. 자막 미준비/없음은 빈 배열로 처리한다. */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const key = process.env.RAPIDAPI_KEY
  const host = process.env.RAPIDAPI_TRANSCRIPT_HOST
  if (!key || !host) throw new Error('RAPIDAPI_KEY / RAPIDAPI_TRANSCRIPT_HOST not set')

  const url = new URL(`https://${host}/transcript`)
  url.searchParams.set('video_id', videoId)
  url.searchParams.set('lang', 'ko')

  const res = await fetch(url.toString(), {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`rapidapi transcript ${res.status}`)
  const data = await res.json()
  return normalizeTranscript(Array.isArray(data) ? data : (data?.transcript ?? data?.data))
}
