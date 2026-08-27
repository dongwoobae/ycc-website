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

/**
 * 오디오 변환이 실패했을 때 자동으로 다시 태우는 횟수. 같은 영상이 한 판은 잘리고 다음 판은
 * 끝까지 가는 것을 실측으로 확인했다 — 모델 실패는 판마다 흔들리므로 한 번은 사람 손 없이 회수한다.
 * 재시도 한 번이 4~5분짜리 Gemini 호출을 통째로 다시 돌리므로 그 이상 늘리지 않는다.
 */
export const MAX_AUDIO_TRANSCRIPT_RETRY = 1

/** fetch-audio-transcript 라우트의 maxDuration과 맞춘 값. 짧으면 정상 처리 중인 호출을 실패로 보고 재전달한다. */
const AUDIO_TRANSCRIPT_TIMEOUT_SECONDS = 300

/**
 * 오디오 변환 진행 표시를 언제부터 죽은 것으로 볼지. 함수 상한 300초에 QStash 큐 지연과
 * 자동 재시도 한 판을 얹어도 남는 값이라, 정상 처리 중인 건을 스위퍼가 가로채지 않는다.
 */
export const AUDIO_TRANSCRIPT_STALE_MS = 10 * 60 * 1000

/** 오디오 job이 할 일을 이미 끝냈는지 판정하는 조각. 상관 서브쿼리라 `ss` 별칭을 쓰는 문에서만 유효하다. */
const TRANSCRIPT_EXISTS = sql`EXISTS (
  SELECT 1 FROM sermon_transcripts t
  WHERE t.sermon_id = ss.sermon_id AND t.transcript_text IS NOT NULL
)`

const AUTO_SUMMARY_TYPES_SQL = sql.join(
  autoSummaryTypes.map((t) => sql`${t}`),
  sql`, `,
)

/**
 * 오디오 변환 진입을 DB에 남긴다. Vercel이 300초에서 함수를 끊으면 라우트의 catch가
 * 실행되지 않아 어떤 종결 처리도 일어나지 않는다 — 이 표시가 그 잔류를 남기는 유일한 흔적이고,
 * reclaimStaleAudioTranscripts가 그것을 보고 회수한다.
 *
 * pending에 만료 시각을 함께 찍는 것이 claimSermonById의 pending(만료 시각 없음)과
 * 구분되는 지점이다. 두 표시는 서로의 선점을 건드리지 않는다.
 */
export async function markAudioTranscriptInFlight(sermonId: string, now: Date = new Date()): Promise<void> {
  await db.execute(
    sql`INSERT INTO sermon_summaries (sermon_id) VALUES (${sermonId}) ON CONFLICT (sermon_id) DO NOTHING`,
  )
  // QStash 재전달로 같은 job이 두 번 오면 이미 요약이 끝난 행 위에서 돈다. 자막이 있다는 것은
  // 이 job이 할 일이 남지 않았다는 뜻이라 상태를 건드리지 않는다 — 덮으면 공개 페이지에서
  // ready였던 요약이 사라진다.
  await db.execute(sql`
    UPDATE sermon_summaries ss SET
      summary_status = 'pending',
      summary_next_retry_at = ${new Date(now.getTime() + AUDIO_TRANSCRIPT_STALE_MS).toISOString()}
    WHERE ss.sermon_id = ${sermonId} AND NOT ${TRANSCRIPT_EXISTS}
  `)
}

interface ReclaimOutcome {
  republished: string[]
  gaveUp: string[]
  handedOff: string[]
}

/**
 * 오디오 변환이 강제 종료돼 진행 표시만 남은 건을 회수한다(스위퍼 전용).
 *
 * 회수마다 summary_attempts를 소비하는 이유는 강제 종료가 반복될 때 회수 → 또 종료 →
 * 또 회수로 끝없이 도는 것을 막기 위해서다. 상한을 채웠거나 재발행할 videoId가 없으면
 * no_transcript로 종결한다.
 */
export async function reclaimStaleAudioTranscripts(limit = 10, now: Date = new Date()): Promise<ReclaimOutcome> {
  const nextAt = new Date(now.getTime() + AUDIO_TRANSCRIPT_STALE_MS)
  const staleMarker = sql`
    ss.summary_status = 'pending'
    AND ss.summary_next_retry_at IS NOT NULL
    AND ss.summary_next_retry_at <= ${now.toISOString()}
    AND s.worship_type IN (${AUTO_SUMMARY_TYPES_SQL})
  `

  const bumped = await db.execute(sql`
    WITH picked AS (
      SELECT ss.sermon_id
      FROM sermon_summaries ss
      JOIN sermons s ON s.id = ss.sermon_id
      WHERE ${staleMarker}
        AND NOT ${TRANSCRIPT_EXISTS}
        AND ss.summary_attempts < ${MAX_SUMMARY_ATTEMPTS}
        AND s.youtube_video_id IS NOT NULL
      ORDER BY s.sermon_date DESC
      LIMIT ${limit}
    )
    UPDATE sermon_summaries ss SET
      summary_attempts = ss.summary_attempts + 1,
      summary_next_retry_at = ${nextAt.toISOString()}
    FROM picked, sermons s
    WHERE ss.sermon_id = picked.sermon_id AND s.id = ss.sermon_id
    RETURNING ss.sermon_id AS id, s.youtube_video_id AS "videoId"
  `)

  const exhausted = await db.execute(sql`
    UPDATE sermon_summaries ss SET
      summary_status = 'no_transcript',
      summary_next_retry_at = NULL
    FROM sermons s
    WHERE s.id = ss.sermon_id
      AND ${staleMarker}
      AND NOT ${TRANSCRIPT_EXISTS}
      AND (ss.summary_attempts >= ${MAX_SUMMARY_ATTEMPTS} OR s.youtube_video_id IS NULL)
    RETURNING ss.sermon_id AS id
  `)

  // 자막 저장 직후 진행 표시를 풀기 전에 끊긴 행이다. 오디오 변환은 이미 끝났으니 다시 태우지 않고
  // 표시만 풀어 요약 재시도 경로(selectRetryTargets)가 줍게 넘긴다.
  const handed = await db.execute(sql`
    UPDATE sermon_summaries ss SET
      summary_status = 'none',
      summary_next_retry_at = NULL
    FROM sermons s
    WHERE s.id = ss.sermon_id
      AND ${staleMarker}
      AND ${TRANSCRIPT_EXISTS}
    RETURNING ss.sermon_id AS id
  `)

  const toRows = <T>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows: T[] }).rows ?? []))
  const republished = toRows<{ id: string; videoId: string }>(bumped)
  const gaveUp = toRows<{ id: string }>(exhausted)
  const handedOff = toRows<{ id: string }>(handed)

  for (const row of republished) {
    await publishAudioTranscript(row.id, row.videoId, 0)
  }
  return {
    republished: republished.map((r) => r.id),
    gaveUp: gaveUp.map((r) => r.id),
    handedOff: handedOff.map((r) => r.id),
  }
}

/** 오디오 변환 job 발행. 발행 측이 둘(자막 포기 지점, 실패 후 자동 재시도)이라 옵션을 한 곳에 둔다. */
export async function publishAudioTranscript(sermonId: string, videoId: string, attempt: number): Promise<void> {
  await publishJob('fetch-audio-transcript', { sermonId, videoId, attempt }, 0, {
    // QStash 재전달은 네트워크 사고용이다. 모델이 나쁜 결과를 낸 경우는 attempt로 따로 센다.
    retries: 1,
    timeoutSeconds: AUDIO_TRANSCRIPT_TIMEOUT_SECONDS,
  })
}

/**
 * 오디오 변환 실패를 자동 재시도로 넘기거나 종결한다.
 * 재발행이 실패하면 어떤 job도 이어받지 않으므로 그 자리에서 종결해 상태가 none에 매달리는 것을 막는다.
 */
export async function retryAudioTranscriptOrGiveUp(
  sermonId: string,
  videoId: string,
  attempt: number,
): Promise<'retry' | 'gaveUp'> {
  if (attempt < MAX_AUDIO_TRANSCRIPT_RETRY) {
    try {
      await publishAudioTranscript(sermonId, videoId, attempt + 1)
      return 'retry'
    } catch (e) {
      console.error(`[fetch-audio-transcript] 재시도 발행 실패, 최종 포기 videoId=${videoId}`, e)
      await log('error', 'sermon', sermonId, `오디오 변환 재시도 발행 실패 — 최종 포기: videoId=${videoId}`)
    }
  }
  await db.execute(sql`
    UPDATE sermon_summaries ss SET
      summary_status = 'no_transcript',
      summary_next_retry_at = NULL
    WHERE ss.sermon_id = ${sermonId} AND NOT ${TRANSCRIPT_EXISTS}
  `)
  return 'gaveUp'
}

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
        // failed만 보면 자막을 저장한 직후 summarize 발행 전에 끊긴 행(none에 잔류)을 놓친다.
        inArray(sermonSummaries.summaryStatus, ['none', 'failed']),
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
  // 오디오 진행 표시가 남아 있으면 claimSermonById의 두 분기가 모두 막혀 summarize가
  // 조용히 아무 일도 하지 않는다. 만료 시각으로 이 표시만 골라 푼다 — 만료 시각이 없는
  // pending은 summarize가 잡고 있는 것이라 건드리면 안 된다.
  await db
    .update(sermonSummaries)
    .set({ summaryStatus: 'none', summaryNextRetryAt: null })
    .where(
      and(
        eq(sermonSummaries.sermonId, sermonId),
        eq(sermonSummaries.summaryStatus, 'pending'),
        isNotNull(sermonSummaries.summaryNextRetryAt),
      ),
    )
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
    // summary_generated_at을 남겨 두면 claimSermonById의 stale pending 분기가
    // (IS NULL을 요구해) 죽은 워커를 회수하지 못한다.
    .set({ summaryStatus: 'none', summaryAttempts: 0, summaryNextRetryAt: null, summaryGeneratedAt: null })
    .where(eq(sermonSummaries.sermonId, sermonId))

  if (row.transcriptText?.trim()) {
    await publishJob('summarize', { sermonId })
    return
  }
  // attempt를 상한으로 채워 보내 자막 대기 재시도를 건너뛴다 — RapidAPI를 한 번만 보고
  // 없으면 곧바로 오디오 폴백으로 넘어간다. 관리자가 3시간을 기다릴 이유가 없다.
  await publishJob('fetch-transcript', { sermonId, videoId: row.videoId, attempt: MAX_TRANSCRIPT_RETRY })
}
