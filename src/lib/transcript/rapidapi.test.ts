import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decodeEntities,
  fetchTranscript,
  normalizeDirectTranscript,
  parseTimedTextXml,
  pickKoreanTrackUrl,
} from './rapidapi'

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
      ]),
    ).toBe('ko')
    expect(pickKoreanTrackUrl([{ languageCode: 'ko-KR', url: 'kokr' }])).toBe('kokr')
  })
  it('returns null when no korean track', () => {
    expect(pickKoreanTrackUrl([{ languageCode: 'en', url: 'en' }])).toBeNull()
    expect(pickKoreanTrackUrl(undefined)).toBeNull()
  })
})

describe('normalizeDirectTranscript', () => {
  it('maps youtube-transcript3 transcript rows to segments', () => {
    expect(
      normalizeDirectTranscript({
        success: true,
        transcript: [
          { text: '  hello   world ', duration: 3.24, offset: 0.04, lang: 'en' },
          { text: 'second line', duration: 2, offset: 65.9, lang: 'en' },
        ],
      }),
    ).toEqual([
      { startSeconds: 0, text: 'hello world' },
      { startSeconds: 65, text: 'second line' },
    ])
  })

  it('decodes HTML entities the provider leaves in text', () => {
    expect(
      normalizeDirectTranscript({
        success: true,
        transcript: [
          { text: 'he says, &quot;So-and-so&quot; doesn&#39;t', duration: '3.49', offset: '5.34', lang: 'en' },
        ],
      }),
    ).toEqual([{ startSeconds: 5, text: `he says, "So-and-so" doesn't` }])
  })
})

describe('fetchTranscript (youtube-transcript3)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('requests the Korean track', async () => {
    vi.stubEnv('RAPIDAPI_KEY', 'test-key')
    vi.stubEnv('RAPIDAPI_TRANSCRIPT_HOST', 'youtube-transcript3.p.rapidapi.com')
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ success: true, transcript: [{ text: '말씀', duration: '4.32', offset: '2.16', lang: 'ko' }] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchTranscript('tkLEiTsoK8k')

    const requested = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requested.searchParams.get('lang')).toBe('ko')
  })
})
