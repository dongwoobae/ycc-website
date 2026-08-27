import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { verifyQStash } from '@/lib/qstash'
import { transcribeFromAudio } from '@/lib/ai/audio-transcript'
import {
  markAudioTranscriptInFlight,
  publishSummarizeOrMarkFailed,
  retryAudioTranscriptOrGiveUp,
} from '@/lib/sermons/summarize'

export const maxDuration = 300

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId, videoId, attempt = 0 } = JSON.parse(raw) as { sermonId: string; videoId: string; attempt?: number }

  const [sermon] = await db
    .select({ durationSeconds: sermons.durationSeconds })
    .from(sermons)
    .where(eq(sermons.id, sermonId))
    .limit(1)

  // Vercel이 maxDuration에서 함수를 끊으면 아래 catch가 실행되지 않는다. 그 전에 진행 표시를
  // 남겨 두어야 retry-summaries가 잔류를 보고 회수할 수 있다.
  await markAudioTranscriptInFlight(sermonId)

  let segments
  try {
    segments = await transcribeFromAudio(videoId, sermon?.durationSeconds ?? null)
    if (segments.length === 0) throw new Error('오디오 변환 결과 없음')
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 150) : String(e).slice(0, 150)
    console.error(`[fetch-audio-transcript] 오디오 변환 실패 videoId=${videoId} attempt=${attempt}`, e)
    await log('error', 'sermon', sermonId, `오디오 변환 실패(시도 ${attempt + 1}회): videoId=${videoId} ${message}`)
    const outcome = await retryAudioTranscriptOrGiveUp(sermonId, videoId, attempt)
    return Response.json({ ok: true, [outcome === 'retry' ? 'retry' : 'gaveUp']: true })
  }

  await publishSummarizeOrMarkFailed(sermonId, segments, videoId)
  console.log(`[fetch-audio-transcript] 오디오 변환 완료 videoId=${videoId} segments=${segments.length}`)
  return Response.json({ ok: true, segments: segments.length })
}
