'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { composeThumbnailText } from '@/lib/thumbnails/compose-text'
import { generateBackground } from '@/lib/thumbnails/generate-background'
import { geminiBgKeywords } from '@/lib/thumbnails/bg-keywords'
import { geminiHeadline } from '@/lib/thumbnails/headline'
import { renderThumbnail, toDataUrl } from '@/lib/thumbnails/render'
import { storeBackground, storeCandidate } from '@/lib/thumbnails/store'
import {
  DEFAULT_THUMBNAIL_POSITION,
  isThumbnailPosition,
  type ThumbnailCandidate,
  type ThumbnailPosition,
  type ThumbnailStyle,
  type ThumbnailText,
} from '@/lib/thumbnails/types'

function coercePosition(position: ThumbnailPosition | undefined): ThumbnailPosition {
  return isThumbnailPosition(position) ? position : DEFAULT_THUMBNAIL_POSITION
}

function revalidate(id: string) {
  revalidatePath('/')
  revalidatePath('/sermons')
  revalidatePath(`/sermons/${id}`)
  revalidatePath('/admin/sermons')
  revalidatePath(`/admin/sermons/${id}/edit`)
}

export async function suggestThumbnailTextAction(id: string, style: ThumbnailStyle): Promise<ThumbnailText> {
  await requireAdmin()
  const [row] = await db
    .select({
      title: sermons.title,
      displayTitle: sermons.displayTitle,
      summary: sermons.summary,
      quickSummary: sermons.quickSummary,
    })
    .from(sermons)
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  return composeThumbnailText(style, row, geminiHeadline)
}

export interface GenerateThumbnailResult {
  candidate: ThumbnailCandidate
}

/**
 * 배경 무드 키워드를 반환한다. DB에 캐시돼 있으면 재활용(재생성 시 Gemini 미호출),
 * 없으면 summary/quickSummary로 Gemini 1회 호출 후 DB에 저장한다.
 */
async function resolveBgKeywords(id: string): Promise<string> {
  const [row] = await db
    .select({
      bgKeywords: sermons.thumbnailBgKeywords,
      summary: sermons.summary,
      quickSummary: sermons.quickSummary,
    })
    .from(sermons)
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  if (row.bgKeywords?.trim()) return row.bgKeywords

  const keywords = await geminiBgKeywords({ summary: row.summary, quickSummary: row.quickSummary })
  await db.update(sermons).set({ thumbnailBgKeywords: keywords }).where(eq(sermons.id, id))
  return keywords
}

export async function generateThumbnailAction(
  id: string,
  style: ThumbnailStyle,
  text: ThumbnailText,
  position?: ThumbnailPosition
): Promise<GenerateThumbnailResult> {
  const session = await requireAdmin()
  if (style === 'cutout') throw new Error('인물컷형 누끼 생성은 다음 단계에서 지원됩니다')

  const keywords = await resolveBgKeywords(id)
  const background = await generateBackground(style, keywords)
  await storeBackground(id, style, background)
  const png = await renderThumbnail({
    headline: text.headline,
    scripture: text.scripture,
    backgroundDataUrl: toDataUrl(background),
    position: coercePosition(position),
  })

  const candidate = await storeCandidate(id, style, png)
  await log('create', 'sermon', id, `thumbnail:${style}`, session.user.id)
  revalidate(id)
  return { candidate }
}

/**
 * 저장된 배경을 재사용해 텍스트만 새 위치로 재합성한다(gpt-image-2 미호출 → 무비용).
 * 배경이 아직 없으면(생성 이력 없음) 에러로 안내한다.
 */
export async function repositionThumbnailAction(
  id: string,
  style: ThumbnailStyle,
  text: ThumbnailText,
  position: ThumbnailPosition
): Promise<GenerateThumbnailResult> {
  const session = await requireAdmin()
  if (style === 'cutout') throw new Error('인물컷형 누끼 생성은 다음 단계에서 지원됩니다')

  const [row] = await db
    .select({ backgrounds: sermons.thumbnailBackgrounds })
    .from(sermons)
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  const backgroundUrl = row.backgrounds?.[style]
  if (!backgroundUrl) throw new Error('재배치할 배경이 없습니다. 먼저 썸네일을 생성하세요.')

  const res = await fetch(backgroundUrl)
  if (!res.ok) throw new Error(`배경 이미지를 불러오지 못했습니다: ${res.status}`)
  const background = Buffer.from(await res.arrayBuffer())

  const png = await renderThumbnail({
    headline: text.headline,
    scripture: text.scripture,
    backgroundDataUrl: toDataUrl(background),
    position: coercePosition(position),
  })

  const candidate = await storeCandidate(id, style, png)
  await log('update', 'sermon', id, `thumbnail:reposition:${style}`, session.user.id)
  revalidate(id)
  return { candidate }
}

export async function applyThumbnailAction(id: string, url: string): Promise<void> {
  const session = await requireAdmin()

  const [row] = await db
    .select({ candidates: sermons.thumbnailCandidates })
    .from(sermons)
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  const allowed = (row.candidates ?? []).some((candidate) => candidate.url === url)
  if (!allowed) throw new Error('이 설교의 생성된 후보 URL만 적용할 수 있습니다')

  await db.update(sermons).set({ customThumbnailUrl: url }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, 'thumbnail:apply', session.user.id)
  revalidate(id)
}

export async function resetThumbnailAction(id: string): Promise<void> {
  const session = await requireAdmin()
  await db.update(sermons).set({ customThumbnailUrl: null }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, 'thumbnail:reset', session.user.id)
  revalidate(id)
}
