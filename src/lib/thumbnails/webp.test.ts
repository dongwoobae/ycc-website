import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { toWebp } from './webp'

async function samplePng(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 36, channels: 3, background: { r: 120, g: 80, b: 40 } },
  })
    .png()
    .toBuffer()
}

describe('toWebp', () => {
  it('PNG 버퍼를 webp로 변환한다', async () => {
    const png = await samplePng()
    const webp = await toWebp(png)
    const meta = await sharp(webp).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(64)
    expect(meta.height).toBe(36)
  })

  it('변환 결과는 비어있지 않다', async () => {
    const webp = await toWebp(await samplePng())
    expect(webp.length).toBeGreaterThan(0)
  })
})
