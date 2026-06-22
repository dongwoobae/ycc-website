import { afterEach, describe, expect, it, vi } from 'vitest'
import { listPlaylistVideos, parseIso8601Duration } from './client'

afterEach(() => vi.restoreAllMocks())

describe('parseIso8601Duration', () => {
  it('parses H/M/S', () => {
    expect(parseIso8601Duration('PT3S')).toBe(3)
    expect(parseIso8601Duration('PT2M3S')).toBe(123)
    expect(parseIso8601Duration('PT1H2M3S')).toBe(3723)
    expect(parseIso8601Duration('PT1H')).toBe(3600)
  })

  it('returns 0 on garbage', () => {
    expect(parseIso8601Duration('nope')).toBe(0)
  })
})

describe('listPlaylistVideos', () => {
  it('paginates and enriches with duration, dropping inaccessible videos', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          nextPageToken: 'p2',
          items: [
            {
              contentDetails: { videoId: 'a' },
              snippet: {
                title: 'A',
                publishedAt: '2026-01-01T00:00:00Z',
                thumbnails: { high: { url: 'ta' } },
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              contentDetails: { videoId: 'b' },
              snippet: { title: 'B', publishedAt: '2026-01-08T00:00:00Z', thumbnails: {} },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: 'a', contentDetails: { duration: 'PT1H' } }],
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const out = await listPlaylistVideos('PL1', 'KEY')
    expect(out).toEqual([
      { videoId: 'a', title: 'A', publishedAt: '2026-01-01T00:00:00Z', thumbnailUrl: 'ta', durationSeconds: 3600 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}
