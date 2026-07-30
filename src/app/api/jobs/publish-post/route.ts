import { verifyQStash } from '@/lib/qstash'
import { revalidatePostPaths } from '@/lib/posts/revalidate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 예약 게시 공개 시각에 QStash 지연 메시지로 호출된다(actions/posts 에서 발행).
 * 노출 여부는 렌더 시점의 publishedAt 조건이 결정하므로 여기서는 경로 재검증만 한다 —
 * 멱등이라 예약 변경으로 낡은 메시지가 도착해도 무해하다.
 */
export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }

  const { postId } = JSON.parse(raw) as { postId?: string }
  revalidatePostPaths(postId)
  return Response.json({ ok: true })
}
