import { verifyQStash } from '@/lib/qstash'
import { runAudioTranscriptPoll, type AudioPollPayload } from '@/lib/sermons/audio-transcript-job'

export const maxDuration = 60

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const outcome = await runAudioTranscriptPoll(JSON.parse(raw) as AudioPollPayload)
  return Response.json({ ok: true, outcome })
}
