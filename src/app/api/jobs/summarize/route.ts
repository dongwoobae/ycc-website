import { verifyQStash } from '@/lib/qstash'
import { claimSermonById, summarizeClaimed } from '@/lib/sermons/summarize'

export const maxDuration = 300

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId } = JSON.parse(raw) as { sermonId: string }

  const claimed = await claimSermonById(sermonId)
  if (!claimed) return Response.json({ ok: true, skipped: 'not claimable' })

  // 자막은 fetch-transcript 단계에서 DB에 캐시되므로 DB 값을 사용한다.
  const text = claimed.transcriptText ?? ''
  const status = await summarizeClaimed(claimed.id, claimed.durationSeconds, text)
  return Response.json({ ok: true, status })
}
