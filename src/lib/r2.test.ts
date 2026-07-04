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
