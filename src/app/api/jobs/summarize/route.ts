import { verifyQStash } from '@/lib/qstash'
import { claimSermonById, summarizeClaimed } from '@/lib/sermons/summarize'

export const maxDuration = 300

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId, transcriptText } = JSON.parse(raw) as { sermonId: string; transcriptText: string }

  const claimed = await claimSermonById(sermonId)
  if (!claimed) return Response.json({ ok: true, skipped: 'not claimable' })

  const status = await summarizeClaimed(claimed.id, claimed.durationSeconds, transcriptText)
  return Response.json({ ok: true, status })
}
