import { describe, expect, it } from 'vitest'
import { formatBulletinDate, formatIssueLabel, formatPageAlt } from './bulletin-format'

describe('formatBulletinDate', () => {
  it('YYYY-MM-DD를 점 표기로 바꾼다', () => {
    expect(formatBulletinDate('2026-07-26')).toBe('2026. 7. 26')
  })

  it('앞자리 0을 지운다', () => {
    expect(formatBulletinDate('2026-01-04')).toBe('2026. 1. 4')
  })

  it('형식이 다르면 원본을 그대로 준다 — 화면이 깨지지 않게', () => {
    expect(formatBulletinDate('unknown')).toBe('unknown')
  })
})

describe('formatIssueLabel', () => {
  it('권과 호를 이어 붙인다', () => {
    expect(formatIssueLabel('제12권', '30호')).toBe('제12권 30호')
  })

  it('한쪽만 있으면 그것만 준다', () => {
    expect(formatIssueLabel('제12권', '')).toBe('제12권')
    expect(formatIssueLabel('', '30호')).toBe('30호')
  })

  it('둘 다 없으면 빈 문자열 — 호출부가 렌더를 생략한다', () => {
    expect(formatIssueLabel('', '')).toBe('')
    expect(formatIssueLabel('  ', '  ')).toBe('')
  })
})

describe('formatPageAlt', () => {
  it('스크린리더용 면 위치를 알린다', () => {
    expect(formatPageAlt('2026-07-26', 3)).toBe('2026년 7월 26일 주보 3면')
  })

  it('날짜 형식이 다르면 날짜를 그대로 쓴다', () => {
    expect(formatPageAlt('unknown', 1)).toBe('unknown 주보 1면')
  })
})
