import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermonThumbnails } from '@/lib/db/schema'
import { uploadToR2 } from '@/lib/r2'
import type { ThumbnailCandidate, ThumbnailStyle } from './types'

function candidateKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/candidates/${sermonId}/${style}-${Date.now()}.png`
}

function backgroundKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/backgrounds/${sermonId}/${style}-${Date.now()}.png`
}

/**
 * 생성한 배경 이미지를 R2에 올리고 sermon_thumbnails.thumbnailBackgrounds[style]에 URL을 저장한다.
 * 저장된 URL은 위치 재배치(reposition) 시 배경 재사용에 쓰인다. (위성 행 부재 시 upsert로 생성)
 */
export async function storeBackground(
  sermonId: string,
  style: ThumbnailStyle,
  png: Buffer
): Promise<string> {
  const url = await uploadToR2(png, backgroundKey(sermonId, style), 'image/png')
  const updated = await db
    .insert(sermonThumbnails)
    .values({ sermonId, thumbnailBackgrounds: { [style]: url } })
    .onConflictDoUpdate({
      target: sermonThumbnails.sermonId,
      set: {
        thumbnailBackgrounds: sql`coalesce(${sermonThumbnails.thumbnailBackgrounds}, '{}'::jsonb) || ${JSON.stringify(
          { [style]: url }
        )}::jsonb`,
      },
    })
    .returning({ id: sermonThumbnails.sermonId })
  if (updated.length === 0) throw new Error('sermon not found')
  return url
}

export async function storeCandidate(
  sermonId: string,
  style: ThumbnailStyle,
  png: Buffer
): Promise<ThumbnailCandidate> {
  const url = await uploadToR2(png, candidateKey(sermonId, style), 'image/png')
  const candidate: ThumbnailCandidate = { style, url, createdAt: new Date().toISOString() }

  const updated = await db
    .insert(sermonThumbnails)
    .values({ sermonId, thumbnailCandidates: [candidate] })
    .onConflictDoUpdate({
      target: sermonThumbnails.sermonId,
      set: {
        thumbnailCandidates: sql`coalesce(${sermonThumbnails.thumbnailCandidates}, '[]'::jsonb) || ${JSON.stringify([candidate])}::jsonb`,
      },
    })
    .returning({ id: sermonThumbnails.sermonId })
  if (updated.length === 0) throw new Error('sermon not found')
  return candidate
}
