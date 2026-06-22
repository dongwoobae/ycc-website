import { runSummaryWorker } from '@/lib/sermons/summarize'

export const maxDuration = 300

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 })
  try {
    const result = await runSummaryWorker(3)
    return Response.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron summarize]', e)
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
