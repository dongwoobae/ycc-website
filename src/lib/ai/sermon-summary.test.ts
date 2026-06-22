import { describe, expect, it } from 'vitest'
import { parseSermonSummary } from './sermon-summary'

const valid = {
  summary: '한 줄 소개',
  quickSummary: ['요점1', '요점2'],
  chapters: [
    { startSeconds: 0, title: '도입', summary: '인사' },
    { startSeconds: 120, title: '본문', summary: '말씀' },
  ],
}

describe('parseSermonSummary', () => {
  it('accepts a well-formed payload', () => {
    expect(parseSermonSummary(valid, 600)).toEqual(valid)
  })

  it('rejects out-of-order chapters', () => {
    const bad = { ...valid, chapters: [valid.chapters[1], valid.chapters[0]] }
    expect(() => parseSermonSummary(bad, 600)).toThrow()
  })

  it('rejects chapter beyond duration', () => {
    expect(() => parseSermonSummary(valid, 100)).toThrow()
  })

  it('rejects empty title/summary', () => {
    const bad = { ...valid, chapters: [{ startSeconds: 0, title: '', summary: 'x' }] }
    expect(() => parseSermonSummary(bad, 600)).toThrow()
  })

  it('rejects wrong shape', () => {
    expect(() => parseSermonSummary({ summary: 1 }, 600)).toThrow()
  })
})
