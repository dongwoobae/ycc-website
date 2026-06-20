import { describe, expect, it } from 'vitest'
import { normalizeOrigin } from './auth-origin'

describe('normalizeOrigin', () => {
  it('prepends https when no scheme is present', () => {
    expect(normalizeOrigin('example.vercel.app')).toBe('https://example.vercel.app')
  })

  it('does not double-prefix an existing scheme', () => {
    expect(normalizeOrigin('https://example.vercel.app')).toBe('https://example.vercel.app')
  })

  it('strips trailing slashes', () => {
    expect(normalizeOrigin('https://example.vercel.app///')).toBe('https://example.vercel.app')
  })

  it('collapses duplicate schemes', () => {
    expect(normalizeOrigin('https://https://example.vercel.app/')).toBe('https://example.vercel.app')
  })
})
