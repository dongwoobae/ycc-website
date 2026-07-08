import { describe, expect, it } from 'vitest'
import { formatRegionKo } from './region-ko'

describe('formatRegionKo', () => {
  it('formats korean gu with sido prefix', () => {
    expect(formatRegionKo({ city: 'Suseong-gu', country: 'KR', countryRegion: '27' })).toBe('대구 수성구')
    expect(formatRegionKo({ city: 'Gangnam-gu', country: 'KR', countryRegion: '11' })).toBe('서울 강남구')
  })

  it('disambiguates same gu name across metros by countryRegion', () => {
    expect(formatRegionKo({ city: 'Jung-gu', country: 'KR', countryRegion: '11' })).toBe('서울 중구')
    expect(formatRegionKo({ city: 'Jung-gu', country: 'KR', countryRegion: '27' })).toBe('대구 중구')
  })

  it('collapses metro city name equal to sido', () => {
    expect(formatRegionKo({ city: 'Daegu', country: 'KR', countryRegion: '27' })).toBe('대구')
    expect(formatRegionKo({ city: 'Seoul', country: 'KR', countryRegion: '11' })).toBe('서울')
  })

  it('handles -si suffixed and plain city names', () => {
    expect(formatRegionKo({ city: 'Yeongcheon-si', country: 'KR', countryRegion: '47' })).toBe('경북 영천시')
    expect(formatRegionKo({ city: 'Suwon', country: 'KR', countryRegion: '41' })).toBe('경기 수원시')
  })

  it('accepts KR- prefixed countryRegion codes', () => {
    expect(formatRegionKo({ city: 'Suseong-gu', country: 'KR', countryRegion: 'KR-27' })).toBe('대구 수성구')
  })

  it('maps legacy rows without country by city table alone', () => {
    expect(formatRegionKo({ city: 'Suseong-gu', country: null, countryRegion: null })).toBe('수성구')
    expect(formatRegionKo({ city: 'Daegu', country: null, countryRegion: null })).toBe('대구')
  })

  it('keeps unmapped legacy foreign city as-is', () => {
    expect(formatRegionKo({ city: 'Council Bluffs', country: null, countryRegion: null })).toBe('Council Bluffs')
  })

  it('prefixes korean country name for foreign rows', () => {
    expect(formatRegionKo({ city: 'Council Bluffs', country: 'US', countryRegion: 'IA' })).toBe('미국 Council Bluffs')
    expect(formatRegionKo({ city: null, country: 'CA', countryRegion: null })).toBe('캐나다')
  })

  it('falls back to 대한민국 for korean rows without city and sido', () => {
    expect(formatRegionKo({ city: null, country: 'KR', countryRegion: null })).toBe('대한민국')
  })

  it('returns null when nothing is known', () => {
    expect(formatRegionKo({ city: null, country: null, countryRegion: null })).toBeNull()
  })
})
