import { describe, expect, it } from 'vitest'
import { decodeEntities, parseTimedTextXml, pickKoreanTrackUrl } from './rapidapi'

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('a &amp; b')).toBe('a & b')
    expect(decodeEntities('&#39;hi&#39;')).toBe("'hi'")
  })
  it('handles double-encoded YouTube markers', () => {
    expect(decodeEntities('&amp;gt;&amp;gt; 오소서')).toBe('>> 오소서')
  })
})

describe('parseTimedTextXml', () => {
  it('parses <text start dur> into segments', () => {
    const xml =
      '<?xml version="1.0"?><transcript>' +
      '<text start="119.92" dur="2.08">네.</text>' +
      '<text start="201.8" dur="3.872">진리의</text>' +
      '</transcript>'
    expect(parseTimedTextXml(xml)).toEqual([
      { startSeconds: 119, text: '네.' },
      { startSeconds: 201, text: '진리의' },
    ])
  })

  it('drops blank text and returns [] for non-string', () => {
    expect(parseTimedTextXml('<text start="1" dur="1">   </text>')).toEqual([])
    expect(parseTimedTextXml(null)).toEqual([])
  })
})

describe('pickKoreanTrackUrl', () => {
  it('prefers exact ko, then ko-prefixed', () => {
    expect(
      pickKoreanTrackUrl([
        { languageCode: 'en', url: 'en' },
        { languageCode: 'ko', url: 'ko' },
      ])
    ).toBe('ko')
    expect(pickKoreanTrackUrl([{ languageCode: 'ko-KR', url: 'kokr' }])).toBe('kokr')
  })
  it('returns null when no korean track', () => {
    expect(pickKoreanTrackUrl([{ languageCode: 'en', url: 'en' }])).toBeNull()
    expect(pickKoreanTrackUrl(undefined)).toBeNull()
  })
})
