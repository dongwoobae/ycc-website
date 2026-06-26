'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { sermons, sermonSummaries, sermonThumbnails } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { resyncAllSermons } from '@/lib/sermons/sync'
import { manualSummarize } from '@/lib/sermons/summarize'
import { isWorshipType } from '@/lib/worship'

export interface SermonEditInput {
  title: string
  displayTitle: string
  preacher: string
  worshipType: string
  sermonDate: string
}

function revalidateSermonPaths(id?: string) {
  revalidatePath('/')
  revalidatePath('/sermons')
  revalidatePath('/admin/sermons')
  if (id) {
    revalidatePath(`/sermons/${id}`)
    revalidatePath(`/admin/sermons/${id}/edit`)
  }
}

export async function getSermonsForAdmin() {
  await requireAdmin()
  return db
    .select({
      id: sermons.id,
      sermonDate: sermons.sermonDate,
      title: sermons.title,
      displayTitle: sermons.displayTitle,
      preacher: sermons.preacher,
      worshipType: sermons.worshipType,
      isPublished: sermons.isPublished,
      summaryStatus: sermonSummaries.summaryStatus,
    })
    .from(sermons)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
    .orderBy(desc(sermons.sermonDate))
}

export async function getSermonForAdmin(id: string) {
  await requireAdmin()
  // 요약/챕터/배경은 위성(SoT)에서 조회 — sermons 원본 컬럼은 더 이상 갱신되지 않음
  const [row] = await db
    .select({
      id: sermons.id,
      title: sermons.title,
      displayTitle: sermons.displayTitle,
      preacher: sermons.preacher,
      worshipType: sermons.worshipType,
      sermonDate: sermons.sermonDate,
      summaryStatus: sermonSummaries.summaryStatus,
      quickSummary: sermonSummaries.quickSummary,
      chapters: sermonSummaries.chapters,
      thumbnailBackgrounds: sermonThumbnails.thumbnailBackgrounds,
    })
    .from(sermons)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
    .leftJoin(sermonThumbnails, eq(sermonThumbnails.sermonId, sermons.id))
    .where(eq(sermons.id, id))
    .limit(1)
  return row
}

export async function syncNowAction() {
  await requireAdmin()
  const result = await resyncAllSermons()
  revalidateSermonPaths()
  return result
}

export async function generateSummaryAction(id: string) {
  await requireAdmin()
  const status = await manualSummarize(id)
  revalidateSermonPaths(id)
  return status
}

export async function updateSermonAction(id: string, input: SermonEditInput) {
  const session = await requireAdmin()
  if (!input.title.trim()) throw new Error('title is required')
  if (!isWorshipType(input.worshipType)) throw new Error('invalid worshipType')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sermonDate)) throw new Error('invalid sermonDate')

  const [updated] = await db
    .update(sermons)
    .set({
      title: input.title.trim(),
      displayTitle: input.displayTitle.trim() || null,
      preacher: input.preacher.trim() || null,
      worshipType: input.worshipType,
      sermonDate: input.sermonDate,
    })
    .where(eq(sermons.id, id))
    .returning({ id: sermons.id, title: sermons.title })
  if (!updated) throw new Error('sermon not found')
  await log('update', 'sermon', updated.id, updated.title, session.user.id)
  revalidateSermonPaths(id)
}

export async function togglePublishAction(id: string, publish: boolean) {
  const session = await requireAdmin()
  if (publish) {
    const [row] = await db.select({ preacher: sermons.preacher }).from(sermons).where(eq(sermons.id, id)).limit(1)
    if (!row) throw new Error('sermon not found')
    if (!row.preacher?.trim()) throw new Error('공개 전 설교자(preacher)를 입력하세요')
  }

  const [updated] = await db
    .update(sermons)
    .set({ isPublished: publish })
    .where(eq(sermons.id, id))
    .returning({ id: sermons.id, title: sermons.title })
  if (!updated) throw new Error('sermon not found')
  await log('update', 'sermon', updated.id, `publish=${publish}`, session.user.id)
  revalidateSermonPaths(id)
}
