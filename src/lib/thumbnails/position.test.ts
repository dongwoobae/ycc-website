import { describe, expect, it } from 'vitest'
import { positionToLayout } from './position'

describe('positionToLayout', () => {
  it('기본값 bottom-left는 현재 동작(좌하단)과 동일하다', () => {
    expect(positionToLayout('bottom-left')).toEqual({
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      textAlign: 'left',
    })
  })

  it('top-right는 우상단으로 매핑된다', () => {
    expect(positionToLayout('top-right')).toEqual({
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      textAlign: 'right',
    })
  })

  it('middle-center는 정중앙으로 매핑된다', () => {
    expect(positionToLayout('middle-center')).toEqual({
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
    })
  })
})
