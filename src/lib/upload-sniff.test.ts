import { describe, expect, it } from 'vitest'
import { isAllowedUploadMime, sniffImageMime, sniffPdfMime } from './upload-sniff'

function bytes(...values: number[]) {
  return Buffer.from(values)
}

describe('sniffImageMime', () => {
  it('PNG 매직을 인식한다', () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
  })

  it('JPEG 매직을 인식한다', () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
  })

  it('WebP 매직을 인식한다', () => {
    expect(sniffImageMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp')
  })

  it('알 수 없는 바이트는 null', () => {
    expect(sniffImageMime(bytes(0x00, 0x01, 0x02))).toBeNull()
  })
})

describe('sniffPdfMime', () => {
  it('%PDF- 로 시작하면 인식한다', () => {
    expect(sniffPdfMime(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf')
  })

  it('%PDF 뒤 하이픈이 없으면 거부한다', () => {
    expect(sniffPdfMime(Buffer.from('%PDF1.7'))).toBeNull()
  })

  it('앞에 다른 바이트가 붙으면 거부한다 — 오프셋 0만 본다', () => {
    expect(sniffPdfMime(Buffer.from('x%PDF-1.7'))).toBeNull()
  })

  it('구 HWP(CFB/OLE) 매직은 거부한다', () => {
    expect(sniffPdfMime(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBeNull()
  })

  it('너무 짧은 버퍼는 거부한다', () => {
    expect(sniffPdfMime(bytes(0x25, 0x50))).toBeNull()
  })
})

describe('isAllowedUploadMime', () => {
  it('이미지 타입을 허용한다', () => {
    expect(isAllowedUploadMime('image/png')).toBe(true)
    expect(isAllowedUploadMime('image/webp')).toBe(true)
  })

  it('PDF를 허용한다', () => {
    expect(isAllowedUploadMime('application/pdf')).toBe(true)
  })

  it('HWP는 더 이상 허용하지 않는다', () => {
    expect(isAllowedUploadMime('application/x-hwp')).toBe(false)
  })

  it('SVG와 HTML은 거부한다', () => {
    expect(isAllowedUploadMime('image/svg+xml')).toBe(false)
    expect(isAllowedUploadMime('text/html')).toBe(false)
  })
})
