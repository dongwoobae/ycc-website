import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons as sermonsTable, type SermonRow } from '@/lib/db/schema'
import type { Sermon, WorshipType } from '@/lib/types'

type SermonListRow = Pick<
  SermonRow,
  'id' | 'title' | 'preacher' | 'scripture' | 'worshipType' | 'sermonDate' | 'videoUrl' | 'thumbnailUrl' | 'summary' | 'isPublished'
>

const sermonColumns = {
  id: sermonsTable.id,
  title: sermonsTable.title,
  preacher: sermonsTable.preacher,
  scripture: sermonsTable.scripture,
  worshipType: sermonsTable.worshipType,
  sermonDate: sermonsTable.sermonDate,
  videoUrl: sermonsTable.videoUrl,
  thumbnailUrl: sermonsTable.thumbnailUrl,
  summary: sermonsTable.summary,
  isPublished: sermonsTable.isPublished,
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

function toSermon(row: SermonListRow): Sermon {
  const youtubeId = youtubeIdFromUrl(row.videoUrl)
  return {
    id: row.id,
    title: row.title,
    preacher: row.preacher,
    scripture: row.scripture ?? undefined,
    worshipType: row.worshipType as WorshipType,
    sermonDate: row.sermonDate,
    videoUrl: row.videoUrl ?? '',
    youtubeId,
    thumbnailUrl:
      row.thumbnailUrl ?? (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : undefined),
    summary: row.summary ?? undefined,
    isPublished: row.isPublished,
  }
}

export async function getSermons(): Promise<Sermon[]> {
  const rows = await db
    .select(sermonColumns)
    .from(sermonsTable)
    .where(eq(sermonsTable.isPublished, true))
    .orderBy(desc(sermonsTable.sermonDate))
  return rows.map(toSermon)
}

export async function getSermonById(id: string): Promise<Sermon | undefined> {
  const rows = await db
    .select(sermonColumns)
    .from(sermonsTable)
    .where(and(eq(sermonsTable.id, id), eq(sermonsTable.isPublished, true)))
    .limit(1)
  return rows[0] ? toSermon(rows[0]) : undefined
}

export async function getSermonForAdmin(id: string): Promise<Sermon | undefined> {
  const rows = await db.select(sermonColumns).from(sermonsTable).where(eq(sermonsTable.id, id)).limit(1)
  return rows[0] ? toSermon(rows[0]) : undefined
}

export async function getSermonsByWorshipType(worshipType?: WorshipType): Promise<Sermon[]> {
  const condition = worshipType
    ? and(eq(sermonsTable.isPublished, true), eq(sermonsTable.worshipType, worshipType))
    : eq(sermonsTable.isPublished, true)
  const rows = await db.select(sermonColumns).from(sermonsTable).where(condition).orderBy(desc(sermonsTable.sermonDate))
  return rows.map(toSermon)
}

export async function getLatestSermons(limit = 3): Promise<Sermon[]> {
  const rows = await db
    .select(sermonColumns)
    .from(sermonsTable)
    .where(eq(sermonsTable.isPublished, true))
    .orderBy(desc(sermonsTable.sermonDate))
    .limit(limit)
  return rows.map(toSermon)
}
