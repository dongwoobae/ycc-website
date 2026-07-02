import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { publishJob } from '@/lib/qstash'
import { expectsAutoSummary } from '@/lib/worship'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import { classifyByTitle } from './classify-title'
import { insertSermon } from './ingest'
import { revalidateSermonPaths } from './revalidate'

/**
 * 채널 최신 영상과 DB를 대조해 WebSub 푸시가 소실된 누락분을 주워 담는 일일 보정(스케줄 전용).
 * 등록은 in-process로 직접 수행해 QStash 아웃바운드 장애와 독립적으로 동작하고,
 * 자막·요약은 기존 fetch-transcript 체인에 best-effort로 넘긴다.
 * 여기서 누락분이 발견됐다는 것 자체가 푸시 경로(WebSub→웹훅→발행) 고장 신호라 error로 남긴다.
 */
export async function reconcileSermons(): Promise<{ checked: number; inserted: number }> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID is not set')

  const existing = await db.select({ id: sermons.youtubeVideoId }).from(sermons)
  const existingIds = new Set(existing.map((r) => r.id).filter((x): x is string => !!x))
  const videos = await fetchChannelVideos(channelId, 1)
  const missing = videos.filter((v) => !existingIds.has(v.videoId))

  let inserted = 0
  for (const video of missing) {
    const worshipType = classifyByTitle(video.title)
    const sermonId = await insertSermon(video, worshipType)
    if (!sermonId) continue
    inserted++
    revalidateSermonPaths(sermonId)
    console.warn(`[reconcile] WebSub 누락분 보정 등록 videoId=${video.videoId} "${video.title}"`)
    await log('error', 'sermon', sermonId, `[reconcile] WebSub 알림 소실 감지 — 보정 등록됨(푸시 경로 점검 필요): ${video.title}`)

    if (!expectsAutoSummary(worshipType)) continue
    try {
      await publishJob('fetch-transcript', { sermonId, videoId: video.videoId, attempt: 0 })
    } catch (e) {
      console.error(`[reconcile] fetch-transcript 발행 실패 videoId=${video.videoId}`, e)
      await log('error', 'sermon', sermonId, `[reconcile] fetch-transcript 발행 실패 — 자막·요약 미진행: videoId=${video.videoId}`)
    }
  }
  return { checked: videos.length, inserted }
}
