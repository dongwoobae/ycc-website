import { describe, expect, it } from 'vitest'
import { normalizeVideoInfo } from './rapidapi-video'

describe('normalizeVideoInfo', () => {
  it('maps a normal video/info response', () => {
    expect(
      normalizeVideoInfo({
        id: 'WWmty1Y26Ks',
        title: '영천중앙교회 260705 주일예배 / [여호수아 강해] 문지방의 시간을 넘는법',
        lengthSeconds: '4140',
        publishDate: '2026-07-04T22:56:57-07:00',
        isLiveContent: false,
      }),
    ).toEqual({
      videoId: 'WWmty1Y26Ks',
      title: '영천중앙교회 260705 주일예배 / [여호수아 강해] 문지방의 시간을 넘는법',
      publishedAt: '2026-07-05T05:56:57.000Z',
      thumbnailUrl: 'https://img.youtube.com/vi/WWmty1Y26Ks/hqdefault.jpg',
      durationSeconds: 4140,
    })
  })

  it('returns null for error responses without id', () => {
    expect(normalizeVideoInfo({ error: 'Video unavailable', code: '403' })).toBeNull()
    expect(normalizeVideoInfo(null)).toBeNull()
  })

  it('returns null while live or upcoming (retry later)', () => {
    expect(normalizeVideoInfo({ id: 'a', title: 't', isLiveNow: true })).toBeNull()
    expect(normalizeVideoInfo({ id: 'a', title: 't', isUpcoming: true })).toBeNull()
  })

  it('tolerates missing/invalid length and unparsable dates', () => {
    const v = normalizeVideoInfo({ id: 'a', title: 't', lengthSeconds: 'LIVE', publishDate: 'not-a-date' })
    expect(v).toEqual({
      videoId: 'a',
      title: 't',
      publishedAt: 'not-a-date',
      thumbnailUrl: 'https://img.youtube.com/vi/a/hqdefault.jpg',
      durationSeconds: 0,
    })
  })
})
