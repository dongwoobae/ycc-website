import { describe, expect, it } from 'vitest'
import { extractScripture } from './scripture'

describe('extractScripture', () => {
  it('한글 책이름 + 장:절을 추출한다', () => {
    expect(extractScripture('고난 중에도 감사하라 (마태복음 5:3)')).toBe('마태복음 5:3')
  })

  it('절 범위(5:3-5)도 추출한다', () => {
    expect(extractScripture('요한복음 3:16-17 핵심 메시지')).toBe('요한복음 3:16-17')
  })

  it('숫자 들어간 책이름(고린도전서)도 추출한다', () => {
    expect(extractScripture('사랑장 고린도전서 13:4 묵상')).toBe('고린도전서 13:4')
  })

  it('한글 표기(N장 M절)를 콜론 표기로 변환해 추출한다', () => {
    expect(extractScripture('본 설교는 빌립보서 4장 19절을 바탕으로 합니다')).toBe('빌립보서 4:19')
  })

  it('한글 표기 절 범위(-)도 추출한다', () => {
    expect(extractScripture('사도행전 13장 1-3절을 통해')).toBe('사도행전 13:1-3')
  })

  it('한글 표기 절 범위(물결표 ~)도 추출한다', () => {
    expect(extractScripture('야고보서 1장 19~25절 묵상')).toBe('야고보서 1:19-25')
  })

  it('구절이 없으면 빈 문자열을 반환한다', () => {
    expect(extractScripture('오늘의 은혜로운 말씀')).toBe('')
  })

  it('null/undefined는 빈 문자열', () => {
    expect(extractScripture(null)).toBe('')
    expect(extractScripture(undefined)).toBe('')
  })
})
