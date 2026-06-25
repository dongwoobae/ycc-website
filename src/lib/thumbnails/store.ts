import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { uploadToR2 } from '@/lib/r2'
import type { ThumbnailCandidate, ThumbnailStyle } from './types'

function candidateKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/candidates/${sermonId}/${style}-${Date.now()}.png`
}

function backgroundKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/backgrounds/${sermonId}/${style}-${Date.now()}.png`
}

/**
 * 생성한 배경 이미지를 R2에 올리고 sermons.thumbnailBackgrounds[style]에 URL을 저장한다.
 * 저장된 URL은 위치 재배치(reposition) 시 배경 재사용에 쓰인다.
 */
export async function storeBackground(
  sermonId: string,
  style: ThumbnailStyle,
  png: Buffer
): Promise<string> {
  const url = await uploadToR2(png, backgroundKey(sermonId, style), 'image/png')
  const updated = await db
    .update(sermons)
    .set({
      thumbnailBackgrounds: sql`coalesce(${sermons.thumbnailBackgrounds}, '{}'::jsonb) || ${JSON.stringify(
        { [style]: url }
      )}::jsonb`,
    })
    .where(eq(sermons.id, sermonId))
    .returning({ id: sermons.id })
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
    .update(sermons)
    .set({
      thumbnailCandidates: sql`coalesce(${sermons.thumbnailCandidates}, '[]'::jsonb) || ${JSON.stringify([candidate])}::jsonb`,
    })
    .where(eq(sermons.id, sermonId))
    .returning({ id: sermons.id })
  if (updated.length === 0) throw new Error('sermon not found')
  return candidate
}
