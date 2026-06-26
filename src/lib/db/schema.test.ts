import { describe, expect, it } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { sermons, sermonTranscripts, sermonSummaries, sermonThumbnails } from './schema'

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

describe('sermon satellite tables', () => {
  it('sermon_summaries has summary + pipeline columns', () => {
    const cols = Object.keys(getTableColumns(sermonSummaries))
    for (const c of [
      'sermonId', 'summary', 'quickSummary', 'chapters',
      'summaryStatus', 'summaryAttempts', 'summaryNextRetryAt', 'summaryGeneratedAt', 'summaryModel', 'createdAt',
    ]) expect(cols).toContain(c)
  })
  it('sermon_transcripts has transcript columns', () => {
    const cols = Object.keys(getTableColumns(sermonTranscripts))
    for (const c of ['sermonId', 'transcriptText', 'transcriptFetchedAt']) expect(cols).toContain(c)
  })
  it('sermon_thumbnails has thumbnail working columns', () => {
    const cols = Object.keys(getTableColumns(sermonThumbnails))
    for (const c of ['sermonId', 'thumbnailCandidates', 'thumbnailBgKeywords', 'thumbnailBackgrounds']) expect(cols).toContain(c)
  })
})
