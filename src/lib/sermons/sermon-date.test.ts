import { describe, expect, it } from 'vitest'
import { sermonDateFromTitle } from './sermon-date'

describe('sermonDateFromTitle', () => {
  it('제목의 YYMMDD를 날짜로 변환한다', () => {
    expect(sermonDateFromTitle('영천중앙교회 260621 주일예배 / [재정] 채우심의 원리')).toBe('2026-06-21')
    expect(sermonDateFromTitle('영천중앙교회 260617 수요예배')).toBe('2026-06-17')
  })

  it('유효하지 않은 날짜/토큰 없음은 null', () => {
    expect(sermonDateFromTitle('영천중앙교회 261345 주일예배')).toBeNull() // 13월 45일
    expect(sermonDateFromTitle('1234567 숫자7자리')).toBeNull()
    expect(sermonDateFromTitle('날짜 없는 제목')).toBeNull()
    expect(sermonDateFromTitle('')).toBeNull()
  })
})
