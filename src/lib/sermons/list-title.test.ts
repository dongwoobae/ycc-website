import { describe, expect, it } from 'vitest'
import { cleanSermonTitle, sermonListTitle } from './list-title'

describe('cleanSermonTitle', () => {
  it('keeps text after the first slash', () => {
    expect(cleanSermonTitle('영천중앙교회 260617 수요예배 / [공공성] 공공성은 언어')).toBe('[공공성] 공공성은 언어')
  })
  it('returns full title when no slash', () => {
    expect(cleanSermonTitle('영천중앙교회 260614 1여전되회 특송')).toBe('영천중앙교회 260614 1여전되회 특송')
  })
})

describe('sermonListTitle', () => {
  it('prefers displayTitle override', () => {
    expect(sermonListTitle({ title: '영천중앙교회 / 원본', displayTitle: '표시제목' })).toBe('표시제목')
  })
  it('falls back to cleaned title when no override', () => {
    expect(sermonListTitle({ title: '영천중앙교회 260621 주일예배 / 채우심', displayTitle: null })).toBe('채우심')
  })
})
