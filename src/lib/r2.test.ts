import { beforeEach, describe, expect, it } from 'vitest'

describe('keyFromUrl', () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
  })

  it('returns a bulletins key for the configured public origin', async () => {
    const { keyFromUrl } = await import('./r2')
    expect(keyFromUrl('https://cdn.example.com/assets/bulletins/file.hwp')).toBe('bulletins/file.hwp')
  })

  it('returns a gallery key for the configured public origin', async () => {
    const { keyFromUrl } = await import('./r2')
    expect(keyFromUrl('https://cdn.example.com/assets/gallery/photo.jpg')).toBe('gallery/photo.jpg')
  })

  it('rejects a matching path on a foreign origin', async () => {
    const { keyFromUrl } = await import('./r2')
    expect(keyFromUrl('https://evil.example.com/assets/gallery/photo.jpg')).toBe('')
  })

  it('rejects unknown prefixes on the configured public origin', async () => {
    const { keyFromUrl } = await import('./r2')
    expect(keyFromUrl('https://cdn.example.com/assets/secret/file.txt')).toBe('')
  })

  it('rejects empty input', async () => {
    const { keyFromUrl } = await import('./r2')
    expect(keyFromUrl('')).toBe('')
  })
})
