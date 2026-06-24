import { describe, expect, it } from 'vitest'
import { normalizeChannelItems, parseLengthText, pickThumbnail } from './rapidapi-channel'

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

describe('pickThumbnail', () => {
  it('picks the widest url', () => {
    expect(
      pickThumbnail([
        { url: 'a', width: 168 },
        { url: 'b', width: 336 },
      ])
    ).toBe('b')
  })
  it('returns null when empty/invalid', () => {
    expect(pickThumbnail([])).toBeNull()
    expect(pickThumbnail(null)).toBeNull()
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
        thumbnail: [{ url: 'x', width: 480 }],
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
        thumbnailUrl: 'x',
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
