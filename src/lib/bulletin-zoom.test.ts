import { describe, expect, it } from 'vitest'
import {
  clampOffset,
  clampZoom,
  distance,
  fitScale,
  fitView,
  isDraggable,
  maxZoom,
  midpoint,
  minZoom,
  panTo,
  scaleFor,
  wheelZoomFactor,
  zoomAt,
} from './bulletin-zoom'

const viewport = { width: 1000, height: 800 }
const content = { width: 2000, height: 2800 }
// 맞춤 배율: 세로가 더 빡빡하다 (800/2800 < 1000/2000)
const fit = 800 / 2800

describe('clampZoom', () => {
  it('맞춤(1)보다 축소하지 않는다', () => {
    expect(clampZoom(0.2)).toBe(minZoom)
  })

  it('상한을 넘지 않는다', () => {
    expect(clampZoom(100)).toBe(maxZoom)
  })

  it('범위 안의 값은 그대로 둔다', () => {
    expect(clampZoom(2.5)).toBe(2.5)
  })

  it('NaN 은 맞춤으로 되돌린다', () => {
    expect(clampZoom(Number.NaN)).toBe(minZoom)
  })
})

describe('fitScale / scaleFor', () => {
  it('맞춤은 콘텐츠 전체가 뷰포트에 들어가는 배율이다', () => {
    expect(fitScale(viewport, content)).toBeCloseTo(fit)
  })

  it('맞춤은 1을 넘지 않는다 — 작은 이미지를 늘리지 않는다', () => {
    expect(fitScale(viewport, { width: 100, height: 100 })).toBe(1)
  })

  it('콘텐츠 크기가 아직 0이면 1로 폴백한다', () => {
    expect(fitScale(viewport, { width: 0, height: 0 })).toBe(1)
  })

  it('실제 배율은 맞춤 × 상대 배율이다', () => {
    expect(scaleFor(2, viewport, content)).toBeCloseTo(fit * 2)
  })

  it('실제 배율도 줌 범위로 클램프된다', () => {
    expect(scaleFor(999, viewport, content)).toBeCloseTo(fit * maxZoom)
  })
})

describe('fitView', () => {
  it('시작 상태는 맞춤 배율에 오프셋 0이다 — 확대는 사용자가 직접 한다', () => {
    expect(fitView).toEqual({ zoom: minZoom, offset: { x: 0, y: 0 } })
  })
})

describe('isDraggable', () => {
  it('맞춤에서는 드래그할 것이 없다', () => {
    expect(isDraggable(1)).toBe(false)
  })

  it('확대 상태에서는 드래그를 허용한다', () => {
    expect(isDraggable(1.2)).toBe(true)
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

describe('zoomAt', () => {
  it('앵커 아래의 지점이 확대 후에도 같은 자리에 남는다', () => {
    const anchor = { x: 200, y: 100 }
    const before = { zoom: 1, offset: { x: 0, y: 0 } }
    const after = zoomAt(before, 4, anchor, viewport, content)

    // 앵커가 가리키던 콘텐츠 좌표가 두 배율에서 같아야 한다
    const pointBefore = { x: (anchor.x - before.offset.x) / (fit * 1), y: (anchor.y - before.offset.y) / (fit * 1) }
    const pointAfter = { x: (anchor.x - after.offset.x) / (fit * 4), y: (anchor.y - after.offset.y) / (fit * 4) }
    expect(pointAfter.x).toBeCloseTo(pointBefore.x)
    expect(pointAfter.y).toBeCloseTo(pointBefore.y)
  })

  it('앵커 고정보다 여백 방지가 우선한다 — 클램프 범위를 넘지 않는다', () => {
    // zoom 2 → scale 2×(800/2800) ≈ 0.571. 가로 여유 (2000×0.571 - 1000)/2 ≈ 71.4
    // 앵커를 그대로 고정하려면 x = -200 이 필요하지만 그러면 왼쪽에 여백이 드러난다.
    const after = zoomAt({ zoom: 1, offset: { x: 0, y: 0 } }, 2, { x: 200, y: 100 }, viewport, content)
    expect(after.offset.x).toBeCloseTo(-(2000 * fit * 2 - 1000) / 2)
  })

  it('맞춤으로 되돌리면 오프셋이 0이 된다 — 여백을 끌고 오지 않는다', () => {
    const zoomed = zoomAt({ zoom: 1, offset: { x: 0, y: 0 } }, 4, { x: 300, y: 200 }, viewport, content)
    expect(zoomAt(zoomed, 1, { x: 300, y: 200 }, viewport, content).offset).toEqual({ x: 0, y: 0 })
  })

  it('상·하한 밖으로 밀어도 범위 안에 머문다', () => {
    expect(zoomAt({ zoom: 4, offset: { x: 0, y: 0 } }, 0.1, { x: 0, y: 0 }, viewport, content).zoom).toBe(minZoom)
    expect(zoomAt({ zoom: 4, offset: { x: 0, y: 0 } }, 999, { x: 0, y: 0 }, viewport, content).zoom).toBe(maxZoom)
  })

  it('실측 전(콘텐츠 0)에는 중앙으로 되돌린다', () => {
    const result = zoomAt(
      { zoom: 1, offset: { x: 5, y: 5 } },
      2,
      { x: 10, y: 10 },
      { width: 0, height: 0 },
      { width: 0, height: 0 },
    )
    expect(result.offset).toEqual({ x: 0, y: 0 })
  })
})

describe('panTo', () => {
  it('현재 배율 기준으로 오프셋을 클램프하고 배율은 유지한다', () => {
    // zoom 4 → scale 4×(800/2800) ≈ 1.143. 가로 여유 (2000×1.143 - 1000)/2 ≈ 642.9
    const result = panTo({ zoom: 4, offset: { x: 0, y: 0 } }, { x: 9999, y: 0 }, viewport, content)
    expect(result.zoom).toBe(4)
    expect(result.offset.x).toBeCloseTo((2000 * fit * 4 - 1000) / 2)
  })
})

describe('wheelZoomFactor', () => {
  it('위로 굴리면(음수 delta) 확대, 아래로 굴리면 축소다', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1)
    expect(wheelZoomFactor(100)).toBeLessThan(1)
  })

  it('움직임이 없으면 배율도 그대로다', () => {
    expect(wheelZoomFactor(0)).toBe(1)
  })

  it('한 번에 뒤집히지 않도록 델타를 자른다', () => {
    expect(wheelZoomFactor(-100000)).toBe(wheelZoomFactor(-120))
  })

  it('줄·페이지 단위 델타를 픽셀로 환산한다 — 트랙패드와 휠의 감각을 맞춘다', () => {
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(wheelZoomFactor(-48))
    expect(wheelZoomFactor(-1, 2)).toBeCloseTo(wheelZoomFactor(-120))
  })
})

describe('distance / midpoint', () => {
  it('두 손가락 사이 거리를 잰다', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('두 손가락의 중점을 앵커로 준다', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })
})
