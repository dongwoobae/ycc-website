'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { composeThumbnailText } from '@/lib/thumbnails/compose-text'
import { generateBackground } from '@/lib/thumbnails/generate-background'
import { geminiHeadline } from '@/lib/thumbnails/headline'
import { renderThumbnail, toDataUrl } from '@/lib/thumbnails/render'
import { storeCandidate } from '@/lib/thumbnails/store'
import type { ThumbnailCandidate, ThumbnailStyle, ThumbnailText } from '@/lib/thumbnails/types'

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

export async function generateThumbnailAction(
  id: string,
  style: ThumbnailStyle,
  text: ThumbnailText
): Promise<GenerateThumbnailResult> {
  const session = await requireAdmin()
  if (style === 'cutout') throw new Error('인물컷형 누끼 생성은 다음 단계에서 지원됩니다')

  const background = await generateBackground(style)
  const png = await renderThumbnail({
    headline: text.headline,
    scripture: text.scripture,
    backgroundDataUrl: toDataUrl(background),
  })

  const candidate = await storeCandidate(id, style, png)
  await log('create', 'sermon', id, `thumbnail:${style}`, session.user.id)
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
