export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
export type UploadMime = ImageMime | 'application/pdf'

// "%PDF-" — 버전 숫자 앞의 하이픈까지 봐야 "%PDF"로 시작하는 다른 텍스트를 배제할 수 있다.
const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d] as const

function hasBytes(buffer: Buffer, offset: number, bytes: readonly number[]) {
  if (buffer.length < offset + bytes.length) return false
  return bytes.every((byte, index) => buffer[offset + index] === byte)
}

export function sniffImageMime(buffer: Buffer): ImageMime | null {
  if (hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (hasBytes(buffer, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return 'image/gif'
  if (hasBytes(buffer, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'image/gif'
  if (hasBytes(buffer, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(buffer, 8, [0x57, 0x45, 0x42, 0x50])) {
    return 'image/webp'
  }
  return null
}

export function sniffPdfMime(buffer: Buffer): 'application/pdf' | null {
  return hasBytes(buffer, 0, pdfMagic) ? 'application/pdf' : null
}

export function isAllowedUploadMime(contentType: string): contentType is UploadMime {
  return (
    contentType === 'image/png' ||
    contentType === 'image/jpeg' ||
    contentType === 'image/webp' ||
    contentType === 'image/gif' ||
    contentType === 'application/pdf'
  )
}
