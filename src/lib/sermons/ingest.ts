import { eq } from 'drizzle-orm'
import { DEFAULT_PREACHER } from '@/lib/constants'
import { db } from '@/lib/db'
import { sermons, sermonSummaries, sermonTranscripts, sermonThumbnails } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import type { WorshipType } from '@/lib/types'
import { sermonDateFromTitle } from '@/lib/sermons/sermon-date'
import type { YouTubeVideo } from '@/lib/youtube/types'

export async function sermonExists(videoId: string): Promise<boolean> {
  const [row] = await db.select({ id: sermons.id }).from(sermons).where(eq(sermons.youtubeVideoId, videoId)).limit(1)
  return !!row
}

/**
 * 새 설교를 즉시 공개 상태로 삽입한다. 이미 있으면 빈 문자열을 반환한다.
 *
 * 실패는 서버 로그에 남기고 그대로 다시 던진다. 특히 sermons 행만 남고 자식 행 생성이 깨진 상태는
 * 어떤 복구 경로도 줍지 못한다 — reconcile은 등록됐다고 보고 건너뛰고, 요약 스위퍼는 sermon_summaries
 * 행만 훑는다. 그 상태를 사람에게 알리는 수단은 이 로그뿐이다.
 */
export async function insertSermon(video: YouTubeVideo, worshipType: WorshipType): Promise<string> {
  let id = ''
  try {
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
        isPublished: true,
      })
      .onConflictDoNothing({ target: sermons.youtubeVideoId })
      .returning({ id: sermons.id })
    id = row?.id ?? ''
    if (id) {
      await db.insert(sermonSummaries).values({ sermonId: id }).onConflictDoNothing()
      await db.insert(sermonTranscripts).values({ sermonId: id }).onConflictDoNothing()
      await db.insert(sermonThumbnails).values({ sermonId: id }).onConflictDoNothing()
      console.log(`[sermon] 등록 videoId=${video.videoId} type=${worshipType} "${video.title}"`)
      await log('create', 'sermon', id, `${video.title} (${worshipType})`)
    }
  } catch (e) {
    console.error(`[sermon] 등록 실패 videoId=${video.videoId}`, e)
    const partial = id ? ' — sermons 행만 남음(자막·요약·썸네일 행 없음, 수동 복구 필요)' : ''
    await log('error', 'sermon', id || undefined, `등록 실패${partial}: videoId=${video.videoId}`)
    throw e
  }
  return id
}
