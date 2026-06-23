import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { classifyVideo } from '@/lib/sermons/classify'
import { decideIngest, insertSermon, sermonExists } from '@/lib/sermons/ingest'
import { getVideoById } from '@/lib/youtube/client'

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { videoId, attempt = 0 } = JSON.parse(raw) as { videoId: string; attempt?: number }

  if (await sermonExists(videoId)) return Response.json({ ok: true, skipped: 'exists' })

  const worship = await classifyVideo(videoId, process.env as Record<string, string | undefined>)
  const decision = decideIngest({ exists: false, worship, attempt })

  if (decision.action === 'retry') {
    await publishJob('ingest-video', { videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
    return Response.json({ ok: true, retry: attempt + 1 })
  }
  if (decision.action === 'skip') return Response.json({ ok: true, skipped: 'decided' })

  const apiKey = process.env.YOUTUBE_API_KEY!
  const video = await getVideoById(videoId, apiKey)
  if (!video) return Response.json({ ok: false, error: 'video not found' }, { status: 200 })

  const sermonId = await insertSermon(video, decision.worshipType)
  if (sermonId && decision.autoSummary) {
    await publishJob('fetch-transcript', { sermonId, videoId, attempt: 0 })
  }
  return Response.json({ ok: true, sermonId, worshipType: decision.worshipType })
}
