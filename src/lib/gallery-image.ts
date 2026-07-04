import 'server-only'

import sharp from 'sharp'
import { galleryImageKey, uploadToR2 } from '@/lib/r2'
import { sniffImageMime } from '@/lib/upload-sniff'

// 서버 액션(gallery.ts)과 병렬 업로드 API Route가 공유하는 이미지 처리 파이프라인
export const maxImageSize = 8 * 1024 * 1024

export async function processAndUploadImage(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  if (!sniffImageMime(buffer)) throw new Error('unsupported image file')
  const webp = await sharp(buffer)
    .rotate()
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer()
  return uploadToR2(webp, galleryImageKey(file.name), 'image/webp')
}
