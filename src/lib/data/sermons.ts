import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons as sermonsTable, sermonSummaries, type SermonRow, type SermonSummaryRow } from '@/lib/db/schema'
import type { Sermon, WorshipType } from '@/lib/types'

// 상세(detail)는 chapters/quickSummary 포함, 목록(list)은 제외.
// 목록 전용 컬럼셋으로 조회한 행도 toSermon에 그대로 넘길 수 있도록 둘을 optional로 둔다.
// summary/summaryStatus는 sermon_summaries LEFT JOIN 출처(행 부재 시 null 가능).
export type SermonListRow = Pick<
  SermonRow,
  | 'id'
  | 'title'
  | 'displayTitle'
  | 'preacher'
  | 'worshipType'
  | 'sermonDate'
  | 'videoUrl'
  | 'thumbnailUrl'
  | 'customThumbnailUrl'
  | 'isPublished'
  | 'youtubeVideoId'
  | 'durationSeconds'
> & {
  summary: SermonSummaryRow['summary']
  summaryStatus: SermonSummaryRow['summaryStatus'] | null
  quickSummary?: SermonSummaryRow['quickSummary']
  chapters?: SermonSummaryRow['chapters']
}

// 목록 카드(SermonCard)가 실제 쓰는 컬럼만 — 대용량 jsonb(chapters/quickSummary) 제외해 over-fetch 방지.
const sermonListColumns = {
  id: sermonsTable.id,
  title: sermonsTable.title,
  displayTitle: sermonsTable.displayTitle,
  preacher: sermonsTable.preacher,
  worshipType: sermonsTable.worshipType,
  sermonDate: sermonsTable.sermonDate,
  videoUrl: sermonsTable.videoUrl,
  thumbnailUrl: sermonsTable.thumbnailUrl,
  customThumbnailUrl: sermonsTable.customThumbnailUrl,
  summary: sermonSummaries.summary,
  isPublished: sermonsTable.isPublished,
  youtubeVideoId: sermonsTable.youtubeVideoId,
  durationSeconds: sermonsTable.durationSeconds,
  summaryStatus: sermonSummaries.summaryStatus,
}

// 상세(detail)용: 목록 컬럼 + chapters/quickSummary.
const sermonColumns = {
  ...sermonListColumns,
  quickSummary: sermonSummaries.quickSummary,
  chapters: sermonSummaries.chapters,
}

function youtubeIdFromUrl(videoUrl: string | null): string {
  if (!videoUrl) return ''
  try {
    const url = new URL(videoUrl)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1)
    return url.searchParams.get('v') ?? ''
  } catch {
    return ''
  }
}

export function toSermon(row: SermonListRow): Sermon {
  const youtubeId = youtubeIdFromUrl(row.videoUrl)
  return {
    id: row.id,
    title: row.title,
    displayTitle: row.displayTitle ?? undefined,
    preacher: row.preacher ?? undefined,
    worshipType: row.worshipType as WorshipType,
    sermonDate: row.sermonDate,
    videoUrl: row.videoUrl ?? '',
    youtubeId,
    youtubeVideoId: row.youtubeVideoId ?? undefined,
    durationSeconds: row.durationSeconds ?? undefined,
    thumbnailUrl:
      row.customThumbnailUrl ??
      row.thumbnailUrl ??
      (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : undefined),
    summary: row.summary ?? undefined,
    quickSummary: row.quickSummary ?? undefined,
    chapters: row.chapters ?? undefined,
    summaryStatus: (row.summaryStatus ?? 'none') as Sermon['summaryStatus'],
    isPublished: row.isPublished,
  }
}

export async function getSermons(): Promise<Sermon[]> {
  const rows = await db
    .select(sermonListColumns)
    .from(sermonsTable)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermonsTable.id))
    .where(eq(sermonsTable.isPublished, true))
    .orderBy(desc(sermonsTable.sermonDate))
  return rows.map(toSermon)
}

export async function getSermonById(id: string): Promise<Sermon | undefined> {
  const rows = await db
    .select(sermonColumns)
    .from(sermonsTable)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermonsTable.id))
    .where(and(eq(sermonsTable.id, id), eq(sermonsTable.isPublished, true)))
    .limit(1)
  return rows[0] ? toSermon(rows[0]) : undefined
}

export async function getSermonForAdmin(id: string): Promise<Sermon | undefined> {
  const rows = await db
    .select(sermonColumns)
    .from(sermonsTable)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermonsTable.id))
    .where(eq(sermonsTable.id, id))
    .limit(1)
  return rows[0] ? toSermon(rows[0]) : undefined
}

export async function getSermonsByWorshipType(worshipType?: WorshipType): Promise<Sermon[]> {
  const condition = worshipType
    ? and(eq(sermonsTable.isPublished, true), eq(sermonsTable.worshipType, worshipType))
    : eq(sermonsTable.isPublished, true)
  const rows = await db
    .select(sermonListColumns)
    .from(sermonsTable)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermonsTable.id))
    .where(condition)
    .orderBy(desc(sermonsTable.sermonDate))
  return rows.map(toSermon)
}

export async function getLatestSermons(limit = 3): Promise<Sermon[]> {
  const rows = await db
    .select(sermonListColumns)
    .from(sermonsTable)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermonsTable.id))
    .where(eq(sermonsTable.isPublished, true))
    .orderBy(desc(sermonsTable.sermonDate))
    .limit(limit)
  return rows.map(toSermon)
}
