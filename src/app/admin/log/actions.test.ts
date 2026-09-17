import { describe, expect, it } from 'vitest'
import { ACTION_BADGE, ACTION_OPTIONS } from './actions'

describe('관리자 로그 액션 목록', () => {
  it('warning을 필터에서 고를 수 있다', () => {
    expect(ACTION_OPTIONS).toContain('warning')
  })

  it('필터에 있는 모든 액션은 뱃지 색을 갖는다', () => {
    const missing = ACTION_OPTIONS.filter((a) => !ACTION_BADGE[a])
    expect(missing).toEqual([])
  })

  it('warning은 error와 다른 색이다', () => {
    expect(ACTION_BADGE.warning).not.toBe(ACTION_BADGE.error)
  })
})
