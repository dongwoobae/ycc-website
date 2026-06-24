import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { generateSermonSummary } from '@/lib/ai/sermon-summary'
import { fetchTranscript } from '@/lib/transcript/rapidapi'
import { buildTranscriptText } from '@/lib/transcript/prompt'

export const MAX_SUMMARY_ATTEMPTS = 3
export const STALE_PENDING_MS = 10 * 60 * 1000

export function computeNextRetry(attempts: number, now: Date): Date {
  const minutes = 5 * Math.pow(3, Math.max(0, attempts - 1))
  return new Date(now.getTime() + minutes * 60 * 1000)
}

interface ClaimedSermon {
  id: string
  durationSeconds: number | null
}

export async function claimSermonById(id: string, now: Date = new Date()): Promise<ClaimedSermon | null> {
  const staleBefore = new Date(now.getTime() - STALE_PENDING_MS)
  const result = await db.execute(sql`
    UPDATE sermons SET
      summary_status = 'pending',
      summary_attempts = summary_attempts + 1
    WHERE id = ${id}
      AND summary_attempts < ${MAX_SUMMARY_ATTEMPTS}
      AND (
        (summary_status IN ('none', 'failed')
          AND (summary_next_retry_at IS NULL OR summary_next_retry_at <= ${now.toISOString()}))
        OR (summary_status = 'pending' AND summary_generated_at IS NULL
          AND summary_next_retry_at IS NULL AND created_at <= ${staleBefore.toISOString()})
      )
    RETURNING id, duration_seconds AS "durationSeconds"
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as ClaimedSermon | undefined) ?? null
}

export async function summarizeClaimed(
  id: string,
  durationSeconds: number | null,
  transcriptText: string
): Promise<'ready' | 'failed'> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'
  try {
    const result = await generateSermonSummary(transcriptText, durationSeconds)
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
      .where(eq(sermons.id, id))
    return 'ready'
  } catch (e) {
    console.error(`[summarize] ${id} failed`, e)
    await db
      .update(sermons)
      .set({
        summaryStatus: 'failed',
        summaryNextRetryAt: computeNextRetry(MAX_SUMMARY_ATTEMPTS, new Date()),
      })
      .where(eq(sermons.id, id))
    return 'failed'
  }
}

export async function manualSummarize(id: string): Promise<'ready' | 'failed'> {
  const [row] = await db
    .select({ id: sermons.id, youtubeVideoId: sermons.youtubeVideoId, durationSeconds: sermons.durationSeconds })
    .from(sermons)
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row || !row.youtubeVideoId) throw new Error('sermon not found or has no YouTube video id')

  const segments = await fetchTranscript(row.youtubeVideoId)
  if (segments.length === 0) throw new Error('자막 미준비')

  const claimed = await claimSermonById(row.id)
  if (!claimed) throw new Error('summary is not claimable')
  return summarizeClaimed(claimed.id, claimed.durationSeconds, buildTranscriptText(segments))
}
