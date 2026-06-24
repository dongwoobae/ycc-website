import { describe, expect, it } from 'vitest'
import { normalizeChannelItems, parseLengthText, thumbnailUrlFor } from './rapidapi-channel'

describe('parseLengthText', () => {
  it('parses h:mm:ss and m:ss', () => {
    expect(parseLengthText('1:16:44')).toBe(4604)
    expect(parseLengthText('41:17')).toBe(2477)
    expect(parseLengthText('59')).toBe(59)
  })
  it('returns 0 for invalid', () => {
    expect(parseLengthText('')).toBe(0)
    expect(parseLengthText(undefined)).toBe(0)
    expect(parseLengthText('LIVE')).toBe(0)
  })
})

describe('thumbnailUrlFor', () => {
  it('builds a stable img.youtube.com url from videoId', () => {
    expect(thumbnailUrlFor('abc')).toBe('https://img.youtube.com/vi/abc/hqdefault.jpg')
  })
})

describe('normalizeChannelItems', () => {
  it('keeps only type=video and maps fields', () => {
    const raw = [
      {
        type: 'video',
        videoId: 'abc',
        title: '영천중앙교회 260621 주일예배',
        publishedAt: '2026-06-21T00:00:00Z',
        lengthText: '1:16:44',
      },
      { type: 'shorts', videoId: 'zzz', title: 'short' },
      { type: 'video', title: 'no id' },
    ]
    expect(normalizeChannelItems(raw)).toEqual([
      {
        videoId: 'abc',
        title: '영천중앙교회 260621 주일예배',
        publishedAt: '2026-06-21T00:00:00Z',
        thumbnailUrl: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
        durationSeconds: 4604,
      },
    ])
  })

  it('falls back to publishDate and returns [] for non-array', () => {
    const raw = [{ type: 'video', videoId: 'd', publishDate: '2026-01-02' }]
    expect(normalizeChannelItems(raw)[0].publishedAt).toBe('2026-01-02')
    expect(normalizeChannelItems(null)).toEqual([])
  })
})
