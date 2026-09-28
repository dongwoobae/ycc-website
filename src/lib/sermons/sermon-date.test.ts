import { describe, expect, it } from 'vitest'
import { sermonDateFromTitle } from './sermon-date'

describe('sermonDateFromTitle', () => {
  it('제목의 YYMMDD를 날짜로 변환한다', () => {
    expect(sermonDateFromTitle('영천중앙교회 260621 주일예배 / [재정] 채우심의 원리', '')).toBe('2026-06-21')
    expect(sermonDateFromTitle('영천중앙교회 260617 수요예배', '2026-06-17T11:00:00.000Z')).toBe('2026-06-17')
  })

  it('YYYYMMDD 8자리도 읽는다', () => {
    expect(
      sermonDateFromTitle('영천중앙교회 20260208 주일예배 / 기도, 예수님이 가르쳐 주신', '2026-02-23T03:00:00.000Z'),
    ).toBe('2026-02-08')
  })

  it('연도 오타는 업로드 시각에 가장 가까운 해로 바로잡는다', () => {
    expect(sermonDateFromTitle('영천중앙교회 060920 주일예배 / 병거의 수보다', '2026-09-20T04:00:00.000Z')).toBe(
      '2026-09-20',
    )
    // 새해 첫 주에 지난해 연도를 쓰는 오타
    expect(sermonDateFromTitle('영천중앙교회 260103 주일예배', '2027-01-03T04:00:00.000Z')).toBe('2027-01-03')
  })

  it('해가 바뀐 직후 올린 지난해 영상과 지난해 영상의 일괄 등록은 제목 연도를 유지한다', () => {
    expect(sermonDateFromTitle('영천중앙교회 251231 송구영신예배', '2026-01-01T02:00:00.000Z')).toBe('2025-12-31')
    expect(sermonDateFromTitle('영천중앙교회 251026 주일예배', '2025-10-26T04:00:00.000Z')).toBe('2025-10-26')
  })

  it('업로드 시각을 해석할 수 없으면 제목 연도를 그대로 쓴다', () => {
    expect(sermonDateFromTitle('영천중앙교회 060920 주일예배', '')).toBe('2006-09-20')
    expect(sermonDateFromTitle('영천중앙교회 060920 주일예배', '1일 전')).toBe('2006-09-20')
  })

  it('유효하지 않은 날짜/토큰 없음은 null', () => {
    expect(sermonDateFromTitle('영천중앙교회 261345 주일예배', '')).toBeNull() // 13월 45일
    expect(sermonDateFromTitle('영천중앙교회 260231 주일예배', '')).toBeNull() // 2월 31일(존재X)
    expect(sermonDateFromTitle('영천중앙교회 250229 주일예배', '')).toBeNull() // 2025년 2월 29일(평년)
    expect(sermonDateFromTitle('영천중앙교회 240229 주일예배', '')).toBe('2024-02-29') // 2024 윤년 OK
    expect(sermonDateFromTitle('1234567 숫자7자리', '')).toBeNull()
    expect(sermonDateFromTitle('12345678 숫자8자리', '')).toBeNull()
    expect(sermonDateFromTitle('영천중앙교회 2026_1분기_사역 보고', '')).toBeNull()
    expect(sermonDateFromTitle('날짜 없는 제목', '')).toBeNull()
    expect(sermonDateFromTitle('', '')).toBeNull()
  })

  it('업로드 시각 앞뒤 반년 안에 존재하지 않는 날짜는 null', () => {
    // 2월 29일은 2025~2027 어느 해에도 없다. 2024-02-29로 1년 넘게 끌어가지 않는다.
    expect(sermonDateFromTitle('영천중앙교회 250229 주일예배', '2026-03-01T04:00:00.000Z')).toBeNull()
  })
})
