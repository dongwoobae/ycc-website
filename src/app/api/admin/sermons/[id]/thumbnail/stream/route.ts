import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { formatSse } from '@/lib/sse'
import { log } from '@/lib/logger'
import { generateThumbnail } from '@/lib/thumbnails/generate'
import { THUMBNAIL_STYLES, type ThumbnailStyle } from '@/lib/thumbnails/types'

// gpt-image-2 + remove.bg 호출을 포함하므로 기본(60s)보다 길게. ⚠️ Vercel Hobby는 60s 상한.
export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 15_000

function isStyle(value: unknown): value is ThumbnailStyle {
  return typeof value === 'string' && (THUMBNAIL_STYLES as readonly string[]).includes(value)
}

// 상태변경이므로 GET 아닌 POST (CSRF: 쿠키 세션 + same-origin).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('unauthorized', { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const style = body?.style
  if (!isStyle(style)) return new Response('invalid style', { status: 400 })

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
        const result = await generateThumbnail(id, style, (p) => send('progress', p))
        await log('create', 'sermon', id, `thumbnail:bg:${style}`, session.user.id)
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
