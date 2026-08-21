import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    expect(keyFromUrl('https://cdn.example.com/assets/bulletins/2026-07-26/x/1-full.webp')).toBe(
      'bulletins/2026-07-26/x/1-full.webp',
    )
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

describe('galleryVideoKey / publicUrlForKey', () => {
  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
  })

  it('gallery/ prefix + uuid + 정제된 이름 + 확장자로 키를 만든다', async () => {
    const { galleryVideoKey } = await import('./r2')
    const key = galleryVideoKey('내 영상 (1).MOV', 'mov')
    expect(key).toMatch(/^gallery\/[0-9a-f-]{36}-[\w.\-]+\.mov$/)
    expect(key.endsWith('.mov')).toBe(true)
  })

  it('원본 확장자는 버리고 전달받은 ext를 쓴다', async () => {
    const { galleryVideoKey } = await import('./r2')
    expect(galleryVideoKey('clip.webm', 'mp4')).toMatch(/\.mp4$/)
  })

  it('publicUrlForKey는 공개 URL을 조립한다', async () => {
    const { publicUrlForKey } = await import('./r2')
    expect(publicUrlForKey('gallery/abc.mp4')).toBe('https://cdn.example.com/assets/gallery/abc.mp4')
  })
})

describe('presignGalleryVideoPut', () => {
  beforeEach(() => {
    // r2.ts는 모듈 로드 시점에 env를 상수로 캡처한다. 이 파일의 앞선 describe들이
    // R2_PUBLIC_URL만 설정한 채 이미 './r2'를 import해 모듈이 캐시돼 있으므로,
    // 여기서 새로 필요한 자격증명 env들은 리셋 없이는 반영되지 않는다.
    vi.resetModules()
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'
  })

  // "Content-Type이 서명에 포함되어 임의 타입 업로드를 막는다"는 설계 전제를
  // 가정이 아니라 검증된 불변식으로 만든다 (getSignedUrl은 오프라인 서명 계산).
  it('Content-Type이 X-Amz-SignedHeaders에 포함된다', async () => {
    const { presignGalleryVideoPut } = await import('./r2')
    const url = await presignGalleryVideoPut('gallery/test.mp4', 'video/mp4')
    const signedHeaders = new URL(url).searchParams.get('X-Amz-SignedHeaders') ?? ''
    expect(signedHeaders.split(';')).toContain('content-type')
  })

  it('gallery/ 밖 키는 거부한다', async () => {
    const { presignGalleryVideoPut } = await import('./r2')
    await expect(presignGalleryVideoPut('bulletins/evil.mp4', 'video/mp4')).rejects.toThrow('invalid key prefix')
  })
})

describe('bulletin keys', () => {
  const uploadId = '0189d3f0-1111-4222-8333-444455556666'

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
  })

  it('면 이미지 키에 날짜·업로드id·면번호·크기가 들어간다', async () => {
    const { bulletinPageKey } = await import('./r2')
    expect(bulletinPageKey('2026-07-26', uploadId, 1, 'full', 'webp')).toBe(
      `bulletins/2026-07-26/${uploadId}/1-full.webp`,
    )
    expect(bulletinPageKey('2026-07-26', uploadId, 12, 'thumb', 'jpg')).toBe(
      `bulletins/2026-07-26/${uploadId}/12-thumb.jpg`,
    )
  })

  it('원본 PDF 키는 업로드 폴더 아래 original.pdf 다', async () => {
    const { bulletinPdfKey } = await import('./r2')
    expect(bulletinPdfKey('2026-07-26', uploadId)).toBe(`bulletins/2026-07-26/${uploadId}/original.pdf`)
  })

  it('날짜 형식이 틀리면 던진다 — 경로 조작 차단', async () => {
    const { bulletinPdfKey } = await import('./r2')
    expect(() => bulletinPdfKey('2026-7-26', uploadId)).toThrow('invalid bulletin date')
    expect(() => bulletinPdfKey('../../etc', uploadId)).toThrow('invalid bulletin date')
  })

  it('업로드 id가 uuid 형식이 아니면 던진다', async () => {
    const { bulletinPdfKey } = await import('./r2')
    expect(() => bulletinPdfKey('2026-07-26', '../evil')).toThrow('invalid upload id')
  })

  it('면 번호가 1 이상 정수가 아니면 던진다', async () => {
    const { bulletinPageKey } = await import('./r2')
    expect(() => bulletinPageKey('2026-07-26', uploadId, 0, 'full', 'webp')).toThrow('invalid page number')
    expect(() => bulletinPageKey('2026-07-26', uploadId, 1.5, 'full', 'webp')).toThrow('invalid page number')
  })

  it('bulletinHwpKey는 더 이상 존재하지 않는다', async () => {
    const r2 = await import('./r2')
    expect('bulletinHwpKey' in r2).toBe(false)
  })
})

describe('presignBulletinPut', () => {
  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = 'acc'
    process.env.R2_ACCESS_KEY_ID = 'key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_BUCKET_NAME = 'bucket'
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
    vi.resetModules()
  })

  it('bulletins/ 이외의 프리픽스를 거부한다', async () => {
    const { presignBulletinPut } = await import('./r2')
    await expect(presignBulletinPut('gallery/evil.webp', 'image/webp')).rejects.toThrow('invalid key prefix')
  })

  it('bulletins/ 키에는 서명 URL을 발급한다', async () => {
    const { presignBulletinPut } = await import('./r2')
    const url = await presignBulletinPut('bulletins/2026-07-26/x/1-full.webp', 'image/webp')
    expect(url).toContain('bulletins/2026-07-26/x/1-full.webp')
  })
})
