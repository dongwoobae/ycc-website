import { eq } from 'drizzle-orm'
import { DEFAULT_PREACHER } from '@/lib/constants'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import type { WorshipType } from '@/lib/types'
import type { WorshipResolution } from '@/lib/sermons/classify'
import type { YouTubeVideo } from '@/lib/youtube/client'

export const INGEST_MAX_RETRY = 3

export type IngestDecision =
  | { action: 'skip' }
  | { action: 'retry' }
  | { action: 'insert'; worshipType: WorshipType; autoSummary: boolean }

export function decideIngest(input: { exists: boolean; worship: WorshipResolution | null; attempt: number }): IngestDecision {
  if (input.exists) return { action: 'skip' }
  if (input.worship) return { action: 'insert', worshipType: input.worship.worshipType, autoSummary: input.worship.autoSummary }
  if (input.attempt < INGEST_MAX_RETRY) return { action: 'retry' }
  return { action: 'insert', worshipType: '미분류', autoSummary: false }
}

export async function sermonExists(videoId: string): Promise<boolean> {
  const [row] = await db.select({ id: sermons.id }).from(sermons).where(eq(sermons.youtubeVideoId, videoId)).limit(1)
  return !!row
}

/** 새 설교를 즉시 공개 상태로 삽입한다. 이미 있으면 빈 문자열을 반환한다. */
export async function insertSermon(video: YouTubeVideo, worshipType: WorshipType): Promise<string> {
  const [row] = await db
    .insert(sermons)
    .values({
      title: video.title,
      preacher: DEFAULT_PREACHER,
      worshipType,
      sermonDate: (video.publishedAt || '').slice(0, 10),
      videoUrl: `https://youtu.be/${video.videoId}`,
      thumbnailUrl: video.thumbnailUrl,
      youtubeVideoId: video.videoId,
      durationSeconds: video.durationSeconds,
      summaryStatus: 'none',
      isPublished: true,
    })
    .onConflictDoNothing({ target: sermons.youtubeVideoId })
    .returning({ id: sermons.id })
  return row?.id ?? ''
}
