import { describe, expect, it } from 'vitest'
import { clampPageIndex, isLastPage, movePage, pageLabel } from './bulletin-paging'

describe('clampPageIndex', () => {
  it('범위 밖 인덱스를 양끝으로 붙인다', () => {
    expect(clampPageIndex(-3, 6)).toBe(0)
    expect(clampPageIndex(99, 6)).toBe(5)
  })

  it('범위 안 인덱스는 그대로 둔다', () => {
    expect(clampPageIndex(2, 6)).toBe(2)
  })

  it('면이 없으면 0이다', () => {
    expect(clampPageIndex(3, 0)).toBe(0)
  })
})

describe('movePage', () => {
  it('한 면씩 움직인다', () => {
    expect(movePage(2, 1, 6)).toBe(3)
    expect(movePage(2, -1, 6)).toBe(1)
  })

  it('양끝에서는 제자리에 머문다', () => {
    expect(movePage(0, -1, 6)).toBe(0)
    expect(movePage(5, 1, 6)).toBe(5)
  })
})

describe('isLastPage', () => {
  it('마지막 면에서만 참이다', () => {
    expect(isLastPage(4, 6)).toBe(false)
    expect(isLastPage(5, 6)).toBe(true)
  })

  it('면이 없으면 참이다 — 이동 버튼을 열어둘 이유가 없다', () => {
    expect(isLastPage(0, 0)).toBe(true)
  })
})

describe('pageLabel', () => {
  it('1-based 로 표기한다', () => {
    expect(pageLabel(0, 6)).toBe('1 / 6면')
    expect(pageLabel(5, 6)).toBe('6 / 6면')
  })

  it('면이 없으면 0으로 표기한다', () => {
    expect(pageLabel(0, 0)).toBe('0 / 0면')
  })
})
