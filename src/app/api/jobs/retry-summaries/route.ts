import { log } from '@/lib/logger'
import { publishJob, verifyQStash } from '@/lib/qstash'
import { reclaimStaleAudioTranscripts, selectRetryTargets } from '@/lib/sermons/summarize'

/**
 * 막힌 설교를 주기적으로 재투입하는 스위퍼(QStash 스케줄 전용). 두 종류를 함께 본다.
 *
 * 1. 요약(Gemini) 단계에서 실패한 건 — 자막은 이미 캐시돼 있으므로 summarize만 재발행한다.
 *    실제 요약 중복/횟수제한은 claimSermonById가 차단한다.
 * 2. 오디오 변환이 함수 예산에 걸려 강제 종료된 건 — 라우트의 catch가 실행되지 않아
 *    진행 표시만 남아 있다. 이쪽은 자막이 없으므로 fetch-audio-transcript부터 다시 태운다.
 */
export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }

  const targets = await selectRetryTargets()
  for (const t of targets) {
    await publishJob('summarize', { sermonId: t.id })
  }
  if (targets.length > 0) {
    console.log(`[retry-summaries] 요약 실패분 ${targets.length}건 재투입: ${targets.map((t) => t.id).join(', ')}`)
  }

  const reclaimed = await reclaimStaleAudioTranscripts()
  if (reclaimed.republished.length > 0) {
    console.log(
      `[retry-summaries] 오디오 변환 잔류 ${reclaimed.republished.length}건 재투입: ${reclaimed.republished.join(', ')}`,
    )
  }
  for (const id of reclaimed.gaveUp) {
    console.error(`[retry-summaries] 오디오 변환 잔류, 재시도 소진으로 종결 sermonId=${id}`)
    await log('error', 'sermon', id, '오디오 변환이 끝내 완료되지 않아 자막 없음으로 종결')
  }

  return Response.json({
    ok: true,
    enqueued: targets.length,
    audioReclaimed: reclaimed.republished.length,
    audioGaveUp: reclaimed.gaveUp.length,
  })
}
