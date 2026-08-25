import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermonSummaries } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { publishSummarizeOrMarkFailed } from '@/lib/sermons/summarize'
import { fetchTranscript } from '@/lib/transcript/rapidapi'

export const maxDuration = 60

const MAX_TRANSCRIPT_RETRY = 6

/** fetch-audio-transcript 라우트의 maxDuration과 맞춘 값. */
const AUDIO_TRANSCRIPT_TIMEOUT_SECONDS = 300

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const {
    sermonId,
    videoId,
    attempt = 0,
  } = JSON.parse(raw) as {
    sermonId: string
    videoId: string
    attempt?: number
  }

  const segments = await fetchTranscript(videoId)
  if (segments.length === 0) {
    if (attempt < MAX_TRANSCRIPT_RETRY) {
      console.log(
        `[fetch-transcript] 자막 미준비, ${RETRY_DELAY_SECONDS / 60}분 후 재시도 videoId=${videoId} attempt=${attempt + 1}/${MAX_TRANSCRIPT_RETRY}`,
      )
      await publishJob('fetch-transcript', { sermonId, videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
      return Response.json({ ok: true, retry: attempt + 1 })
    }
    // 유튜브가 자막을 끝내 만들지 않은 경우 — 재시도 대신 오디오 변환 폴백으로 넘긴다.
    console.error(
      `[fetch-transcript] ${MAX_TRANSCRIPT_RETRY}회 재시도 후 포기(자막 없음), 오디오 변환 시도 videoId=${videoId}`,
    )
    await log(
      'error',
      'sermon',
      sermonId,
      `자막 없음 — ${MAX_TRANSCRIPT_RETRY}회 재시도 후 포기, 오디오 변환 시도: videoId=${videoId}`,
    )
    try {
      await publishJob('fetch-audio-transcript', { sermonId, videoId }, 0, {
        // 재전달 한 번마다 4~5분짜리 Gemini 오디오 호출이 통째로 다시 돈다.
        retries: 1,
        timeoutSeconds: AUDIO_TRANSCRIPT_TIMEOUT_SECONDS,
      })
    } catch (e) {
      console.error(`[fetch-transcript] 오디오 변환 발행 실패, 최종 포기 videoId=${videoId}`, e)
      await log('error', 'sermon', sermonId, `오디오 변환 발행 실패 — 최종 포기: videoId=${videoId}`)
      await db
        .update(sermonSummaries)
        .set({ summaryStatus: 'no_transcript' })
        .where(eq(sermonSummaries.sermonId, sermonId))
      return Response.json({ ok: true, gaveUp: true })
    }
    return Response.json({ ok: true, gaveUp: true, audioFallback: true })
  }

  await publishSummarizeOrMarkFailed(sermonId, segments, videoId)
  console.log(`[fetch-transcript] 자막 저장 완료 videoId=${videoId} segments=${segments.length}`)
  return Response.json({ ok: true, segments: segments.length })
}
