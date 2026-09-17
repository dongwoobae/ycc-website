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
    // 허브 장애는 우리가 고칠 수 없고, 설교 등록은 폴링이 책임진다(2026-09-17).
    // 500으로 재시도를 유도하면 같은 실패가 하루 4행 쌓일 뿐이라 200으로 끊는다.
    // 리스는 5일이고 갱신은 매일이라 연속 4회 실패까지 견딘다.
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[websub-renew] 허브 재구독 실패', e)
    await log('warning', 'sermon', undefined, `[websub-renew] 허브 재구독 실패: ${reason}`)
    return Response.json({ ok: false, error: 'subscribe failed' }, { status: 200 })
  }
  return Response.json({ ok: true })
}
