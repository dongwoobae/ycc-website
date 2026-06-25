import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { uploadToR2 } from '@/lib/r2'
import type { ThumbnailCandidate, ThumbnailStyle } from './types'

function candidateKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/candidates/${sermonId}/${style}-${Date.now()}.png`
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
