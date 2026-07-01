import { describe, expect, it } from 'vitest'
import { isTrackablePath } from './paths'

describe('isTrackablePath', () => {
  it('allows public content paths', () => {
    expect(isTrackablePath('/')).toBe(true)
    expect(isTrackablePath('/about/visit')).toBe(true)
    expect(isTrackablePath('/sermons/abc')).toBe(true)
  })

  it('blocks private and API paths', () => {
    expect(isTrackablePath('/admin')).toBe(false)
    expect(isTrackablePath('/admin/posts')).toBe(false)
    expect(isTrackablePath('/api/track')).toBe(false)
    expect(isTrackablePath('/sign-in')).toBe(false)
  })

  it('blocks framework and static asset paths', () => {
    expect(isTrackablePath('/_next/static/app.js')).toBe(false)
    expect(isTrackablePath('/favicon.ico')).toBe(false)
    expect(isTrackablePath('/brand/pck-icon-32.png')).toBe(false)
  })
})
