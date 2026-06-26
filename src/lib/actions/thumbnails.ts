'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { sermons, sermonSummaries, sermonThumbnails } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { composeThumbnailText } from '@/lib/thumbnails/compose-text'
import { generateBackground } from '@/lib/thumbnails/generate-background'
import { geminiBgKeywords } from '@/lib/thumbnails/bg-keywords'
import { geminiHeadline } from '@/lib/thumbnails/headline'
import { renderThumbnail, toDataUrl } from '@/lib/thumbnails/render'
import { removeBackground } from '@/lib/thumbnails/remove-background'
import { storeBackground, storeCandidate, storeCutout } from '@/lib/thumbnails/store'
import {
  DEFAULT_THUMBNAIL_COLORS,
  DEFAULT_THUMBNAIL_POSITION,
  isThumbnailPosition,
  type ThumbnailColors,
  type ThumbnailPosition,
  type ThumbnailRenderOptions,
  type ThumbnailStyle,
  type ThumbnailText,
} from '@/lib/thumbnails/types'

function coercePosition(position: ThumbnailPosition | undefined): ThumbnailPosition {
  return isThumbnailPosition(position) ? position : DEFAULT_THUMBNAIL_POSITION
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/
function coerceColors(colors: ThumbnailColors | undefined): ThumbnailColors {
  const pick = (value: string | undefined, fallback: string) =>
    typeof value === 'string' && HEX_RE.test(value) ? value : fallback
  return {
    headline: pick(colors?.headline, DEFAULT_THUMBNAIL_COLORS.headline),
    scripture: pick(colors?.scripture, DEFAULT_THUMBNAIL_COLORS.scripture),
  }
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
      summary: sermonSummaries.summary,
      quickSummary: sermonSummaries.quickSummary,
    })
    .from(sermons)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  return composeThumbnailText(style, row, geminiHeadline)
}

export interface GenerateThumbnailResult {
  backgroundUrl: string
  cutoutUrl?: string
}

/**
 * 배경 무드 키워드를 반환한다. DB에 캐시돼 있으면 재활용(재생성 시 Gemini 미호출),
 * 없으면 summary/quickSummary로 Gemini 1회 호출 후 DB에 저장한다.
 */
async function resolveBgKeywords(id: string): Promise<string> {
  const [row] = await db
    .select({
      bgKeywords: sermonThumbnails.thumbnailBgKeywords,
      summary: sermonSummaries.summary,
      quickSummary: sermonSummaries.quickSummary,
    })
    .from(sermons)
    .leftJoin(sermonThumbnails, eq(sermonThumbnails.sermonId, sermons.id))
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  if (row.bgKeywords?.trim()) return row.bgKeywords

  const keywords = await geminiBgKeywords({ summary: row.summary, quickSummary: row.quickSummary })
  await db
    .insert(sermonThumbnails)
    .values({ sermonId: id, thumbnailBgKeywords: keywords })
    .onConflictDoUpdate({ target: sermonThumbnails.sermonId, set: { thumbnailBgKeywords: keywords } })
  return keywords
}

/**
 * 인물 누끼 URL을 반환한다. 캐시(thumbnailCutoutUrl)가 있으면 재사용하고,
 * 없으면 유튜브 썸네일(sermons.thumbnailUrl)로 remove.bg를 1회 호출해 R2에 저장한다.
 * 썸네일이 없는 설교는 누끼 없이 진행(undefined).
 */
async function resolveCutout(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({
      cutoutUrl: sermonThumbnails.thumbnailCutoutUrl,
      thumbnailUrl: sermons.thumbnailUrl,
    })
    .from(sermons)
    .leftJoin(sermonThumbnails, eq(sermonThumbnails.sermonId, sermons.id))
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  if (row.cutoutUrl?.trim()) return row.cutoutUrl
  if (!row.thumbnailUrl) return undefined
  const png = await removeBackground(row.thumbnailUrl)
  return storeCutout(id, png)
}

/**
 * 배경 이미지를 생성·저장하고 그 URL을 반환한다(gpt-image-2 호출 → 비용 발생).
 * 텍스트 합성은 클라이언트 CSS 미리보기가 담당하고, PNG 저장은 적용 시점으로 미룬다.
 */
export async function generateThumbnailAction(
  id: string,
  style: ThumbnailStyle
): Promise<GenerateThumbnailResult> {
  const session = await requireAdmin()

  const keywords = await resolveBgKeywords(id)
  const background = await generateBackground(style, keywords)
  const backgroundUrl = await storeBackground(id, style, background)

  let cutoutUrl: string | undefined
  if (style === 'cutout') cutoutUrl = await resolveCutout(id)

  await log('create', 'sermon', id, `thumbnail:bg:${style}`, session.user.id)
  return { backgroundUrl, cutoutUrl }
}

/**
 * 저장된 배경을 재사용해 현재 문구·위치·색상으로 PNG를 합성·저장하고 설교 썸네일로 적용한다.
 * 배경이 아직 없으면(생성 이력 없음) 에러로 안내한다. (gpt-image-2 미호출 → 무비용)
 */
export async function composeAndApplyThumbnailAction(
  id: string,
  style: ThumbnailStyle,
  text: ThumbnailText,
  options: ThumbnailRenderOptions
): Promise<void> {
  const session = await requireAdmin()

  const [row] = await db
    .select({
      backgrounds: sermonThumbnails.thumbnailBackgrounds,
      cutoutUrl: sermonThumbnails.thumbnailCutoutUrl,
    })
    .from(sermonThumbnails)
    .where(eq(sermonThumbnails.sermonId, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  const backgroundUrl = row.backgrounds?.[style]
  if (!backgroundUrl) throw new Error('적용할 배경이 없습니다. 먼저 썸네일을 생성하세요.')

  const res = await fetch(backgroundUrl)
  if (!res.ok) throw new Error(`배경 이미지를 불러오지 못했습니다: ${res.status}`)
  const background = Buffer.from(await res.arrayBuffer())

  let cutoutDataUrl: string | undefined
  if (style === 'cutout' && row.cutoutUrl) {
    const cutoutRes = await fetch(row.cutoutUrl)
    if (!cutoutRes.ok) throw new Error(`누끼 이미지를 불러오지 못했습니다: ${cutoutRes.status}`)
    cutoutDataUrl = toDataUrl(Buffer.from(await cutoutRes.arrayBuffer()))
  }

  const png = await renderThumbnail({
    headline: text.headline,
    scripture: text.scripture,
    backgroundDataUrl: toDataUrl(background),
    cutoutDataUrl,
    position: coercePosition(options.position),
    colors: coerceColors(options.colors),
  })

  const candidate = await storeCandidate(id, style, png)
  await db.update(sermons).set({ customThumbnailUrl: candidate.url }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, `thumbnail:apply:${style}`, session.user.id)
  revalidate(id)
}

export async function resetThumbnailAction(id: string): Promise<void> {
  const session = await requireAdmin()
  await db.update(sermons).set({ customThumbnailUrl: null }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, 'thumbnail:reset', session.user.id)
  revalidate(id)
}
