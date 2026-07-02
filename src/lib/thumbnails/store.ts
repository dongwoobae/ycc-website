import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons, sermonThumbnails } from '@/lib/db/schema'
import { deleteFromR2, keyFromUrl, uploadToR2 } from '@/lib/r2'
import { toWebp } from './webp'
import type { ThumbnailCandidate, ThumbnailStyle, ThumbnailText } from './types'

// 후보(생성본)는 되돌리기용으로 최근 N건만 유지하고 초과분은 R2에서도 지운다.
export const MAX_THUMBNAIL_CANDIDATES = 3

function candidateKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/candidates/${sermonId}/${style}-${Date.now()}.webp`
}

function backgroundKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/backgrounds/${sermonId}/${style}-${Date.now()}.png`
}

function cutoutKey(sermonId: string): string {
  return `thumbnails/cutouts/${sermonId}-${Date.now()}.png`
}

// 교체가 끝난 뒤의 뒷정리라 삭제 실패가 저장 자체를 되돌릴 이유는 없다 — 경고만 남긴다.
async function deleteQuietly(url: string | null | undefined) {
  const key = keyFromUrl(url)
  if (!key) return
  try {
    await deleteFromR2(key)
  } catch (e) {
    console.warn(`[thumbnails] R2 삭제 실패 key=${key}`, e)
  }
}

/**
 * 생성한 배경 이미지를 R2에 올리고 sermon_thumbnails.thumbnailBackgrounds[style]에 URL을 저장한다.
 * 저장된 URL은 위치 재배치(reposition) 시 배경 재사용에 쓰인다. (위성 행 부재 시 upsert로 생성)
 * 같은 스타일의 이전 배경은 더 이상 참조되지 않으므로 R2에서 삭제한다.
 */
export async function storeBackground(
  sermonId: string,
  style: ThumbnailStyle,
  png: Buffer
): Promise<string> {
  const [existing] = await db
    .select({ backgrounds: sermonThumbnails.thumbnailBackgrounds })
    .from(sermonThumbnails)
    .where(eq(sermonThumbnails.sermonId, sermonId))
    .limit(1)
  const previousUrl = existing?.backgrounds?.[style]

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

  if (previousUrl && previousUrl !== url) await deleteQuietly(previousUrl)
  return url
}

/**
 * 스타일별 마지막 생성/적용 문구를 sermon_thumbnails.thumbnailTexts[style]에 저장한다.
 * 모달 재진입 시 프리필해 불필요한 Gemini 재호출을 줄인다. (위성 행 부재 시 upsert)
 */
export async function storeText(sermonId: string, style: ThumbnailStyle, text: ThumbnailText): Promise<void> {
  const updated = await db
    .insert(sermonThumbnails)
    .values({ sermonId, thumbnailTexts: { [style]: text } })
    .onConflictDoUpdate({
      target: sermonThumbnails.sermonId,
      set: {
        thumbnailTexts: sql`coalesce(${sermonThumbnails.thumbnailTexts}, '{}'::jsonb) || ${JSON.stringify(
          { [style]: text }
        )}::jsonb`,
      },
    })
    .returning({ id: sermonThumbnails.sermonId })
  if (updated.length === 0) throw new Error('sermon not found')
}

export async function storeCandidate(
  sermonId: string,
  style: ThumbnailStyle,
  png: Buffer
): Promise<ThumbnailCandidate> {
  // 공개 표시본(customThumbnailUrl)이라 webp로 변환해 서빙 용량을 줄인다.
  // (unoptimized 환경에서 원본 PNG가 그대로 내려가 느려지는 문제 대응)
  const webp = await toWebp(png)

  const [row] = await db
    .select({ candidates: sermonThumbnails.thumbnailCandidates })
    .from(sermons)
    .leftJoin(sermonThumbnails, eq(sermonThumbnails.sermonId, sermons.id))
    .where(eq(sermons.id, sermonId))
    .limit(1)
  if (!row) throw new Error('sermon not found')

  const url = await uploadToR2(webp, candidateKey(sermonId, style), 'image/webp')
  const candidate: ThumbnailCandidate = { style, url, createdAt: new Date().toISOString() }

  // append와 트림을 한 문장으로 처리해 동시 저장 간 lost update(스냅샷 교체로 남의
  // 신규 후보를 덮어쓰는 경합)를 막는다. 트림 결과는 returning으로 받아 삭제 판단에 쓴다.
  const appended = sql`coalesce(${sermonThumbnails.thumbnailCandidates}, '[]'::jsonb) || ${JSON.stringify([candidate])}::jsonb`
  const [updated] = await db
    .insert(sermonThumbnails)
    .values({ sermonId, thumbnailCandidates: [candidate] })
    .onConflictDoUpdate({
      target: sermonThumbnails.sermonId,
      set: {
        thumbnailCandidates: sql`(
          select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
          from jsonb_array_elements(${appended}) with ordinality as t(elem, ord)
          where ord > jsonb_array_length(${appended}) - ${MAX_THUMBNAIL_CANDIDATES}
        )`,
      },
    })
    .returning({ candidates: sermonThumbnails.thumbnailCandidates })

  // 트림으로 밀려난 파일 정리. 적용 썸네일은 삭제 직전에 최신값으로 재확인해,
  // 그 사이 다른 세션이 옛 후보를 되돌리기로 적용한 경우에도 지우지 않는다.
  const keptUrls = new Set((updated?.candidates ?? []).map((kept) => kept.url))
  const [fresh] = await db
    .select({ appliedUrl: sermons.customThumbnailUrl })
    .from(sermons)
    .where(eq(sermons.id, sermonId))
    .limit(1)
  for (const old of row.candidates ?? []) {
    if (keptUrls.has(old.url)) continue
    if (old.url === fresh?.appliedUrl) continue
    await deleteQuietly(old.url)
  }
  return candidate
}

/**
 * 누끼(투명 PNG)를 R2에 올리고 sermon_thumbnails.thumbnailCutoutUrl에 저장한다.
 * 유튜브 썸네일 파생이라 변하지 않으므로 1회 추출 후 재사용 캐시로 쓰인다.
 * 재추출 시 이전 누끼는 R2에서 삭제한다.
 */
export async function storeCutout(sermonId: string, png: Buffer): Promise<string> {
  const [existing] = await db
    .select({ cutoutUrl: sermonThumbnails.thumbnailCutoutUrl })
    .from(sermonThumbnails)
    .where(eq(sermonThumbnails.sermonId, sermonId))
    .limit(1)
  const previousUrl = existing?.cutoutUrl

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

  if (previousUrl && previousUrl !== url) await deleteQuietly(previousUrl)
  return url
}
