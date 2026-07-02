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
import { storeCandidate, storeText } from '@/lib/thumbnails/store'
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

// 프로덕션에선 서버액션이 throw 한 메시지가 마스킹되므로, 사용자에게 보여줄 예상 가능한
// 실패는 반환값으로 전달한다. 예상 밖 에러는 그대로 throw 해 서버 로그(digest)에 남긴다.
export type ThumbnailActionResult = { ok: true } | { ok: false; error: string }
export type ThumbnailTextResult = { ok: true; text: ThumbnailText } | { ok: false; error: string }

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

export async function suggestThumbnailTextAction(id: string, style: ThumbnailStyle): Promise<ThumbnailTextResult> {
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
  if (!row) return { ok: false, error: '설교를 찾을 수 없습니다.' }
  try {
    const text = await composeThumbnailText(style, row, geminiHeadline)
    await storeText(id, style, text)
    return { ok: true, text }
  } catch (e) {
    console.error('[thumbnails] 문구 생성 실패', e)
    return { ok: false, error: '문구 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }
  }
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
): Promise<ThumbnailActionResult> {
  const session = await requireAdmin()

  const [row] = await db
    .select({
      backgrounds: sermonThumbnails.thumbnailBackgrounds,
      cutoutUrl: sermonThumbnails.thumbnailCutoutUrl,
    })
    .from(sermonThumbnails)
    .where(eq(sermonThumbnails.sermonId, id))
    .limit(1)
  if (!row) return { ok: false, error: '설교를 찾을 수 없습니다.' }
  const backgroundUrl = row.backgrounds?.[style]
  if (!backgroundUrl) return { ok: false, error: '적용할 배경이 없습니다. 먼저 썸네일을 생성하세요.' }

  const res = await fetch(backgroundUrl)
  if (!res.ok) return { ok: false, error: `배경 이미지를 불러오지 못했습니다: ${res.status}` }
  const background = Buffer.from(await res.arrayBuffer())

  let cutoutDataUrl: string | undefined
  if (style === 'cutout' && row.cutoutUrl) {
    const cutoutRes = await fetch(row.cutoutUrl)
    if (!cutoutRes.ok) return { ok: false, error: `누끼 이미지를 불러오지 못했습니다: ${cutoutRes.status}` }
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
  // 적용에 쓴 최종 문구(직접 수정분 포함)를 저장해 다음 모달 진입 시 프리필한다.
  await storeText(id, style, { headline: text.headline, scripture: text.scripture })
  await log('update', 'sermon', id, `thumbnail:apply:${style}`, session.user.id)
  revalidateSermonPaths(id)
  return { ok: true }
}

/**
 * 최근 생성본(후보) 중 하나를 설교 썸네일로 재적용한다. (재합성·AI 호출 없음 → 무비용)
 */
export async function applyCandidateThumbnailAction(id: string, url: string): Promise<ThumbnailActionResult> {
  const session = await requireAdmin()
  const [row] = await db
    .select({ candidates: sermonThumbnails.thumbnailCandidates })
    .from(sermonThumbnails)
    .where(eq(sermonThumbnails.sermonId, id))
    .limit(1)
  if (!row) return { ok: false, error: '설교를 찾을 수 없습니다.' }
  if (!row.candidates?.some((candidate) => candidate.url === url))
    return { ok: false, error: '해당 생성본을 찾을 수 없습니다.' }

  await db.update(sermons).set({ customThumbnailUrl: url }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, 'thumbnail:apply:candidate', session.user.id)
  revalidateSermonPaths(id)
  return { ok: true }
}

export async function resetThumbnailAction(id: string): Promise<ThumbnailActionResult> {
  const session = await requireAdmin()
  await db.update(sermons).set({ customThumbnailUrl: null }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, 'thumbnail:reset', session.user.id)
  revalidateSermonPaths(id)
  return { ok: true }
}
