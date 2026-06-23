import { describe, expect, it } from 'vitest'
import { buildTranscriptText, type TranscriptSegment } from './prompt'

const segs: TranscriptSegment[] = [
  { startSeconds: 0, text: '안녕하세요' },
  { startSeconds: 65, text: '오늘 본문은' },
]

describe('buildTranscriptText', () => {
  it('prefixes each line with [MM:SS]', () => {
    expect(buildTranscriptText(segs)).toBe('[00:00] 안녕하세요\n[01:05] 오늘 본문은')
  })

  it('returns empty string for no segments', () => {
    expect(buildTranscriptText([])).toBe('')
  })
})
