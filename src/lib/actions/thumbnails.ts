'use server'

// 인물컷형(cutout) 누끼 기능 정식 활성화 — 옛 가드 제거됨. (빌드 캐시 무효화용 마커)
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { sermons, sermonSummaries, sermonThumbnails } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { revalidateSermonPaths } from '@/lib/sermons/revalidate'
import { composeThumbnailText } from '@/lib/thumbnails/compose-text'
import { generateThumbnail, type GenerateThumbnailResult } from '@/lib/thumbnails/generate'
import { geminiHeadline } from '@/lib/thumbnails/headline'
import { renderThumbnail, toDataUrl } from '@/lib/thumbnails/render'
import { storeCandidate } from '@/lib/thumbnails/store'
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

/**
 * 배경 이미지를 생성·저장하고 그 URL을 반환한다(gpt-image-2 호출 → 비용 발생).
 * 실시간 진행률이 필요한 경우 SSE 라우트(`/api/admin/sermons/[id]/thumbnail/stream`)를
 * 쓰고, 이 액션은 진행률이 불필요한 호출부의 폴백으로 유지한다.
 */
export async function generateThumbnailAction(
  id: string,
  style: ThumbnailStyle
): Promise<GenerateThumbnailResult> {
  const session = await requireAdmin()
  const result = await generateThumbnail(id, style)
  await log('create', 'sermon', id, `thumbnail:bg:${style}`, session.user.id)
  return result
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
  revalidateSermonPaths(id)
}

export async function resetThumbnailAction(id: string): Promise<void> {
  const session = await requireAdmin()
  await db.update(sermons).set({ customThumbnailUrl: null }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, 'thumbnail:reset', session.user.id)
  revalidateSermonPaths(id)
}
