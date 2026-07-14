import { describe, expect, it } from 'vitest'
import {
  buildBreadcrumbJsonLd,
  buildChurchJsonLd,
  buildSermonVideoJsonLd,
  normalizeUploadDate,
  secondsToIsoDuration,
  serializeJsonLd,
} from './jsonld'

describe('secondsToIsoDuration', () => {
  it('1초 미만/undefined는 undefined', () => {
    expect(secondsToIsoDuration(undefined)).toBeUndefined()
    expect(secondsToIsoDuration(0)).toBeUndefined()
  })
  it('초를 ISO 8601 기간으로 변환', () => {
    expect(secondsToIsoDuration(45)).toBe('PT45S')
    expect(secondsToIsoDuration(90)).toBe('PT1M30S')
    expect(secondsToIsoDuration(3661)).toBe('PT1H1M1S')
  })
})

describe('buildChurchJsonLd', () => {
  it('Church 스키마와 sameAs를 만든다', () => {
    const ld = buildChurchJsonLd()
    expect(ld['@type']).toBe('Church')
    expect(ld.name).toBe('영천중앙교회')
    expect(Array.isArray(ld.sameAs)).toBe(true)
    expect((ld.sameAs as string[]).some((u) => u.includes('youtube'))).toBe(true)
  })
})

describe('normalizeUploadDate', () => {
  it('YYYY-MM-DD에 KST 오프셋을 붙인다', () => {
    expect(normalizeUploadDate('2026-06-21')).toBe('2026-06-21T00:00:00+09:00')
  })
  it('이미 시간대가 있으면 그대로 둔다', () => {
    expect(normalizeUploadDate('2026-06-21T09:00:00+09:00')).toBe('2026-06-21T09:00:00+09:00')
    expect(normalizeUploadDate('2026-06-21T00:00:00Z')).toBe('2026-06-21T00:00:00Z')
  })
  it('빈 값·파싱 불가는 undefined', () => {
    expect(normalizeUploadDate('')).toBeUndefined()
    expect(normalizeUploadDate(undefined)).toBeUndefined()
    expect(normalizeUploadDate('날짜없음')).toBeUndefined()
  })
})

describe('buildSermonVideoJsonLd', () => {
  it('uploadDate는 시간대 포함 ISO 8601로 정규화된다', () => {
    const ld = buildSermonVideoJsonLd({ name: '주일예배', uploadDate: '2026-06-21' })
    expect(ld.name).toBe('주일예배')
    expect(ld.uploadDate).toBe('2026-06-21T00:00:00+09:00')
  })
  it('uploadDate가 잘못되면 키를 생략한다', () => {
    const ld = buildSermonVideoJsonLd({ name: 'x', uploadDate: '' })
    expect('uploadDate' in ld).toBe(false)
  })
  it('youtubeId가 있으면 embedUrl/contentUrl 포함', () => {
    const ld = buildSermonVideoJsonLd({
      name: '주일예배',
      uploadDate: '2026-06-21',
      youtubeId: 'abc123',
      durationSeconds: 90,
    })
    expect(ld['@type']).toBe('VideoObject')
    expect(ld.embedUrl).toBe('https://www.youtube.com/embed/abc123')
    expect(ld.duration).toBe('PT1M30S')
  })
  it('durationSeconds 없으면 duration 키 생략', () => {
    const ld = buildSermonVideoJsonLd({ name: 'x', uploadDate: '2026-06-21' })
    expect('duration' in ld).toBe(false)
  })
})

describe('buildBreadcrumbJsonLd', () => {
  it('position 1..n과 절대 URL을 만든다', () => {
    const ld = buildBreadcrumbJsonLd([
      { name: '홈', path: '/' },
      { name: '설교', path: '/sermons' },
    ])
    const items = ld.itemListElement as Array<Record<string, unknown>>
    expect(items[0].position).toBe(1)
    expect(items[1].position).toBe(2)
    expect(String(items[1].item)).toMatch(/^https?:\/\/.+\/sermons$/)
  })
})

describe('serializeJsonLd', () => {
  it('< 를 \\u003c 로 이스케이프해 script 주입을 막는다', () => {
    const out = serializeJsonLd({ x: '</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c')
  })
})
