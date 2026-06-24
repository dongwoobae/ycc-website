import { describe, expect, it } from 'vitest'
import { formatKstDate } from './date'

describe('formatKstDate', () => {
  it('UTC 인스턴트를 KST 날짜로 변환한다(자정 경계에서 +1일)', () => {
    // 2026-06-23T21:00:00Z === 2026-06-24 06:00 KST
    expect(formatKstDate(new Date('2026-06-23T21:00:00Z'))).toBe('2026-06-24')
    // 2026-06-23T14:59:00Z === 2026-06-23 23:59 KST
    expect(formatKstDate(new Date('2026-06-23T14:59:00Z'))).toBe('2026-06-23')
  })

  it('ISO 문자열도 처리한다', () => {
    expect(formatKstDate('2026-06-23T21:00:00Z')).toBe('2026-06-24')
  })

  it('null/무효값은 - 를 반환한다', () => {
    expect(formatKstDate(null)).toBe('-')
    expect(formatKstDate(undefined)).toBe('-')
    expect(formatKstDate('not-a-date')).toBe('-')
  })
})
