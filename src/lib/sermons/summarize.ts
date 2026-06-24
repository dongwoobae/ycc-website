import { and, desc, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { generateSermonSummary, DEFAULT_GEMINI_MODEL } from '@/lib/ai/sermon-summary'
import { fetchTranscript } from '@/lib/transcript/rapidapi'
import { buildTranscriptText } from '@/lib/transcript/prompt'
import { autoSummaryTypes } from '@/lib/worship'

export const MAX_SUMMARY_ATTEMPTS = 3
export const STALE_PENDING_MS = 10 * 60 * 1000

export function computeNextRetry(attempts: number, now: Date): Date {
  const minutes = 5 * Math.pow(3, Math.max(0, attempts - 1))
  return new Date(now.getTime() + minutes * 60 * 1000)
}

export interface RetryTarget {
  id: string
}

/**
 * 요약(Gemini) 단계에서 실패한 설교를 재시도 대상으로 고른다(스케줄 스위퍼용).
 * - 자동요약 예배유형, status='failed', 자막(transcript_text)이 이미 캐시된 건만
 *   → 자막 단계 영구실패(자막 없음)는 제외해 fetch 무한반복/쿼터소진을 막는다.
 * - summary_attempts < MAX (횟수 소진분 제외) AND next_retry 비었거나 경과 (백오프 존중)
 * 실제 요약 중복은 claimSermonById가 차단하므로 여기선 단순 후보 선별만 한다.
 */
export async function selectRetryTargets(limit = 10, now: Date = new Date()): Promise<RetryTarget[]> {
  return db
    .select({ id: sermons.id })
    .from(sermons)
    .where(
      and(
        eq(sermons.summaryStatus, 'failed'),
        isNotNull(sermons.transcriptText),
        inArray(sermons.worshipType, [...autoSummaryTypes]),
        lt(sermons.summaryAttempts, MAX_SUMMARY_ATTEMPTS),
        or(isNull(sermons.summaryNextRetryAt), lte(sermons.summaryNextRetryAt, now)),
      ),
    )
    .orderBy(desc(sermons.sermonDate))
    .limit(limit)
}

interface ClaimedSermon {
  id: string
  durationSeconds: number | null
  transcriptText: string | null
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
    RETURNING id, duration_seconds AS "durationSeconds", transcript_text AS "transcriptText"
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as ClaimedSermon | undefined) ?? null
}

export async function forceClaimSermonById(id: string): Promise<ClaimedSermon | null> {
  const result = await db.execute(sql`
    UPDATE sermons SET
      summary_status = 'pending',
      summary_attempts = summary_attempts + 1,
      summary_next_retry_at = NULL
    WHERE id = ${id}
    RETURNING id, duration_seconds AS "durationSeconds", transcript_text AS "transcriptText"
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as ClaimedSermon | undefined) ?? null
}

export async function fetchAndStoreTranscript(sermonId: string, videoId: string): Promise<string> {
  const segments = await fetchTranscript(videoId)
  if (segments.length === 0) throw new Error('자막 미준비')
  const transcriptText = buildTranscriptText(segments)
  await db
    .update(sermons)
    .set({ transcriptText, transcriptFetchedAt: new Date() })
    .where(eq(sermons.id, sermonId))
  return transcriptText
}

export async function summarizeClaimed(
  id: string,
  durationSeconds: number | null,
  transcriptText: string
): Promise<'ready' | 'failed'> {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
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
    .select({
      id: sermons.id,
      youtubeVideoId: sermons.youtubeVideoId,
      durationSeconds: sermons.durationSeconds,
      transcriptText: sermons.transcriptText,
    })
    .from(sermons)
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row || !row.youtubeVideoId) throw new Error('sermon not found or has no YouTube video id')

  const transcriptText = row.transcriptText?.trim() || (await fetchAndStoreTranscript(row.id, row.youtubeVideoId))

  const claimed = await forceClaimSermonById(row.id)
  if (!claimed) throw new Error('summary is not claimable')
  return summarizeClaimed(claimed.id, claimed.durationSeconds, transcriptText)
}
