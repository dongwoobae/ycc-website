import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { cropAboveCaption } from './detect-caption-band'

const W = 200
const H = 200

/** 합성 이미지 생성: fill(y, x) → 0~255 그레이값 */
async function makeImage(fill: (y: number, x: number) => number): Promise<Buffer> {
  const data = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = fill(y, x)
      const i = (y * W + x) * 3
      data[i] = data[i + 1] = data[i + 2] = v
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer()
}

describe('cropAboveCaption', () => {
  it('하단에 고주파 자막 밴드가 있으면 그 위로 잘라낸다', async () => {
    // 상단 80%는 균일(저 edge), 하단 20%는 세로 줄무늬(고 edge=자막 텍스트 모사)
    const buf = await makeImage((y, x) => (y >= 160 ? (x % 2 === 0 ? 0 : 255) : 128))
    const { buffer, cropped } = await cropAboveCaption(buf)
    expect(cropped).toBe(true)
    const meta = await sharp(buffer).metadata()
    // 밴드 상단(160) 위로 잘려야 함: 원본 200보다 충분히 작고 인물영역은 남는다
    expect(meta.height).toBeLessThan(170)
    expect(meta.height).toBeGreaterThan(120)
    expect(meta.width).toBe(W)
  })

  it('자막 밴드가 없으면 원본을 그대로 반환한다', async () => {
    // 균일 회색: 가로 edge가 거의 없음 → 자막 미검출
    const buf = await makeImage(() => 128)
    const { buffer, cropped } = await cropAboveCaption(buf)
    expect(cropped).toBe(false)
    const meta = await sharp(buffer).metadata()
    expect(meta.height).toBe(H)
    expect(meta.width).toBe(W)
  })
})
