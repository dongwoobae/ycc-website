import { describe, expect, it } from 'vitest'
import { clampOffset, isDraggable, nextZoom, offsetForStep, zoomScale, zoomSteps } from './bulletin-zoom'

const viewport = { width: 1000, height: 800 }
const content = { width: 2000, height: 2800 }

describe('zoomSteps / nextZoom', () => {
  it('맞춤 → 1× → 2× 순서다', () => {
    expect(zoomSteps).toEqual(['fit', '1x', '2x'])
  })

  it('한 단계씩 올린다', () => {
    expect(nextZoom('fit', 1)).toBe('1x')
    expect(nextZoom('1x', 1)).toBe('2x')
  })

  it('한 단계씩 내린다', () => {
    expect(nextZoom('2x', -1)).toBe('1x')
    expect(nextZoom('1x', -1)).toBe('fit')
  })

  it('양끝에서는 제자리에 머문다', () => {
    expect(nextZoom('2x', 1)).toBe('2x')
    expect(nextZoom('fit', -1)).toBe('fit')
  })
})

describe('isDraggable', () => {
  it('맞춤에서는 드래그를 막는다', () => {
    expect(isDraggable('fit')).toBe(false)
  })

  it('확대 단계에서는 드래그를 허용한다', () => {
    expect(isDraggable('1x')).toBe(true)
    expect(isDraggable('2x')).toBe(true)
  })
})

describe('zoomScale', () => {
  it('맞춤은 콘텐츠 전체가 뷰포트에 들어가는 배율이다', () => {
    // 세로가 더 빡빡하다: 800/2800 < 1000/2000
    expect(zoomScale('fit', viewport, content)).toBeCloseTo(800 / 2800)
  })

  it('맞춤은 1을 넘지 않는다 — 작은 이미지를 늘리지 않는다', () => {
    expect(zoomScale('fit', viewport, { width: 100, height: 100 })).toBe(1)
  })

  it('1×는 자연 크기, 2×는 그 두 배다', () => {
    expect(zoomScale('1x', viewport, content)).toBe(1)
    expect(zoomScale('2x', viewport, content)).toBe(2)
  })

  it('콘텐츠 크기가 아직 0이면 1로 폴백한다', () => {
    expect(zoomScale('fit', viewport, { width: 0, height: 0 })).toBe(1)
  })
})

describe('clampOffset', () => {
  it('확대된 콘텐츠가 뷰포트를 벗어난 만큼만 끌린다', () => {
    // scale 1 → 2000x2800. 가로 여유 (2000-1000)/2 = 500, 세로 (2800-800)/2 = 1000
    expect(clampOffset({ x: 900, y: 5000 }, 1, viewport, content)).toEqual({ x: 500, y: 1000 })
    expect(clampOffset({ x: -900, y: -5000 }, 1, viewport, content)).toEqual({ x: -500, y: -1000 })
  })

  it('범위 안의 오프셋은 그대로 둔다', () => {
    expect(clampOffset({ x: 100, y: -200 }, 1, viewport, content)).toEqual({ x: 100, y: -200 })
  })

  it('콘텐츠가 뷰포트보다 작으면 여백이 보이지 않도록 0으로 고정한다', () => {
    expect(clampOffset({ x: 300, y: 300 }, 0.1, viewport, content)).toEqual({ x: 0, y: 0 })
  })
})

describe('offsetForStep', () => {
  it('맞춤으로 돌아가면 오프셋을 0으로 리셋한다', () => {
    expect(offsetForStep('fit', { x: 400, y: 900 }, viewport, content)).toEqual({ x: 0, y: 0 })
  })

  it('확대 단계로 가면 새 배율 기준으로 클램프한다', () => {
    // scale 2 → 4000x5600. 가로 여유 1500, 세로 2400
    expect(offsetForStep('2x', { x: 9999, y: -9999 }, viewport, content)).toEqual({ x: 1500, y: -2400 })
  })
})
