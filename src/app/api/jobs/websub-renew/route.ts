import { log } from '@/lib/logger'
import { verifyQStash } from '@/lib/qstash'
import { getWebSubCallbackUrl, subscribeToChannel } from '@/lib/youtube/websub'

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  try {
    await subscribeToChannel({
      channelId: process.env.YOUTUBE_CHANNEL_ID!,
      callbackUrl: getWebSubCallbackUrl(),
      secret: process.env.WEBSUB_SECRET!,
    })
  } catch (e) {
    // 갱신 실패가 QStash 대시보드에만 남으면 리스가 만료돼 reconcile이 잡을 때까지 아무도 모른다.
    // 감사 로그에 남기고 500을 돌려 QStash 재시도를 유도한다.
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[websub-renew] 허브 재구독 실패', e)
    await log('error', 'sermon', undefined, `[websub-renew] 허브 재구독 실패 — 리스 만료 시 푸시 중단: ${reason}`)
    return new Response('subscribe failed', { status: 500 })
  }
  return Response.json({ ok: true })
}
