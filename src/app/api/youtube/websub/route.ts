import { publishJob } from '@/lib/qstash'
import { parseWebSubNotification, verifyWebSubSignature } from '@/lib/youtube/websub'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const challenge = url.searchParams.get('hub.challenge')
  if (!challenge) return new Response('bad request', { status: 400 })
  return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
}

export async function POST(req: Request) {
  const secret = process.env.WEBSUB_SECRET
  if (!secret) return new Response('not configured', { status: 500 })
  const rawBuffer = Buffer.from(await req.arrayBuffer())
  if (!verifyWebSubSignature(rawBuffer, req.headers.get('x-hub-signature'), secret)) {
    return new Response('invalid signature', { status: 400 })
  }
  const note = parseWebSubNotification(rawBuffer.toString('utf8'))
  if (note.kind === 'upload') {
    await publishJob('ingest-video', { videoId: note.videoId, attempt: 0 })
  }
  return new Response('ok', { status: 200 })
}
