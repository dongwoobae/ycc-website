import { log } from '@/lib/logger'
import { publishJob, verifyQStash } from '@/lib/qstash'
import { reclaimStaleAudioTranscripts, selectRetryTargets } from '@/lib/sermons/summarize'

/**
 * 막힌 설교를 주기적으로 재투입하는 스위퍼(QStash 스케줄 전용). 두 종류를 함께 본다.
 *
 * 1. 오디오 변환이 함수 예산에 걸려 강제 종료된 건 — 라우트의 catch가 실행되지 않아 진행 표시만
 *    남아 있다. 자막이 없으면 fetch-audio-transcript부터 다시 태우고, 자막이 이미 있으면(저장 직후
 *    끊긴 경우) 표시만 풀어 아래 2번에 넘긴다.
 * 2. 자막은 있는데 요약이 없는 건 — summarize만 재발행한다. 실제 중복/횟수제한은
 *    claimSermonById가 차단한다.
 *
 * 1번이 2번을 만들어 낼 수 있으므로 순서가 중요하다 — 넘겨진 건이 같은 실행에서 회수된다.
 */
export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }

  const reclaimed = await reclaimStaleAudioTranscripts()
  if (reclaimed.republished.length > 0) {
    console.log(
      `[retry-summaries] 오디오 변환 잔류 ${reclaimed.republished.length}건 재투입: ${reclaimed.republished.join(', ')}`,
    )
  }
  if (reclaimed.handedOff.length > 0) {
    console.log(`[retry-summaries] 자막은 확보된 잔류 ${reclaimed.handedOff.length}건을 요약 재시도로 넘김`)
  }
  for (const id of reclaimed.gaveUp) {
    console.error(`[retry-summaries] 오디오 변환 잔류, 재시도 소진으로 종결 sermonId=${id}`)
    await log('error', 'sermon', id, '오디오 변환이 끝내 완료되지 않아 자막 없음으로 종결')
  }

  const targets = await selectRetryTargets()
  for (const t of targets) {
    await publishJob('summarize', { sermonId: t.id })
  }
  if (targets.length > 0) {
    console.log(`[retry-summaries] 요약 미완료분 ${targets.length}건 재투입: ${targets.map((t) => t.id).join(', ')}`)
  }

  return Response.json({
    ok: true,
    enqueued: targets.length,
    audioReclaimed: reclaimed.republished.length,
    audioHandedOff: reclaimed.handedOff.length,
    audioGaveUp: reclaimed.gaveUp.length,
  })
}
