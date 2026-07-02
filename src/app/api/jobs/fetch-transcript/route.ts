import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermonSummaries } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { storeTranscript } from '@/lib/sermons/summarize'
import { fetchTranscript } from '@/lib/transcript/rapidapi'

export const maxDuration = 60

const MAX_TRANSCRIPT_RETRY = 12

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId, videoId, attempt = 0 } = JSON.parse(raw) as {
    sermonId: string
    videoId: string
    attempt?: number
  }

  const segments = await fetchTranscript(videoId)
  if (segments.length === 0) {
    if (attempt < MAX_TRANSCRIPT_RETRY) {
      console.log(`[fetch-transcript] 자막 미준비, ${RETRY_DELAY_SECONDS / 60}분 후 재시도 videoId=${videoId} attempt=${attempt + 1}/${MAX_TRANSCRIPT_RETRY}`)
      await publishJob('fetch-transcript', { sermonId, videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
      return Response.json({ ok: true, retry: attempt + 1 })
    }
    console.error(`[fetch-transcript] ${MAX_TRANSCRIPT_RETRY}회 재시도 후 포기 videoId=${videoId}`)
    await log('error', 'sermon', sermonId, `자막 취득 ${MAX_TRANSCRIPT_RETRY}회 재시도 후 포기 — 요약 미진행: videoId=${videoId}`)
    await db.update(sermonSummaries).set({ summaryStatus: 'failed' }).where(eq(sermonSummaries.sermonId, sermonId))
    return Response.json({ ok: true, gaveUp: true })
  }

  await storeTranscript(sermonId, segments)
  console.log(`[fetch-transcript] 자막 저장 완료 videoId=${videoId} segments=${segments.length}`)
  try {
    await publishJob('summarize', { sermonId })
  } catch (e) {
    // 자막은 이미 캐시됐으므로 failed로 마킹해 매시간 스위퍼(retry-summaries)가 요약을 재투입하게 한다.
    console.error(`[fetch-transcript] summarize 발행 실패 — 스위퍼 재시도로 인계 videoId=${videoId}`, e)
    await log('error', 'sermon', sermonId, `summarize 발행 실패 — 매시간 스위퍼가 재시도: videoId=${videoId}`)
    await db.update(sermonSummaries).set({ summaryStatus: 'failed' }).where(eq(sermonSummaries.sermonId, sermonId))
  }
  return Response.json({ ok: true, segments: segments.length })
}
