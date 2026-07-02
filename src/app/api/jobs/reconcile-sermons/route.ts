import { verifyQStash } from '@/lib/qstash'
import { reconcileSermons } from '@/lib/sermons/reconcile'

export const maxDuration = 60

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const result = await reconcileSermons()
  return Response.json({ ok: true, ...result })
}
