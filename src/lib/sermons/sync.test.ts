import { describe, expect, it, vi } from 'vitest'
import { planSermonInserts, type PlaylistVideo } from './sync'

vi.mock('@/lib/db', () => ({ db: {} }))

const v = (videoId: string, worshipType: PlaylistVideo['worshipType']): PlaylistVideo => ({
  videoId,
  worshipType,
  title: `t-${videoId}`,
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnailUrl: null,
  durationSeconds: 100,
})

describe('planSermonInserts', () => {
  it('skips existing and in-batch duplicates, keeps first (highest priority) worshipType', () => {
    const existing = new Set(['old'])
    const out = planSermonInserts(existing, [
      v('new1', '주일예배'),
      v('old', '수요예배'),
      v('new1', '특별행사'),
      v('new2', '금요기도회'),
    ])
    expect(out.map((r) => [r.youtubeVideoId, r.worshipType])).toEqual([
      ['new1', '주일예배'],
      ['new2', '금요기도회'],
    ])
  })

  it('maps fields into insert shape', () => {
    const [row] = planSermonInserts(new Set(), [v('x', '주일예배')])
    expect(row).toEqual({
      youtubeVideoId: 'x',
      title: 't-x',
      preacher: null,
      worshipType: '주일예배',
      sermonDate: '2026-01-01',
      videoUrl: 'https://youtu.be/x',
      thumbnailUrl: null,
      durationSeconds: 100,
    })
  })
})
