import { describe, expect, it, vi } from 'vitest'
import { isScheduled } from './posts'

vi.mock('@/lib/db', () => ({ db: {} }))

const NOW = new Date('2026-07-30T14:05:00+09:00')

describe('isScheduled', () => {
  it('공개 + 미래 게시 시각 → 예약', () => {
    expect(
      isScheduled({ isPublished: true, publishedAt: new Date('2026-07-30T15:00:00+09:00') }, NOW)
    ).toBe(true)
  })

  it('공개 + 이미 지난 게시 시각 → 예약 아님(공개 중)', () => {
    expect(
      isScheduled({ isPublished: true, publishedAt: new Date('2026-07-30T14:00:00+09:00') }, NOW)
    ).toBe(false)
  })

  it('비공개면 게시 시각이 미래여도 예약 아님', () => {
    expect(
      isScheduled({ isPublished: false, publishedAt: new Date('2026-08-01T00:00:00+09:00') }, NOW)
    ).toBe(false)
  })

  it('게시 시각 없음(레거시) → 예약 아님', () => {
    expect(isScheduled({ isPublished: true, publishedAt: null }, NOW)).toBe(false)
  })
})
