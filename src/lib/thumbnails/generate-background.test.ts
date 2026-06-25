import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateBackground } from './generate-background'

describe('generateBackground', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete process.env.OPENAI_API_KEY
  })

  it('OPENAI_API_KEY 없으면 에러', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(generateBackground('classic')).rejects.toThrow('OPENAI_API_KEY')
  })

  it('b64 응답을 Buffer로 디코드한다', async () => {
    const b64 = Buffer.from('PNGDATA').toString('base64')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ b64_json: b64 }] }),
      })
    )
    const buf = await generateBackground('classic')
    expect(buf.toString()).toBe('PNGDATA')
  })

  it('API 실패 시 에러를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'server error',
      })
    )
    await expect(generateBackground('classic')).rejects.toThrow()
  })
})
