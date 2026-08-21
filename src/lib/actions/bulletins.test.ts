import { beforeEach, describe, expect, it, vi } from 'vitest'

// 서버 액션 모듈은 db·r2·auth를 끌고 오므로 경계를 전부 mock한다.
// 검증 대상은 "업로드된 실물이 확인되지 않은 키를 저장하지 않는다"는 규칙 자체다.
const headR2Object = vi.fn()
const deleteFromR2 = vi.fn()

vi.mock('@/lib/dal', () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } })),
}))

vi.mock('@/lib/logger', () => ({ log: vi.fn(async () => {}) }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/r2', () => ({
  bulletinPageKey: (date: string, uploadId: string, n: number, size: string, ext: string) =>
    `bulletins/${date}/${uploadId}/${n}-${size}.${ext}`,
  bulletinPdfKey: (date: string, uploadId: string) => `bulletins/${date}/${uploadId}/original.pdf`,
  presignBulletinPut: vi.fn(async (key: string) => `https://signed.example.com/${key}`),
  publicUrlForKey: (key: string) => `https://cdn.example.com/${key}`,
  keyFromUrl: (url: string) =>
    url.startsWith('https://cdn.example.com/') ? url.slice('https://cdn.example.com/'.length) : '',
  headR2Object: (...args: unknown[]) => headR2Object(...args),
  deleteFromR2: (...args: unknown[]) => deleteFromR2(...args),
}))

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/db/schema', () => ({ bulletins: {} }))

const page = {
  width: 1414,
  height: 2000,
  fullUrl: 'https://cdn.example.com/bulletins/2026-07-26/u1/1-full.webp',
  previewUrl: 'https://cdn.example.com/bulletins/2026-07-26/u1/1-preview.webp',
  thumbUrl: 'https://cdn.example.com/bulletins/2026-07-26/u1/1-thumb.webp',
}

beforeEach(() => {
  vi.clearAllMocks()
  headR2Object.mockResolvedValue({ size: 1000, contentType: 'image/webp' })
})

describe('prepareBulletinUpload', () => {
  it('면 수 × 3크기만큼 서명 URL을 발급한다', async () => {
    const { prepareBulletinUpload } = await import('./bulletins')
    const result = await prepareBulletinUpload({
      date: '2026-07-26',
      pageCount: 2,
      hasPdf: false,
      imageMime: 'image/webp',
    })
    expect(result.pages).toHaveLength(6)
    expect(result.pdf).toBeUndefined()
    expect(result.uploadId).toBeTruthy()
  })

  it('hasPdf면 PDF 서명 URL도 함께 준다', async () => {
    const { prepareBulletinUpload } = await import('./bulletins')
    const result = await prepareBulletinUpload({
      date: '2026-07-26',
      pageCount: 1,
      hasPdf: true,
      imageMime: 'image/webp',
    })
    expect(result.pdf?.publicUrl).toContain('original.pdf')
  })

  it('jpeg 폴백이면 키 확장자가 jpg가 된다', async () => {
    const { prepareBulletinUpload } = await import('./bulletins')
    const result = await prepareBulletinUpload({
      date: '2026-07-26',
      pageCount: 1,
      hasPdf: false,
      imageMime: 'image/jpeg',
    })
    expect(result.pages.every((p) => p.publicUrl.endsWith('.jpg'))).toBe(true)
  })

  it('면 수 상한을 넘으면 거부한다', async () => {
    const { maxBulletinPages } = await import('@/lib/bulletin-assets')
    const { prepareBulletinUpload } = await import('./bulletins')
    await expect(
      prepareBulletinUpload({
        date: '2026-07-26',
        pageCount: maxBulletinPages + 1,
        hasPdf: false,
        imageMime: 'image/webp',
      }),
    ).rejects.toThrow('면 수는')
  })

  it('날짜 형식이 틀리면 거부한다', async () => {
    const { prepareBulletinUpload } = await import('./bulletins')
    await expect(
      prepareBulletinUpload({ date: '2026/07/26', pageCount: 1, hasPdf: false, imageMime: 'image/webp' }),
    ).rejects.toThrow('bulletinDate is required')
  })
})

describe('assertBulletinAssets', () => {
  it('R2에 실물이 없으면 거부한다', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    headR2Object.mockResolvedValue(null)
    await expect(assertBulletinAssets([page], undefined)).rejects.toThrow('업로드된 파일을 찾을 수 없습니다')
  })

  it('우리 bulletins/ 키가 아닌 URL은 거부한다 — 임의 값 주입 차단', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    await expect(
      assertBulletinAssets([{ ...page, fullUrl: 'https://evil.example.com/x.webp' }], undefined),
    ).rejects.toThrow('invalid bulletin asset url')
  })

  it('gallery/ 키도 거부한다', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    await expect(
      assertBulletinAssets([{ ...page, thumbUrl: 'https://cdn.example.com/gallery/x.webp' }], undefined),
    ).rejects.toThrow('invalid bulletin asset url')
  })

  it('모든 키가 확인되면 통과한다', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    await expect(assertBulletinAssets([page], undefined)).resolves.toBeUndefined()
    expect(headR2Object).toHaveBeenCalledTimes(3)
  })

  it('pdfUrl이 있으면 그것도 확인한다', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    await assertBulletinAssets([page], 'https://cdn.example.com/bulletins/2026-07-26/u1/original.pdf')
    expect(headR2Object).toHaveBeenCalledTimes(4)
  })
})

describe('bulletinAssetKeys', () => {
  it('면 세 크기와 PDF 키를 모두 모은다 — 교체 시 정리 대상', async () => {
    const { bulletinAssetKeys } = await import('@/lib/bulletin-assets')
    const keys = bulletinAssetKeys([page], 'https://cdn.example.com/bulletins/2026-07-26/u1/original.pdf')
    expect(keys).toEqual([
      'bulletins/2026-07-26/u1/1-full.webp',
      'bulletins/2026-07-26/u1/1-preview.webp',
      'bulletins/2026-07-26/u1/1-thumb.webp',
      'bulletins/2026-07-26/u1/original.pdf',
    ])
  })

  it('우리 키가 아닌 URL은 제외한다', async () => {
    const { bulletinAssetKeys } = await import('@/lib/bulletin-assets')
    expect(bulletinAssetKeys([{ ...page, fullUrl: 'https://evil.example.com/x' }], undefined)).toHaveLength(2)
  })
})
