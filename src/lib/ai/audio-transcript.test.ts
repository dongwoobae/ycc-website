import { describe, expect, it } from 'vitest'
import { assertCoversFullAudio, MIN_TRANSCRIPT_COVERAGE, parseTimestampedTranscript } from './audio-transcript'

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

describe('assertCoversFullAudio', () => {
  // thinkingBudget을 낮추면 모델이 앞부분만 받아쓰고 finishReason=STOP으로 정상 종료하는 것을 실측으로 확인했다.
  // finishReason 검사만으로는 이 조용한 절단이 통과하므로 커버리지로 막는다.
  it('throws when the transcript stops far short of the audio length', () => {
    const segments = [{ startSeconds: 457, text: '귀한 찬양 감사합니다.' }]
    expect(() => assertCoversFullAudio(segments, 3465)).toThrow(/stopped early/)
  })

  it('accepts a transcript that runs to the end of the audio', () => {
    const segments = [{ startSeconds: 3454, text: '아멘.' }]
    expect(() => assertCoversFullAudio(segments, 3465)).not.toThrow()
  })

  it('accepts a transcript sitting exactly on the coverage floor', () => {
    const segments = [{ startSeconds: Math.ceil(3465 * MIN_TRANSCRIPT_COVERAGE), text: '끝' }]
    expect(() => assertCoversFullAudio(segments, 3465)).not.toThrow()
  })

  // duration을 모르는 설교는 비교 기준이 없다 — 검사를 건너뛴다(문서화된 구멍).
  it('skips the check when the sermon has no duration', () => {
    const segments = [{ startSeconds: 5, text: '짧다' }]
    expect(() => assertCoversFullAudio(segments, null)).not.toThrow()
  })

  it('throws when there is nothing to measure', () => {
    expect(() => assertCoversFullAudio([], 3465)).toThrow(/stopped early/)
  })
})
