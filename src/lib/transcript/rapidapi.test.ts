import { describe, expect, it } from 'vitest'
import { normalizeTranscript } from './rapidapi'

describe('normalizeTranscript', () => {
  it('maps text/offset to segments', () => {
    const raw = [
      { text: '가', offset: 0 },
      { text: '나', offset: 12.5 },
    ]
    expect(normalizeTranscript(raw)).toEqual([
      { startSeconds: 0, text: '가' },
      { startSeconds: 12, text: '나' },
    ])
  })

  it('drops blank text and returns [] for empty/invalid', () => {
    expect(normalizeTranscript([{ text: '   ', offset: 1 }])).toEqual([])
    expect(normalizeTranscript(null)).toEqual([])
  })
})
