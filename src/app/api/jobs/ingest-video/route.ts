import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { insertSermon, sermonExists } from '@/lib/sermons/ingest'
import { classifyByTitle } from '@/lib/sermons/classify-title'
import { expectsAutoSummary } from '@/lib/worship'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'

const MAX_INGEST_RETRY = 12

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { videoId, attempt = 0 } = JSON.parse(raw) as { videoId: string; attempt?: number }

  if (await sermonExists(videoId)) return Response.json({ ok: true, skipped: 'exists' })

  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!channelId) return new Response('YOUTUBE_CHANNEL_ID is not set', { status: 500 })
  const video = (await fetchChannelVideos(channelId, 2)).find((item) => item.videoId === videoId)
  if (!video) {
    if (attempt < MAX_INGEST_RETRY) {
      await publishJob('ingest-video', { videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
      return Response.json({ ok: true, retry: attempt + 1 })
    }
    return Response.json({ ok: false, error: 'video not found' }, { status: 200 })
  }

  const worshipType = classifyByTitle(video.title)
  const sermonId = await insertSermon(video, worshipType)
  if (sermonId && expectsAutoSummary(worshipType)) {
    await publishJob('fetch-transcript', { sermonId, videoId, attempt: 0 })
  }
  return Response.json({ ok: true, sermonId, worshipType })
}
