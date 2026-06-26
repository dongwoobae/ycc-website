import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { removeBackground } from './remove-background'

describe('removeBackground', () => {
  beforeEach(() => {
    process.env.REMOVE_BG_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete process.env.REMOVE_BG_API_KEY
  })

  it('REMOVE_BG_API_KEY 없으면 에러', async () => {
    delete process.env.REMOVE_BG_API_KEY
    await expect(removeBackground('https://x/y.jpg')).rejects.toThrow('REMOVE_BG_API_KEY')
  })

  it('200 응답을 Buffer로 반환한다', async () => {
    const bytes = new TextEncoder().encode('PNGDATA')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => bytes.buffer,
      })
    )
    const buf = await removeBackground('https://x/y.jpg')
    expect(buf.toString()).toBe('PNGDATA')
  })

  it('API 실패 시 에러를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'insufficient credits',
      })
    )
    await expect(removeBackground('https://x/y.jpg')).rejects.toThrow()
  })
})
