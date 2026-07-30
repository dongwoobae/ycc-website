import { describe, expect, it } from 'vitest'
import { bulletinSizes, scaleToLongEdge } from './bulletin-scale'

describe('bulletinSizes', () => {
  it('full·preview·thumb 세 크기를 내림차순으로 정의한다', () => {
    expect(bulletinSizes.full).toBe(2000)
    expect(bulletinSizes.preview).toBe(1000)
    expect(bulletinSizes.thumb).toBe(320)
  })
})

describe('scaleToLongEdge', () => {
  it('A4 세로 페이지의 긴 변을 limit으로 축소한다', () => {
    // 한도보다 큰 세로 이미지 — 높이가 긴 변
    expect(scaleToLongEdge(1414, 2000, 1000)).toEqual({ width: 707, height: 1000, scale: 0.5 })
  })

  it('가로가 긴 이미지는 가로를 기준으로 축소한다', () => {
    expect(scaleToLongEdge(2000, 1000, 1000)).toEqual({ width: 1000, height: 500, scale: 0.5 })
  })

  it('원본이 한도보다 작으면 확대하지 않고 그대로 둔다', () => {
    expect(scaleToLongEdge(800, 600, 2000)).toEqual({ width: 800, height: 600, scale: 1 })
  })

  it('한도와 정확히 같으면 그대로 둔다', () => {
    expect(scaleToLongEdge(1000, 500, 1000)).toEqual({ width: 1000, height: 500, scale: 1 })
  })

  it('축소 결과가 0으로 떨어지지 않도록 최소 1px을 보장한다', () => {
    const result = scaleToLongEdge(4000, 2, 320)
    expect(result.width).toBe(320)
    expect(result.height).toBe(1)
  })

  it('폭이나 높이가 0 이하면 던진다', () => {
    expect(() => scaleToLongEdge(0, 100, 320)).toThrow('invalid dimensions')
    expect(() => scaleToLongEdge(100, -1, 320)).toThrow('invalid dimensions')
  })
})
