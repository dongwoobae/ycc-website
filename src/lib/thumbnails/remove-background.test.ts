import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { removeBackground } from './remove-background'

const SRC_URL = 'https://img.youtube.com/vi/abc/hqdefault.jpg'

/** 작은 실제 PNG (자막 없음) — cropAboveCaption 이 sharp 로 파싱할 수 있어야 한다 */
async function makeSourcePng(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 128, g: 128, b: 128 } } })
    .png()
    .toBuffer()
}

/** url 로 분기하는 fetch 목 (원본 vs remove.bg) */
function stubFetch(opts: { source: Buffer; removebg: { ok: boolean; status?: number; body?: string } }) {
  return vi.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('remove.bg')) {
      const r = opts.removebg
      return {
        ok: r.ok,
        status: r.status ?? 200,
        arrayBuffer: async () => new TextEncoder().encode(r.body ?? 'CUTOUT'),
        text: async () => r.body ?? '',
      }
    }
    return { ok: true, status: 200, arrayBuffer: async () => opts.source }
  })
}

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
    await expect(removeBackground(SRC_URL)).rejects.toThrow('REMOVE_BG_API_KEY')
  })

  it('원본을 먼저 받아 자막 제거 후 remove.bg 결과 Buffer를 반환한다', async () => {
    const source = await makeSourcePng()
    const fetchMock = stubFetch({ source, removebg: { ok: true, body: 'CUTOUT' } })
    vi.stubGlobal('fetch', fetchMock)

    const buf = await removeBackground(SRC_URL)

    expect(buf.toString()).toBe('CUTOUT')
    // 원본 URL을 직접 fetch 해야 한다(자막 crop 전처리를 위해)
    expect(fetchMock).toHaveBeenCalledWith(SRC_URL)
  })

  it('remove.bg 실패 시 에러를 던진다', async () => {
    const source = await makeSourcePng()
    vi.stubGlobal('fetch', stubFetch({ source, removebg: { ok: false, status: 402, body: 'insufficient credits' } }))
    await expect(removeBackground(SRC_URL)).rejects.toThrow()
  })
})
