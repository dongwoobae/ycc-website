import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { formatSse } from '@/lib/sse'
import { revalidateSermonPaths } from '@/lib/sermons/revalidate'
import { resyncAllSermons } from '@/lib/sermons/sync'

// 인라인 자막+요약을 포함하므로 기본(60s)보다 길게. ⚠️ Vercel Hobby는 60s 상한.
export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 15_000

// 상태변경이므로 GET 아닌 POST (CSRF: 쿠키 세션 + same-origin).
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // 이미 닫힘
        }
      }
      const send = (event: string, data: unknown) => safeEnqueue(formatSse(event, data))
      // 프록시 idle 종료 방지용 heartbeat(주석 라인).
      const heartbeat = setInterval(() => safeEnqueue(': ping\n\n'), HEARTBEAT_MS)

      try {
        const result = await resyncAllSermons((p) => send('progress', p))
        // 공개 페이지 ISR 캐시 무효화 (기존 syncNowAction 동작 복원).
        revalidateSermonPaths()
        send('done', result)
      } catch (e) {
        send('error', { message: e instanceof Error ? e.message : String(e) })
      } finally {
        clearInterval(heartbeat)
        closed = true
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
