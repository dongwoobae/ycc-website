import { describe, expect, it } from 'vitest'
import { isSummaryInProgress } from './SermonSummary'

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
