import { verifyQStash } from '@/lib/qstash'
import { getWebSubCallbackUrl, subscribeToChannel } from '@/lib/youtube/websub'

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  await subscribeToChannel({
    channelId: process.env.YOUTUBE_CHANNEL_ID!,
    callbackUrl: getWebSubCallbackUrl(),
    secret: process.env.WEBSUB_SECRET!,
  })
  return Response.json({ ok: true })
}
