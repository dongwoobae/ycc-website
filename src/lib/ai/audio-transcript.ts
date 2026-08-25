import type { TranscriptSegment } from '@/lib/transcript/prompt'

const TIMESTAMP_LINE = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*(.*)$/

/** "[MM:SS] 발화" 또는 "[H:MM:SS] 발화" 줄들을 TranscriptSegment[]로 파싱한다. */
export function parseTimestampedTranscript(raw: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  for (const line of raw.split('\n')) {
    const match = TIMESTAMP_LINE.exec(line.trim())
    if (!match) continue
    const [, timestamp, text] = match
    const trimmedText = text.trim()
    if (!trimmedText) continue
    const parts = timestamp.split(':').map(Number)
    const startSeconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
    segments.push({ startSeconds, text: trimmedText })
  }
  return segments
}
