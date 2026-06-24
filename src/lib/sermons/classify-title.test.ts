import { describe, expect, it } from 'vitest'
import { classifyByTitle } from './classify-title'

describe('classifyByTitle', () => {
  it('주일찬양예배를 주일예배보다 우선한다', () => {
    expect(classifyByTitle('영천중앙교회 260614 주일찬양예배 / 직분은 사명입니다')).toBe('주일찬양예배')
  })

  it('각 유형을 키워드로 분류한다', () => {
    expect(classifyByTitle('영천중앙교회 260621 주일예배 / [재정] 채우심의 원리')).toBe('주일예배')
    expect(classifyByTitle('영천중앙교회 260617 수요예배 / 공공성')).toBe('수요예배')
    expect(classifyByTitle('영천중앙교회 금요기도회')).toBe('금요기도회')
    expect(classifyByTitle('영천중앙교회 260614 1여전도회 특송')).toBe('특송')
    expect(classifyByTitle('시온찬양대 특별찬양')).toBe('시온찬양대')
    expect(classifyByTitle('창립기념 특별행사')).toBe('특별행사')
  })

  it('키워드 없으면 미분류', () => {
    expect(classifyByTitle('영천중앙교회 광고 영상')).toBe('미분류')
    expect(classifyByTitle('')).toBe('미분류')
  })
})
