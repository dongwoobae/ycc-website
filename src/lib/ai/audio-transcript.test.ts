import { describe, expect, it } from 'vitest'
import { parseTimestampedTranscript } from './audio-transcript'

describe('parseTimestampedTranscript', () => {
  it('parses [MM:SS] lines', () => {
    const raw = '[00:02] 안녕하세요\n[00:06] 오늘 말씀은'
    expect(parseTimestampedTranscript(raw)).toEqual([
      { startSeconds: 2, text: '안녕하세요' },
      { startSeconds: 6, text: '오늘 말씀은' },
    ])
  })

  it('parses [H:MM:SS] lines (1시간 넘는 영상에서 모델이 바꿔 쓰는 형식)', () => {
    const raw = '[01:06:27] 마지막 문장입니다'
    expect(parseTimestampedTranscript(raw)).toEqual([{ startSeconds: 3987, text: '마지막 문장입니다' }])
  })

  it('skips blank lines and lines without a timestamp', () => {
    const raw = '[00:02] 첫 줄\n\n설명 없는 줄\n[00:10] 다음 줄'
    expect(parseTimestampedTranscript(raw)).toEqual([
      { startSeconds: 2, text: '첫 줄' },
      { startSeconds: 10, text: '다음 줄' },
    ])
  })

  it('skips a timestamp line with no text after it', () => {
    const raw = '[00:02] \n[00:05] 실제 내용'
    expect(parseTimestampedTranscript(raw)).toEqual([{ startSeconds: 5, text: '실제 내용' }])
  })

  it('returns an empty array for empty input', () => {
    expect(parseTimestampedTranscript('')).toEqual([])
  })
})
