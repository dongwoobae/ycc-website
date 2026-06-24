import { verifyQStash } from '@/lib/qstash'
import { claimSermonById, summarizeClaimed } from '@/lib/sermons/summarize'

export const maxDuration = 300

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId, transcriptText } = JSON.parse(raw) as { sermonId: string; transcriptText?: string }

  const claimed = await claimSermonById(sermonId)
  if (!claimed) return Response.json({ ok: true, skipped: 'not claimable' })

  // 본문에 자막이 없으면(스위퍼 재투입) DB 캐시 자막을 사용한다.
  const text = transcriptText?.trim() || claimed.transcriptText || ''
  const status = await summarizeClaimed(claimed.id, claimed.durationSeconds, text)
  return Response.json({ ok: true, status })
}
