import { describe, expect, it, vi } from 'vitest'
import { toSermon, type SermonListRow } from './sermons'

vi.mock('@/lib/db', () => ({ db: {} }))

const base: SermonListRow = {
  id: 'id1',
  title: 't',
  displayTitle: null,
  preacher: '김목사',
  worshipType: '주일예배',
  sermonDate: '2026-01-01',
  videoUrl: 'https://youtu.be/abc',
  thumbnailUrl: null,
  summary: 's',
  isPublished: true,
  youtubeVideoId: 'abc',
  durationSeconds: 3600,
  quickSummary: ['p1', 'p2'],
  chapters: [{ startSeconds: 0, title: 'c', summary: 'cs' }],
  summaryStatus: 'ready',
}

describe('toSermon', () => {
  it('maps summary fields and derives youtubeId', () => {
    const s = toSermon(base)
    expect(s.youtubeId).toBe('abc')
    expect(s.quickSummary).toEqual(['p1', 'p2'])
    expect(s.chapters?.[0].title).toBe('c')
    expect(s.summaryStatus).toBe('ready')
  })

  it('falls back to youtube thumbnail when none stored', () => {
    expect(toSermon({ ...base, thumbnailUrl: null }).thumbnailUrl).toBe(
      'https://img.youtube.com/vi/abc/hqdefault.jpg'
    )
  })
})
