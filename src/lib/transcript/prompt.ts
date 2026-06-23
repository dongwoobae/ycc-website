export interface TranscriptSegment {
  startSeconds: number
  text: string
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** 세그먼트 배열을 "[MM:SS] 텍스트" 줄들로 결합한다. */
export function buildTranscriptText(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${mmss(s.startSeconds)}] ${s.text.trim()}`).join('\n')
}
