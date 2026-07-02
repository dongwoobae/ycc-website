import { beforeEach, describe, expect, it } from 'vitest'

describe('toArrayBufferBacked', () => {
  // r2.ts 는 모듈 로드 시점에 env 를 읽으므로 첫 import 전에 설정해 둔다.
  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
  })

  it('SharedArrayBuffer 기반 버퍼는 일반 ArrayBuffer 기반으로 복사한다', async () => {
    const { toArrayBufferBacked } = await import('./r2')
    const shared = Buffer.from(new SharedArrayBuffer(8))
    shared.set([1, 2, 3, 4, 5, 6, 7, 8])

    const result = toArrayBufferBacked(shared)

    expect(result.buffer instanceof SharedArrayBuffer).toBe(false)
    expect(Buffer.compare(result, shared)).toBe(0)
  })

  it('일반 버퍼는 복사 없이 그대로 반환한다', async () => {
    const { toArrayBufferBacked } = await import('./r2')
    const plain = Buffer.from([1, 2, 3])
    expect(toArrayBufferBacked(plain)).toBe(plain)
  })
})

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
