import { describe, expect, it } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { sermons } from './schema'

describe('sermons schema', () => {
  it('has the youtube/summary columns', () => {
    const cols = Object.keys(getTableColumns(sermons))
    for (const c of [
      'youtubeVideoId', 'durationSeconds', 'quickSummary', 'chapters',
      'summaryStatus', 'summaryAttempts', 'summaryNextRetryAt', 'summaryGeneratedAt', 'summaryModel',
    ]) {
      expect(cols).toContain(c)
    }
  })

  it('makes preacher nullable', () => {
    expect(getTableColumns(sermons).preacher.notNull).toBe(false)
  })
})
