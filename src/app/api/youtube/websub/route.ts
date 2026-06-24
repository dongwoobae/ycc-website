import { publishJob } from '@/lib/qstash'
import { channelTopicUrl, parseWebSubNotification, verifyWebSubSignature } from '@/lib/youtube/websub'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const challenge = url.searchParams.get('hub.challenge')
  if (!challenge) return new Response('bad request', { status: 400 })

  // 의도치 않은 토픽 구독을 막기 위해 우리 채널 토픽일 때만 challenge를 에코한다.
  // (YOUTUBE_CHANNEL_ID 미설정 시엔 검증을 건너뛰어 구독 검증이 깨지지 않게 한다.)
  const channelId = process.env.YOUTUBE_CHANNEL_ID
  const topic = url.searchParams.get('hub.topic')
  if (channelId && topic && topic !== channelTopicUrl(channelId)) {
    return new Response('topic mismatch', { status: 404 })
  }
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
  } else if (note.kind === 'unknown') {
    // 파싱 실패가 unknown 처리로 묻히지 않도록 원문 일부를 남긴다.
    console.warn('[websub] unparsed notification', rawBuffer.toString('utf8').slice(0, 500))
  }
  return new Response('ok', { status: 200 })
}
