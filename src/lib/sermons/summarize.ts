import { and, desc, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons, sermonSummaries, sermonTranscripts } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { generateSermonSummary, DEFAULT_GEMINI_MODEL } from '@/lib/ai/sermon-summary'
import { publishJob } from '@/lib/qstash'
import { fetchTranscript } from '@/lib/transcript/rapidapi'
import { transcribeFromAudio } from '@/lib/ai/audio-transcript'
import { buildTranscriptText, type TranscriptSegment } from '@/lib/transcript/prompt'
import { autoSummaryTypes } from '@/lib/worship'

export const MAX_SUMMARY_ATTEMPTS = 3
export const STALE_PENDING_MS = 10 * 60 * 1000

/** fetch-transcript job이 자막을 기다리며 30분 간격으로 재발행하는 상한. 소진하면 오디오 폴백으로 넘어간다. */
export const MAX_TRANSCRIPT_RETRY = 6

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
    .innerJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
    .leftJoin(sermonTranscripts, eq(sermonTranscripts.sermonId, sermons.id))
    .where(
      and(
        eq(sermonSummaries.summaryStatus, 'failed'),
        isNotNull(sermonTranscripts.transcriptText),
        inArray(sermons.worshipType, [...autoSummaryTypes]),
        lt(sermonSummaries.summaryAttempts, MAX_SUMMARY_ATTEMPTS),
        or(isNull(sermonSummaries.summaryNextRetryAt), lte(sermonSummaries.summaryNextRetryAt, now)),
      ),
    )
    .orderBy(desc(sermons.sermonDate))
    .limit(limit)
}

interface ClaimedSermon {
  id: string
  durationSeconds: number | null
  transcriptText: string | null
  attempts: number
}

export async function claimSermonById(id: string, now: Date = new Date()): Promise<ClaimedSermon | null> {
  const staleBefore = new Date(now.getTime() - STALE_PENDING_MS)
  await db.execute(sql`INSERT INTO sermon_summaries (sermon_id) VALUES (${id}) ON CONFLICT (sermon_id) DO NOTHING`)
  const result = await db.execute(sql`
    WITH claimed AS (
      UPDATE sermon_summaries SET
        summary_status = 'pending',
        summary_attempts = summary_attempts + 1
      WHERE sermon_id = ${id}
        AND summary_attempts < ${MAX_SUMMARY_ATTEMPTS}
        AND (
          (summary_status IN ('none', 'failed')
            AND (summary_next_retry_at IS NULL OR summary_next_retry_at <= ${now.toISOString()}))
          OR (summary_status = 'pending' AND summary_generated_at IS NULL
            AND summary_next_retry_at IS NULL AND created_at <= ${staleBefore.toISOString()})
        )
      RETURNING sermon_id, summary_attempts
    )
    SELECT s.id, s.duration_seconds AS "durationSeconds", t.transcript_text AS "transcriptText",
           c.summary_attempts AS "attempts"
    FROM claimed c
    JOIN sermons s ON s.id = c.sermon_id
    LEFT JOIN sermon_transcripts t ON t.sermon_id = c.sermon_id
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as ClaimedSermon | undefined) ?? null
}

export async function forceClaimSermonById(id: string): Promise<ClaimedSermon | null> {
  await db.execute(sql`INSERT INTO sermon_summaries (sermon_id) VALUES (${id}) ON CONFLICT (sermon_id) DO NOTHING`)
  const result = await db.execute(sql`
    WITH claimed AS (
      UPDATE sermon_summaries SET
        summary_status = 'pending',
        summary_attempts = summary_attempts + 1,
        summary_next_retry_at = NULL
      WHERE sermon_id = ${id}
      RETURNING sermon_id, summary_attempts
    )
    SELECT s.id, s.duration_seconds AS "durationSeconds", t.transcript_text AS "transcriptText",
           c.summary_attempts AS "attempts"
    FROM claimed c
    JOIN sermons s ON s.id = c.sermon_id
    LEFT JOIN sermon_transcripts t ON t.sermon_id = c.sermon_id
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as ClaimedSermon | undefined) ?? null
}

/** 이미 받은 자막 세그먼트를 위성 테이블(sermon_transcripts)에 upsert한다. */
export async function storeTranscript(sermonId: string, segments: TranscriptSegment[]): Promise<string> {
  const transcriptText = buildTranscriptText(segments)
  const fetchedAt = new Date()
  await db
    .insert(sermonTranscripts)
    .values({ sermonId, transcriptText, transcriptFetchedAt: fetchedAt })
    .onConflictDoUpdate({
      target: sermonTranscripts.sermonId,
      set: { transcriptText, transcriptFetchedAt: fetchedAt },
    })
  return transcriptText
}

/**
 * audioFallback을 켜면 이 호출은 4~5분 블로킹한다 — 실행시간 예산이 있는 경로에서는 켜지 마라.
 * durationSeconds는 받아쓰기가 중간에 끊겼는지 검사하는 기준이다(`assertCoversFullAudio`).
 * 근거는 docs/specs/2026-08-25-sermon-audio-fallback-design.md 참고.
 */
export async function fetchAndStoreTranscript(
  sermonId: string,
  videoId: string,
  options: { audioFallback?: { durationSeconds: number | null } } = {},
): Promise<string> {
  const segments = await fetchTranscript(videoId)
  if (segments.length > 0) return storeTranscript(sermonId, segments)
  if (!options.audioFallback) throw new Error('자막 미준비')

  const audioSegments = await transcribeFromAudio(videoId, options.audioFallback.durationSeconds)
  if (audioSegments.length === 0) throw new Error('자막 미준비')
  return storeTranscript(sermonId, audioSegments)
}

/** 자막을 저장하고 summarize job을 발행한다. 발행 자체가 실패하면(자막은 이미 캐시됨) failed로 마킹해 매시간 스위퍼가 재시도하게 한다. */
export async function publishSummarizeOrMarkFailed(
  sermonId: string,
  segments: TranscriptSegment[],
  videoId: string,
): Promise<void> {
  await storeTranscript(sermonId, segments)
  try {
    await publishJob('summarize', { sermonId })
  } catch (e) {
    console.error(`[transcript] summarize 발행 실패 — 스위퍼 재시도로 인계 videoId=${videoId}`, e)
    await log('error', 'sermon', sermonId, `summarize 발행 실패 — 매시간 스위퍼가 재시도: videoId=${videoId}`)
    await db.update(sermonSummaries).set({ summaryStatus: 'failed' }).where(eq(sermonSummaries.sermonId, sermonId))
  }
}

export async function summarizeClaimed(
  id: string,
  durationSeconds: number | null,
  transcriptText: string,
  attempts: number,
): Promise<'ready' | 'failed'> {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
  try {
    const result = await generateSermonSummary(transcriptText, durationSeconds)
    await db
      .update(sermonSummaries)
      .set({
        summary: result.summary,
        quickSummary: result.quickSummary,
        chapters: result.chapters,
        summaryStatus: 'ready',
        summaryGeneratedAt: new Date(),
        summaryNextRetryAt: null,
        summaryModel: result.model ?? model,
      })
      .where(eq(sermonSummaries.sermonId, id))
    console.log(`[summarize] AI 요약 완료 sermonId=${id} (시도 ${attempts}회, model=${result.model ?? model})`)
    await log('update', 'sermon', id, `AI 요약 완료 (시도 ${attempts}회)`)
    return 'ready'
  } catch (e) {
    console.error(`[summarize] ${id} failed`, e)
    await log(
      'error',
      'sermon',
      id,
      `AI 요약 실패 (시도 ${attempts}회): ${e instanceof Error ? e.message.slice(0, 150) : String(e).slice(0, 150)}`,
    )
    await db
      .update(sermonSummaries)
      .set({
        summaryStatus: 'failed',
        summaryNextRetryAt: computeNextRetry(attempts, new Date()),
      })
      .where(eq(sermonSummaries.sermonId, id))
    return 'failed'
  }
}

export async function manualSummarize(id: string): Promise<'ready' | 'failed'> {
  const [row] = await db
    .select({
      id: sermons.id,
      youtubeVideoId: sermons.youtubeVideoId,
      durationSeconds: sermons.durationSeconds,
      transcriptText: sermonTranscripts.transcriptText,
    })
    .from(sermons)
    .leftJoin(sermonTranscripts, eq(sermonTranscripts.sermonId, sermons.id))
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row || !row.youtubeVideoId) throw new Error('sermon not found or has no YouTube video id')

  const transcriptText =
    row.transcriptText?.trim() ||
    (await fetchAndStoreTranscript(row.id, row.youtubeVideoId, {
      audioFallback: { durationSeconds: row.durationSeconds },
    }))

  const claimed = await forceClaimSermonById(row.id)
  if (!claimed) throw new Error('summary is not claimable')
  return summarizeClaimed(claimed.id, claimed.durationSeconds, transcriptText, claimed.attempts)
}

/**
 * 관리자 "요약 재생성"의 진입점. 실제 작업은 자동 파이프라인 job에 넘기고 즉시 반환한다 —
 * 오디오 폴백까지 타는 경우 받아쓰기와 요약을 합치면 Vercel 함수 1회 예산(300초)을 넘긴다.
 * 상태 초기화는 job이 claimSermonById를 통과하게 만드는 장치다: 종결 상태(no_transcript)나
 * 시도를 소진한 행도 이 초기화 덕분에 별도 분기 없이 재투입된다.
 */
export async function requestSummaryRegeneration(sermonId: string): Promise<void> {
  const [row] = await db
    .select({ videoId: sermons.youtubeVideoId, transcriptText: sermonTranscripts.transcriptText })
    .from(sermons)
    .leftJoin(sermonTranscripts, eq(sermonTranscripts.sermonId, sermons.id))
    .where(eq(sermons.id, sermonId))
    .limit(1)
  if (!row?.videoId) throw new Error('sermon not found or has no YouTube video id')

  await db.execute(
    sql`INSERT INTO sermon_summaries (sermon_id) VALUES (${sermonId}) ON CONFLICT (sermon_id) DO NOTHING`,
  )
  await db
    .update(sermonSummaries)
    .set({ summaryStatus: 'none', summaryAttempts: 0, summaryNextRetryAt: null })
    .where(eq(sermonSummaries.sermonId, sermonId))

  if (row.transcriptText?.trim()) {
    await publishJob('summarize', { sermonId })
    return
  }
  // attempt를 상한으로 채워 보내 자막 대기 재시도를 건너뛴다 — RapidAPI를 한 번만 보고
  // 없으면 곧바로 오디오 폴백으로 넘어간다. 관리자가 3시간을 기다릴 이유가 없다.
  await publishJob('fetch-transcript', { sermonId, videoId: row.videoId, attempt: MAX_TRANSCRIPT_RETRY })
}
