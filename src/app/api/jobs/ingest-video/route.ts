import { log } from '@/lib/logger'
import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { insertSermon, sermonExists } from '@/lib/sermons/ingest'
import { revalidateSermonPaths } from '@/lib/sermons/revalidate'
import { classifyByTitle } from '@/lib/sermons/classify-title'
import { expectsAutoSummary } from '@/lib/worship'
import { fetchVideoInfo } from '@/lib/youtube/rapidapi-video'

export const maxDuration = 60

const MAX_INGEST_RETRY = 12

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { videoId, attempt = 0 } = JSON.parse(raw) as { videoId: string; attempt?: number }

  if (await sermonExists(videoId)) return Response.json({ ok: true, skipped: 'exists' })

  // 채널 목록(yt-api 캐시 지연 수시간)이 아닌 단건 조회라 업로드 직후에도 즉시 잡힌다.
  // null = 진행 중 라이브·예약 공개·비공개 → 재시도 루프가 종료/공개 후 다시 시도한다.
  const video = await fetchVideoInfo(videoId)
  if (!video) {
    if (attempt < MAX_INGEST_RETRY) {
      console.log(`[ingest-video] 영상 정보 조회 불가(라이브 진행 중/비공개), ${RETRY_DELAY_SECONDS / 60}분 후 재시도 videoId=${videoId} attempt=${attempt + 1}/${MAX_INGEST_RETRY}`)
      await publishJob('ingest-video', { videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
      return Response.json({ ok: true, retry: attempt + 1 })
    }
    console.error(`[ingest-video] ${MAX_INGEST_RETRY}회 재시도 후 포기 videoId=${videoId}`)
    await log('error', 'sermon', undefined, `[ingest] 영상 정보 조회 실패, ${MAX_INGEST_RETRY}회 재시도 후 포기: videoId=${videoId}`)
    return Response.json({ ok: false, error: 'video not found' }, { status: 200 })
  }

  const worshipType = classifyByTitle(video.title)
  const sermonId = await insertSermon(video, worshipType)
  // 자동 등록분이 ISR 1시간 주기를 기다리지 않고 즉시 공개 페이지에 노출되게 한다.
  if (sermonId) revalidateSermonPaths(sermonId)
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
