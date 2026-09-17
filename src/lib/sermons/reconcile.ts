import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { publishJob } from '@/lib/qstash'
import { expectsAutoSummary } from '@/lib/worship'
import {
  fetchVideoDetails,
  listUploadCandidates,
  toYouTubeVideo,
  type VideoDetail,
} from '@/lib/youtube/data-api'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import type { YouTubeVideoCandidate } from '@/lib/youtube/types'
import { classifyByTitle } from './classify-title'
import { insertSermon } from './ingest'
import { revalidateSermonPaths } from './revalidate'

interface UploadListing {
  candidates: YouTubeVideoCandidate[]
  detailsFor: (videoIds: string[]) => Promise<Map<string, VideoDetail>>
}

/**
 * 업로드 목록을 가져온다. Data API가 못 쓰이는 모든 경우에 yt-api로 폴백한다.
 *
 * 폴백 조건을 "키 미설정"으로만 두면 폐기된 키가 설정돼 있을 때 매 회차 403으로 건너뛰며
 * 주경로가 무기한 멈춘다 — 능동 알림이 없어 사람이 로그를 보기 전까지 아무도 모른다.
 * 폴백의 상세 조회는 이미 받아 둔 목록에서 꺼내 쓴다. yt-api 호출 수가 늘지 않아야 한다.
 */
async function listUploads(channelId: string): Promise<UploadListing> {
  try {
    return { candidates: await listUploadCandidates(channelId), detailsFor: fetchVideoDetails }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.warn(`[reconcile] Data API 조회 실패 — yt-api로 폴백: ${reason}`)
    await log('warning', 'sermon', undefined, `[reconcile] Data API 조회 실패 — yt-api로 폴백: ${reason}`)
    const videos = await fetchChannelVideos(channelId, 1)
    const byId = new Map(videos.map((v) => [v.videoId, v]))
    return {
      candidates: videos,
      detailsFor: async (ids) =>
        new Map(
          ids
            .map((id) => byId.get(id))
            // 채널 목록 응답에는 라이브 판별 필드가 없다 — 방송 중·예약 공개 영상은 lengthText가
            // 비어 durationSeconds가 0으로 온다. 0을 라이브 신호로 써서 배제하고 다음 회차에 다시 잡는다.
            .filter((v): v is NonNullable<typeof v> => !!v && v.durationSeconds > 0)
            .map((v) => [v.videoId, { durationSeconds: v.durationSeconds, isLiveOrUpcoming: false }]),
        ),
    }
  }
}

/**
 * 채널 최신 영상과 DB를 대조해 새 설교를 등록하는 폴링(스케줄 전용).
 * WebSub 푸시가 죽어 있는 동안 이것이 유일한 등록 경로다(2026-09-17).
 * 등록은 in-process로 직접 수행해 QStash 아웃바운드 장애와 독립적으로 동작하고,
 * 자막·요약은 기존 fetch-transcript 체인에 best-effort로 넘긴다.
 */
export async function reconcileSermons(): Promise<{ checked: number; inserted: number }> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID is not set')

  let listing: UploadListing
  try {
    listing = await listUploads(channelId)
  } catch (e) {
    // 주경로·폴백이 모두 죽은 회차. 다음 회차가 같은 누락분을 다시 잡는다.
    const reason = e instanceof Error ? e.message : String(e)
    console.error(`[reconcile] 업로드 목록 조회 실패 — 이번 회차를 건너뛴다: ${reason}`)
    await log('error', 'sermon', undefined, `[reconcile] 업로드 목록 조회 실패 — 이번 회차 건너뜀: ${reason}`)
    return { checked: 0, inserted: 0 }
  }

  if (listing.candidates.length === 0) {
    // 225개 안팎인 채널에서 빈 목록은 채널 접근·쿼터 이상의 신호일 수 있다. 등록 없이 종료하되 남긴다.
    console.warn('[reconcile] 업로드 목록이 비었다')
    await log('warning', 'sermon', undefined, '[reconcile] 업로드 목록이 비었다')
  }

  const existing = await db.select({ id: sermons.youtubeVideoId }).from(sermons)
  const existingIds = new Set(existing.map((r) => r.id).filter((x): x is string => !!x))
  const missing = listing.candidates.filter((v) => !existingIds.has(v.videoId))
  if (missing.length === 0) return { checked: listing.candidates.length, inserted: 0 }

  let details: Map<string, VideoDetail>
  try {
    details = await listing.detailsFor(missing.map((v) => v.videoId))
  } catch (e) {
    // 상세 조회(videos.list)만 실패한 경우. yt-api로 다시 폴백하지 않는다 — RapidAPI 월 300회
    // 한도를 상세 조회로 태울 이유가 없고, 다음 회차가 같은 누락분을 다시 잡는다.
    const reason = e instanceof Error ? e.message : String(e)
    console.error(`[reconcile] 영상 상세 조회 실패 — 이번 회차를 건너뛴다: ${reason}`)
    await log('error', 'sermon', undefined, `[reconcile] 영상 상세 조회 실패 — 이번 회차 건너뜀: ${reason}`)
    return { checked: listing.candidates.length, inserted: 0 }
  }

  let inserted = 0
  for (const candidate of missing) {
    const detail = details.get(candidate.videoId)
    if (!detail) {
      // 길이 0 이하(방송 중·VOD 처리중)로 data-api.ts가 이미 배제했거나, videos.list가 이 videoId를
      // 아예 돌려주지 않았다(비공개 전환 등). 후자는 매 회차 조용히 반복될 수 있어 로그로 남긴다.
      console.warn(`[reconcile] 상세 없음 — 건너뜀 videoId=${candidate.videoId}`)
      await log('warning', 'sermon', undefined, `[reconcile] 상세 없음 — 건너뜀 videoId=${candidate.videoId}`)
      continue
    }
    // 상세는 있지만 아직 방송 중·예약 공개다(liveBroadcastContent !== 'none'). 길이가 확정되지
    // 않아 지금 등록하면 0초로 남는다.
    if (detail.isLiveOrUpcoming) continue

    const video = toYouTubeVideo(candidate, detail)
    const worshipType = classifyByTitle(video.title)
    let sermonId: string
    try {
      // 실패 사유는 insertSermon이 남긴다. 여기서는 한 건의 실패로 남은 누락분까지 놓치지 않게만 한다.
      sermonId = await insertSermon(video, worshipType, 'reconcile')
    } catch {
      continue
    }
    if (!sermonId) continue
    inserted++

    try {
      // ISR 무효화 실패가 밖으로 나가면 회차 전체가 죽어 남은 누락분이 시도조차 되지 않는다.
      revalidateSermonPaths(sermonId)
    } catch (e) {
      console.error(`[reconcile] ISR 무효화 실패 videoId=${video.videoId}`, e)
    }

    if (!expectsAutoSummary(worshipType)) continue
    try {
      await publishJob('fetch-transcript', { sermonId, videoId: video.videoId, attempt: 0 })
    } catch (e) {
      console.error(`[reconcile] fetch-transcript 발행 실패 videoId=${video.videoId}`, e)
      await log(
        'error',
        'sermon',
        sermonId,
        `[reconcile] fetch-transcript 발행 실패 — 자막·요약 미진행: videoId=${video.videoId}`,
      )
    }
  }
  return { checked: listing.candidates.length, inserted }
}
