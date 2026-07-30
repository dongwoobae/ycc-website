import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeCanvas, maxBulletinFileSize, maxBulletinPages, validateOriginFile } from './bulletin-pdf'

describe('validateOriginFile', () => {
  it('40MB를 넘는 파일을 거부한다', () => {
    expect(validateOriginFile({ size: maxBulletinFileSize + 1, type: 'application/pdf' })).toBe(
      '파일이 너무 큽니다. 40MB 이하로 올려주세요.'
    )
  })

  it('PDF와 이미지를 허용한다', () => {
    expect(validateOriginFile({ size: 1000, type: 'application/pdf' })).toBeNull()
    expect(validateOriginFile({ size: 1000, type: 'image/png' })).toBeNull()
    expect(validateOriginFile({ size: 1000, type: 'image/jpeg' })).toBeNull()
  })

  it('그 외 형식을 거부한다', () => {
    expect(validateOriginFile({ size: 1000, type: 'application/x-hwp' })).toBe(
      'PDF 또는 이미지 파일만 올릴 수 있습니다.'
    )
  })
})

describe('maxBulletinPages', () => {
  it('12면이 상한이다', () => {
    expect(maxBulletinPages).toBe(12)
  })
})

describe('encodeCanvas', () => {
  function fakeCanvas(results: Record<string, Blob | null>) {
    return {
      toBlob: (callback: (blob: Blob | null) => void, mime: string) => callback(results[mime] ?? null),
    } as unknown as HTMLCanvasElement
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('webp 인코딩이 되면 webp로 준다', async () => {
    const webp = new Blob(['webp'], { type: 'image/webp' })
    const result = await encodeCanvas(fakeCanvas({ 'image/webp': webp }), 'image/webp')
    expect(result).toEqual({ blob: webp, mime: 'image/webp' })
  })

  it('webp가 null이면 jpeg로 폴백한다 — 구형 사파리 대응', async () => {
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' })
    const result = await encodeCanvas(fakeCanvas({ 'image/webp': null, 'image/jpeg': jpeg }), 'image/webp')
    expect(result).toEqual({ blob: jpeg, mime: 'image/jpeg' })
  })

  it('jpeg를 요청하면 webp를 시도하지 않는다', async () => {
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' })
    const canvas = fakeCanvas({ 'image/webp': new Blob(['x']), 'image/jpeg': jpeg })
    const result = await encodeCanvas(canvas, 'image/jpeg')
    expect(result.mime).toBe('image/jpeg')
  })

  it('둘 다 실패하면 던진다', async () => {
    await expect(encodeCanvas(fakeCanvas({}), 'image/webp')).rejects.toThrow(
      '이미지 변환에 실패했습니다'
    )
  })
})
