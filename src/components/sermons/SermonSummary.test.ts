import { describe, expect, it } from 'vitest'
import { clampFontLevel, isSummaryInProgress, SUMMARY_FONT_SIZES } from './SermonSummary'

describe('isSummaryInProgress', () => {
  it('shows pending only for auto-summary worship types', () => {
    expect(isSummaryInProgress({ summaryStatus: 'none', worshipType: '주일예배' })).toBe(true)
    expect(isSummaryInProgress({ summaryStatus: 'pending', worshipType: '수요예배' })).toBe(true)
    expect(isSummaryInProgress({ summaryStatus: 'none', worshipType: '특송' })).toBe(false)
    expect(isSummaryInProgress({ summaryStatus: 'pending', worshipType: '미분류' })).toBe(false)
  })

  it('does not show pending for ready or failed summaries', () => {
    expect(isSummaryInProgress({ summaryStatus: 'ready', worshipType: '주일예배' })).toBe(false)
    expect(isSummaryInProgress({ summaryStatus: 'failed', worshipType: '주일예배' })).toBe(false)
  })
})

describe('clampFontLevel', () => {
  it('keeps valid levels as-is', () => {
    expect(clampFontLevel(0)).toBe(0)
    expect(clampFontLevel(SUMMARY_FONT_SIZES.length - 1)).toBe(SUMMARY_FONT_SIZES.length - 1)
  })

  it('clamps out-of-range levels', () => {
    expect(clampFontLevel(-1)).toBe(0)
    expect(clampFontLevel(99)).toBe(SUMMARY_FONT_SIZES.length - 1)
  })

  it('falls back to default for corrupted stored values', () => {
    expect(clampFontLevel(Number('abc'))).toBe(0)
    expect(clampFontLevel(1.5)).toBe(0)
  })
})
