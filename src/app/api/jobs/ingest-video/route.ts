import { log } from '@/lib/logger'
import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { insertSermon, sermonExists } from '@/lib/sermons/ingest'
import { classifyByTitle } from '@/lib/sermons/classify-title'
import { expectsAutoSummary } from '@/lib/worship'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'

export const maxDuration = 60

const MAX_INGEST_RETRY = 12

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { videoId, attempt = 0 } = JSON.parse(raw) as { videoId: string; attempt?: number }

  if (await sermonExists(videoId)) return Response.json({ ok: true, skipped: 'exists' })

  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!channelId) return new Response('YOUTUBE_CHANNEL_ID is not set', { status: 500 })
  const video = (await fetchChannelVideos(channelId, 2)).find((item) => item.videoId === videoId)
  if (!video) {
    if (attempt < MAX_INGEST_RETRY) {
      console.log(`[ingest-video] 채널 목록 미노출, ${RETRY_DELAY_SECONDS / 60}분 후 재시도 videoId=${videoId} attempt=${attempt + 1}/${MAX_INGEST_RETRY}`)
      await publishJob('ingest-video', { videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
      return Response.json({ ok: true, retry: attempt + 1 })
    }
    console.error(`[ingest-video] ${MAX_INGEST_RETRY}회 재시도 후 포기 videoId=${videoId}`)
    await log('error', 'sermon', undefined, `[ingest] 채널 목록에서 영상 미발견, ${MAX_INGEST_RETRY}회 재시도 후 포기: videoId=${videoId}`)
    return Response.json({ ok: false, error: 'video not found' }, { status: 200 })
  }

  const worshipType = classifyByTitle(video.title)
  const sermonId = await insertSermon(video, worshipType)
  if (sermonId && expectsAutoSummary(worshipType)) {
    try {
      await publishJob('fetch-transcript', { sermonId, videoId, attempt: 0 })
    } catch (e) {
      // 발행이 죽어도 등록은 유지한다. (500 반환 시 QStash 재전달이 sermonExists에 걸려 자막 발행 기회가 사라짐)
      console.error(`[ingest-video] fetch-transcript 발행 실패 videoId=${videoId}`, e)
      await log('error', 'sermon', sermonId, `fetch-transcript 발행 실패 — 자막·요약 미진행: videoId=${videoId}`)
    }
  }
  return Response.json({ ok: true, sermonId, worshipType })
}
