import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { generateSermonSummary } from '@/lib/ai/sermon-summary'

export const MAX_SUMMARY_ATTEMPTS = 3
export const STALE_PENDING_MS = 10 * 60 * 1000

export function computeNextRetry(attempts: number, now: Date): Date {
  const minutes = 5 * Math.pow(3, Math.max(0, attempts - 1))
  return new Date(now.getTime() + minutes * 60 * 1000)
}

interface ClaimedSermon {
  id: string
  videoUrl: string
  durationSeconds: number | null
}

export async function claimNextSermon(now: Date = new Date()): Promise<ClaimedSermon | null> {
  const staleBefore = new Date(now.getTime() - STALE_PENDING_MS)
  const result = await db.execute(sql`
    UPDATE sermons SET
      summary_status = 'pending',
      summary_attempts = summary_attempts + 1
    WHERE id = (
      SELECT id FROM sermons
      WHERE video_url IS NOT NULL
        AND summary_attempts < ${MAX_SUMMARY_ATTEMPTS}
        AND (
          (summary_status IN ('none', 'failed')
            AND (summary_next_retry_at IS NULL OR summary_next_retry_at <= ${now.toISOString()}))
          OR (summary_status = 'pending' AND summary_generated_at IS NULL
            AND summary_next_retry_at IS NULL AND created_at <= ${staleBefore.toISOString()})
        )
      ORDER BY sermon_date DESC
      LIMIT 1
    )
    RETURNING id, video_url AS "videoUrl", duration_seconds AS "durationSeconds"
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as ClaimedSermon | undefined) ?? null
}

export async function processClaimedSermon(row: ClaimedSermon): Promise<'ready' | 'failed'> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'
  try {
    const result = await generateSermonSummary(row.videoUrl, row.durationSeconds)
    await db
      .update(sermons)
      .set({
        summary: result.summary,
        quickSummary: result.quickSummary,
        chapters: result.chapters,
        summaryStatus: 'ready',
        summaryGeneratedAt: new Date(),
        summaryNextRetryAt: null,
        summaryModel: model,
      })
      .where(eq(sermons.id, row.id))
    return 'ready'
  } catch (e) {
    console.error(`[summarize] ${row.id} failed`, e)
    await db
      .update(sermons)
      .set({
        summaryStatus: 'failed',
        summaryNextRetryAt: computeNextRetry(MAX_SUMMARY_ATTEMPTS, new Date()),
      })
      .where(eq(sermons.id, row.id))
    return 'failed'
  }
}

export async function runSummaryWorker(limit: number): Promise<{ processed: number }> {
  let processed = 0
  for (let i = 0; i < limit; i++) {
    const claimed = await claimNextSermon()
    if (!claimed) break
    await processClaimedSermon(claimed)
    processed++
  }
  return { processed }
}

export async function generateSummaryForSermon(id: string): Promise<'ready' | 'failed'> {
  const [row] = await db
    .select({ id: sermons.id, videoUrl: sermons.videoUrl, durationSeconds: sermons.durationSeconds })
    .from(sermons)
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row || !row.videoUrl) throw new Error('sermon not found or has no video')
  await db.update(sermons).set({ summaryStatus: 'pending' }).where(eq(sermons.id, id))
  return processClaimedSermon({ id: row.id, videoUrl: row.videoUrl, durationSeconds: row.durationSeconds })
}
