import { publishJob, verifyQStash } from '@/lib/qstash'
import { selectRetryTargets } from '@/lib/sermons/summarize'

/**
 * 요약(Gemini) 단계에서 실패한 설교를 주기적으로 재투입하는 스위퍼(QStash 스케줄 전용).
 * 자막은 이미 캐시돼 있으므로 summarize만 재발행한다(자막 재취득 불필요).
 * 실제 요약 중복/횟수제한은 claimSermonById가 차단한다.
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
  return Response.json({ ok: true, enqueued: targets.length })
}
