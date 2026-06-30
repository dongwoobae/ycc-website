import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermonSummaries } from '@/lib/db/schema'
import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { storeTranscript } from '@/lib/sermons/summarize'
import { fetchTranscript } from '@/lib/transcript/rapidapi'

export const maxDuration = 60

const MAX_TRANSCRIPT_RETRY = 12

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId, videoId, attempt = 0 } = JSON.parse(raw) as {
    sermonId: string
    videoId: string
    attempt?: number
  }

  const segments = await fetchTranscript(videoId)
  if (segments.length === 0) {
    if (attempt < MAX_TRANSCRIPT_RETRY) {
      await publishJob('fetch-transcript', { sermonId, videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
      return Response.json({ ok: true, retry: attempt + 1 })
    }
    await db.update(sermonSummaries).set({ summaryStatus: 'failed' }).where(eq(sermonSummaries.sermonId, sermonId))
    return Response.json({ ok: true, gaveUp: true })
  }

  await storeTranscript(sermonId, segments)
  await publishJob('summarize', { sermonId })
  return Response.json({ ok: true, segments: segments.length })
}
