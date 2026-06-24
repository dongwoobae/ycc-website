import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { buildTranscriptText } from '@/lib/transcript/prompt'
import { fetchTranscript } from '@/lib/transcript/rapidapi'

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
    await db.update(sermons).set({ summaryStatus: 'failed' }).where(eq(sermons.id, sermonId))
    return Response.json({ ok: true, gaveUp: true })
  }

  const transcriptText = buildTranscriptText(segments)
  await db
    .update(sermons)
    .set({ transcriptText, transcriptFetchedAt: new Date() })
    .where(eq(sermons.id, sermonId))

  await publishJob('summarize', { sermonId, transcriptText })
  return Response.json({ ok: true, segments: segments.length })
}
