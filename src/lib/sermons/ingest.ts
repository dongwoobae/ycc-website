import { eq } from 'drizzle-orm'
import { DEFAULT_PREACHER } from '@/lib/constants'
import { db } from '@/lib/db'
import { sermons, sermonSummaries, sermonTranscripts, sermonThumbnails } from '@/lib/db/schema'
import type { WorshipType } from '@/lib/types'
import { sermonDateFromTitle } from '@/lib/sermons/sermon-date'
import type { YouTubeVideo } from '@/lib/youtube/client'

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
      sermonDate: sermonDateFromTitle(video.title) ?? (video.publishedAt || '').slice(0, 10),
      videoUrl: `https://youtu.be/${video.videoId}`,
      thumbnailUrl: video.thumbnailUrl,
      youtubeVideoId: video.videoId,
      durationSeconds: video.durationSeconds,
      summaryStatus: 'none',
      isPublished: true,
    })
    .onConflictDoNothing({ target: sermons.youtubeVideoId })
    .returning({ id: sermons.id })
  const id = row?.id ?? ''
  if (id) {
    await db.insert(sermonSummaries).values({ sermonId: id }).onConflictDoNothing()
    await db.insert(sermonTranscripts).values({ sermonId: id }).onConflictDoNothing()
    await db.insert(sermonThumbnails).values({ sermonId: id }).onConflictDoNothing()
  }
  return id
}
