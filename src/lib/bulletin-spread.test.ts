import { describe, expect, it } from 'vitest'
import {
  clampSpreadStart,
  moveSpread,
  pagesPerSpread,
  realignSpread,
  spreadLabel,
  spreadPageIndexes,
  spreadStartForPage,
} from './bulletin-spread'

describe('pagesPerSpread', () => {
  it('1280px 이상은 3면', () => {
    expect(pagesPerSpread(1280)).toBe(3)
    expect(pagesPerSpread(1920)).toBe(3)
  })

  it('768~1279px는 2면', () => {
    expect(pagesPerSpread(768)).toBe(2)
    expect(pagesPerSpread(1279)).toBe(2)
  })

  it('768px 미만은 1면', () => {
    expect(pagesPerSpread(767)).toBe(1)
    expect(pagesPerSpread(390)).toBe(1)
  })
})

describe('clampSpreadStart', () => {
  it('스프레드 경계로 내림 정렬한다', () => {
    expect(clampSpreadStart(4, 6, 3)).toBe(3)
    expect(clampSpreadStart(2, 6, 3)).toBe(0)
  })

  it('마지막 스프레드를 넘어가면 마지막으로 되돌린다', () => {
    expect(clampSpreadStart(99, 6, 3)).toBe(3)
  })

  it('나누어떨어지지 않는 면 수에서도 앞 면을 중복 노출하지 않는다', () => {
    // 5면 · 3면뷰 → 스프레드 시작은 0과 3. 3에서는 4·5면만 보인다(2면).
    expect(clampSpreadStart(3, 5, 3)).toBe(3)
    expect(clampSpreadStart(99, 5, 3)).toBe(3)
  })

  it('음수를 0으로 올린다', () => {
    expect(clampSpreadStart(-5, 6, 3)).toBe(0)
  })

  it('면이 없으면 0', () => {
    expect(clampSpreadStart(3, 0, 3)).toBe(0)
  })
})

describe('moveSpread', () => {
  it('스프레드 단위로 앞뒤로 이동한다', () => {
    expect(moveSpread(0, 1, 6, 3)).toBe(3)
    expect(moveSpread(3, -1, 6, 3)).toBe(0)
  })

  it('양끝에서 더 나가지 않는다', () => {
    expect(moveSpread(3, 1, 6, 3)).toBe(3)
    expect(moveSpread(0, -1, 6, 3)).toBe(0)
  })
})

describe('realignSpread', () => {
  it('폭이 줄어들면 현재 스프레드의 첫 면을 유지한다', () => {
    // 3면뷰에서 4~6면(start=3)을 보던 중 1면뷰로 전환 → 4면(index 3)
    expect(realignSpread(3, 6, 1)).toBe(3)
  })

  it('폭이 늘어나면 첫 면을 포함하는 스프레드로 정렬한다', () => {
    // 1면뷰에서 4면(index 3)을 보던 중 3면뷰로 전환 → 4~6면(start=3)
    expect(realignSpread(3, 6, 3)).toBe(3)
    // 1면뷰에서 5면(index 4) → 3면뷰에서는 4~6면 스프레드(start=3)
    expect(realignSpread(4, 6, 3)).toBe(3)
  })
})

describe('spreadPageIndexes', () => {
  it('스프레드에 담긴 면 인덱스를 순서대로 준다', () => {
    expect(spreadPageIndexes(0, 6, 3)).toEqual([0, 1, 2])
    expect(spreadPageIndexes(3, 6, 3)).toEqual([3, 4, 5])
  })

  it('마지막 스프레드가 덜 차면 남은 면만 준다', () => {
    expect(spreadPageIndexes(3, 5, 3)).toEqual([3, 4])
  })

  it('면이 없으면 빈 배열', () => {
    expect(spreadPageIndexes(0, 0, 3)).toEqual([])
  })
})

describe('spreadLabel', () => {
  it('여러 면이면 범위로 표기한다', () => {
    expect(spreadLabel(0, 6, 3)).toBe('1 – 3 / 6면')
  })

  it('한 면이면 단일 숫자로 표기한다', () => {
    expect(spreadLabel(3, 6, 1)).toBe('4 / 6면')
  })

  it('면이 없으면 0으로 표기한다', () => {
    expect(spreadLabel(0, 0, 3)).toBe('0 / 0면')
  })
})

describe('spreadStartForPage', () => {
  it('그 면을 포함하는 스프레드 시작을 준다', () => {
    expect(spreadStartForPage(4, 6, 3)).toBe(3)
    expect(spreadStartForPage(1, 6, 3)).toBe(0)
  })
})
