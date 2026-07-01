import { runAnalyticsRollup } from '@/lib/analytics/rollup'
import { verifyQStash } from '@/lib/qstash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }

  const result = await runAnalyticsRollup()
  return Response.json({ ok: true, ...result })
}
