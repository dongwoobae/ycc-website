import { describe, expect, it } from 'vitest'
import { buildSummaryPrompt, parseSermonSummary } from './sermon-summary'

describe('buildSummaryPrompt', () => {
  it('길이가 있으면 전체 길이·기대 챕터 수·900초 제한을 명시한다', () => {
    const prompt = buildSummaryPrompt(4140)
    expect(prompt).toContain('4140초')
    expect(prompt).toContain('약 69분')
    expect(prompt).toContain('총 7개 안팎')
    expect(prompt).toContain('900초를 초과해서는 안 됩니다')
  })

  it('짧은 영상도 최소 1개 이상의 기대 챕터 수를 명시한다', () => {
    const prompt = buildSummaryPrompt(200)
    expect(prompt).toContain('총 1개 안팎')
  })

  it('길이를 모르면(null) 강제 챕터 수 지시를 생략한다', () => {
    const prompt = buildSummaryPrompt(null)
    expect(prompt).not.toContain('900초를 초과해서는 안 됩니다')
    expect(prompt).not.toContain('안팎이어야 합니다')
  })
})

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
