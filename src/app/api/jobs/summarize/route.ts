import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermonSummaries } from '@/lib/db/schema'
import { verifyQStash } from '@/lib/qstash'
import { claimSermonById, summarizeClaimed } from '@/lib/sermons/summarize'

export const maxDuration = 300

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId } = JSON.parse(raw) as { sermonId: string }

  const claimed = await claimSermonById(sermonId)
  if (!claimed) return Response.json({ ok: true, skipped: 'not claimable' })

  // 자막은 fetch-transcript 단계에서 DB에 캐시되므로 DB 값을 사용한다.
  const text = claimed.transcriptText ?? ''
  if (!text.trim()) {
    // 자막 미준비 — 요약 시도로 소모하지 않도록 claim을 롤백(none + attempts-1)한다.
    await db
      .update(sermonSummaries)
      .set({ summaryStatus: 'none', summaryAttempts: sql`${sermonSummaries.summaryAttempts} - 1` })
      .where(eq(sermonSummaries.sermonId, sermonId))
    return Response.json({ ok: true, skipped: 'no transcript' })
  }
  const status = await summarizeClaimed(claimed.id, claimed.durationSeconds, text, claimed.attempts)
  return Response.json({ ok: true, status })
}
