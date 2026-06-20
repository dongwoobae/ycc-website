import { describe, expect, it } from 'vitest'
import { isAllowedUploadMime, sniffHwpMime, sniffImageMime } from './upload-sniff'

describe('sniffImageMime', () => {
  it('detects png by magic bytes', () => {
    expect(sniffImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
  })

  it('detects jpeg by magic bytes', () => {
    expect(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
  })

  it('detects webp by riff/webp magic bytes', () => {
    expect(sniffImageMime(Buffer.from('RIFFxxxxWEBPVP8 ', 'ascii'))).toBe('image/webp')
  })

  it('detects gif87a and gif89a by magic bytes', () => {
    expect(sniffImageMime(Buffer.from('GIF87a', 'ascii'))).toBe('image/gif')
    expect(sniffImageMime(Buffer.from('GIF89a', 'ascii'))).toBe('image/gif')
  })

  it('rejects spoofed text as an image', () => {
    expect(sniffImageMime(Buffer.from('<script>alert(1)</script>', 'utf8'))).toBeNull()
  })
})

describe('sniffHwpMime', () => {
  it('detects cfb/ole containers used by hwp files', () => {
    expect(sniffHwpMime(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe('application/x-hwp')
  })

  it('rejects non-cfb content', () => {
    expect(sniffHwpMime(Buffer.from('not hwp', 'utf8'))).toBeNull()
  })
})

describe('isAllowedUploadMime', () => {
  it('allows only server-supported upload content types', () => {
    expect(isAllowedUploadMime('image/png')).toBe(true)
    expect(isAllowedUploadMime('image/svg+xml')).toBe(false)
    expect(isAllowedUploadMime('text/html')).toBe(false)
  })
})
