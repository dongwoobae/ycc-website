import { and, count, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bulletins, galleryAlbums, posts, sermons, sermonSummaries } from '@/lib/db/schema'
import { autoSummaryTypes } from '@/lib/worship'

export interface CountPair {
  total: number
  published: number
}

export interface FailedSermon {
  id: string
  title: string
  displayTitle: string | null
  sermonDate: string
}

export interface AdminDashboardStats {
  content: {
    sermons: CountPair
    posts: CountPair
    bulletins: CountPair
    albums: CountPair
  }
  summary: { ready: number; pending: number; failed: number; none: number; total: number; remaining: number }
  failedSermons: FailedSermon[]
  alerts: { uncategorized: number; missingPreacher: number; summaryFailed: number }
}

const autoSummaryWhere = and(inArray(sermons.worshipType, [...autoSummaryTypes]), isNotNull(sermons.youtubeVideoId))

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [
    sermonContent,
    postContent,
    bulletinContent,
    albumContent,
    summaryRows,
    failedSermons,
    uncategorized,
    missingPreacher,
  ] = await Promise.all([
    db
      .select({ total: count(), published: sql<number>`count(*) filter (where ${sermons.isPublished})`.mapWith(Number) })
      .from(sermons),
    db
      .select({ total: count(), published: sql<number>`count(*) filter (where ${posts.isPublished})`.mapWith(Number) })
      .from(posts),
    db
      .select({ total: count(), published: sql<number>`count(*) filter (where ${bulletins.isPublished})`.mapWith(Number) })
      .from(bulletins),
    db
      .select({
        total: count(),
        published: sql<number>`count(*) filter (where ${galleryAlbums.isPublished})`.mapWith(Number),
      })
      .from(galleryAlbums),
    db
      .select({ status: sermonSummaries.summaryStatus, c: count() })
      .from(sermons)
      .innerJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
      .where(autoSummaryWhere)
      .groupBy(sermonSummaries.summaryStatus),
    db
      .select({
        id: sermons.id,
        title: sermons.title,
        displayTitle: sermons.displayTitle,
        sermonDate: sermons.sermonDate,
      })
      .from(sermons)
      .innerJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
      .where(and(eq(sermonSummaries.summaryStatus, 'failed'), autoSummaryWhere))
      .orderBy(desc(sermons.sermonDate))
      .limit(8),
    db.select({ c: count() }).from(sermons).where(eq(sermons.worshipType, '미분류')),
    db
      .select({ c: count() })
      .from(sermons)
      .where(and(eq(sermons.isPublished, false), or(isNull(sermons.preacher), eq(sermons.preacher, '')))),
  ])

  const byStatus = (status: string) => summaryRows.find((r) => r.status === status)?.c ?? 0
  const ready = byStatus('ready')
  const pending = byStatus('pending')
  const failed = byStatus('failed')
  const none = byStatus('none')

  return {
    content: {
      sermons: sermonContent[0],
      posts: postContent[0],
      bulletins: bulletinContent[0],
      albums: albumContent[0],
    },
    summary: { ready, pending, failed, none, total: ready + pending + failed + none, remaining: none + failed },
    failedSermons,
    alerts: { uncategorized: uncategorized[0].c, missingPreacher: missingPreacher[0].c, summaryFailed: failed },
  }
}
