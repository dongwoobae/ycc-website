import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermonThumbnails } from '@/lib/db/schema'
import { uploadToR2 } from '@/lib/r2'
import { toWebp } from './webp'
import type { ThumbnailCandidate, ThumbnailStyle } from './types'

function candidateKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/candidates/${sermonId}/${style}-${Date.now()}.webp`
}

function backgroundKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/backgrounds/${sermonId}/${style}-${Date.now()}.png`
}

function cutoutKey(sermonId: string): string {
  return `thumbnails/cutouts/${sermonId}-${Date.now()}.png`
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
  // 공개 표시본(customThumbnailUrl)이라 webp로 변환해 서빙 용량을 줄인다.
  // (unoptimized 환경에서 원본 PNG가 그대로 내려가 느려지는 문제 대응)
  const webp = await toWebp(png)
  const url = await uploadToR2(webp, candidateKey(sermonId, style), 'image/webp')
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

/**
 * 누끼(투명 PNG)를 R2에 올리고 sermon_thumbnails.thumbnailCutoutUrl에 저장한다.
 * 유튜브 썸네일 파생이라 변하지 않으므로 1회 추출 후 재사용 캐시로 쓰인다.
 */
export async function storeCutout(sermonId: string, png: Buffer): Promise<string> {
  const url = await uploadToR2(png, cutoutKey(sermonId), 'image/png')
  const updated = await db
    .insert(sermonThumbnails)
    .values({ sermonId, thumbnailCutoutUrl: url })
    .onConflictDoUpdate({
      target: sermonThumbnails.sermonId,
      set: { thumbnailCutoutUrl: url },
    })
    .returning({ id: sermonThumbnails.sermonId })
  if (updated.length === 0) throw new Error('sermon not found')
  return url
}
