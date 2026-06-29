import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons, sermonSummaries, sermonThumbnails } from '@/lib/db/schema'
import { generateBackground } from '@/lib/thumbnails/generate-background'
import { geminiBgKeywords } from '@/lib/thumbnails/bg-keywords'
import { removeBackground } from '@/lib/thumbnails/remove-background'
import { storeBackground, storeCutout } from '@/lib/thumbnails/store'
import type { ThumbnailStyle } from '@/lib/thumbnails/types'

export interface GenerateThumbnailResult {
  backgroundUrl: string
  cutoutUrl?: string
}

export interface ThumbnailGenProgress {
  current: number
  total: number
  phase: string
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
 * 각 단계 경계에서 onProgress를 호출해 실시간 진행률을 보고한다.
 * 인증·로깅은 호출부(서버 액션/라우트) 책임.
 */
export async function generateThumbnail(
  id: string,
  style: ThumbnailStyle,
  onProgress?: (p: ThumbnailGenProgress) => void
): Promise<GenerateThumbnailResult> {
  const total = style === 'cutout' ? 4 : 3
  const report = (current: number, phase: string) => onProgress?.({ current, total, phase })

  report(0, '배경 무드 분석 중...')
  const keywords = await resolveBgKeywords(id)

  report(1, '배경 이미지 생성 중...')
  const background = await generateBackground(style, keywords)

  report(2, '배경 저장 중...')
  const backgroundUrl = await storeBackground(id, style, background)

  let cutoutUrl: string | undefined
  if (style === 'cutout') {
    report(3, '인물 누끼 추출 중...')
    cutoutUrl = await resolveCutout(id)
  }

  report(total, '완료')
  return { backgroundUrl, cutoutUrl }
}
