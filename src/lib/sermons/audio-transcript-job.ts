import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons, sermonTranscripts } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { publishJob } from '@/lib/qstash'
import {
  readAudioTranscription,
  startAudioTranscription,
  type AudioTranscriptionState,
} from '@/lib/ai/audio-transcript'
import {
  extendAudioTranscriptMarker,
  markAudioTranscriptInFlight,
  publishSummarizeOrMarkFailed,
  retryAudioTranscriptOrGiveUp,
} from './summarize'

export const AUDIO_POLL_INTERVAL_SECONDS = 30
/** 64분 설교가 147초에 끝난 실측의 여러 배다. 넘기면 작업이 멈춘 것으로 본다. */
export const MAX_AUDIO_POLLS = 40

export interface AudioStartPayload {
  sermonId: string
  videoId: string
  attempt?: number
}

/** 작업 상태는 DB가 아니라 이 메시지에 실려 다닌다. */
export interface AudioPollPayload {
  sermonId: string
  videoId: string
  attempt: number
  interactionId: string
  model: string
  startedAt: number
  polls: number
}

async function loadSermon(sermonId: string) {
  const [row] = await db
    .select({ durationSeconds: sermons.durationSeconds, transcriptText: sermonTranscripts.transcriptText })
    .from(sermons)
    .leftJoin(sermonTranscripts, eq(sermonTranscripts.sermonId, sermons.id))
    .where(eq(sermons.id, sermonId))
    .limit(1)
  return row
}

/** 재전달을 한 번 둔다. 조회는 멱등이고, 완료를 두 번 보더라도 자막 유무 검사가 두 번째를 건너뛴다. */
function publishAudioPoll(payload: AudioPollPayload): Promise<void> {
  return publishJob('poll-audio-transcript', payload, AUDIO_POLL_INTERVAL_SECONDS, { retries: 1 })
}

async function failAudioTranscript(
  p: { sermonId: string; videoId: string; attempt: number; startedAt: number },
  error: unknown,
  now: Date,
): Promise<'retry' | 'gaveUp'> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 150)
  const seconds = Math.round((now.getTime() - p.startedAt) / 1000)
  console.error(`[audio-transcript] 오디오 변환 실패 videoId=${p.videoId} attempt=${p.attempt}`, error)
  await log(
    'error',
    'sermon',
    p.sermonId,
    `오디오 변환 실패(시도 ${p.attempt + 1}회 · ${seconds}초): videoId=${p.videoId} ${message}`,
  )
  return retryAudioTranscriptOrGiveUp(p.sermonId, p.videoId, p.attempt)
}

export async function runAudioTranscriptStart(
  p: AudioStartPayload,
  now: Date = new Date(),
): Promise<'skipped' | 'started' | 'retry' | 'gaveUp'> {
  const attempt = p.attempt ?? 0
  const sermon = await loadSermon(p.sermonId)
  if (sermon?.transcriptText?.trim()) return 'skipped'

  await markAudioTranscriptInFlight(p.sermonId, now)
  let started: { interactionId: string; model: string }
  try {
    started = await startAudioTranscription(p.videoId)
  } catch (e) {
    return failAudioTranscript({ ...p, attempt, startedAt: now.getTime() }, e, now)
  }
  await log('update', 'sermon', p.sermonId, `오디오 변환 시작 (시도 ${attempt + 1}회 · ${started.model})`)
  try {
    await publishAudioPoll({
      sermonId: p.sermonId,
      videoId: p.videoId,
      attempt,
      ...started,
      startedAt: now.getTime(),
      polls: 0,
    })
  } catch (e) {
    // 조회 사슬을 잇지 못해도 진행 표시가 만료되면 스위퍼가 시작부터 다시 돌린다.
    console.error(`[audio-transcript] 조회 발행 실패 videoId=${p.videoId}`, e)
    await log('error', 'sermon', p.sermonId, `오디오 변환 조회 발행 실패 — 스위퍼가 다시 시작: videoId=${p.videoId}`)
  }
  return 'started'
}

export async function runAudioTranscriptPoll(
  p: AudioPollPayload,
  now: Date = new Date(),
): Promise<'skipped' | 'running' | 'done' | 'retry' | 'gaveUp'> {
  const sermon = await loadSermon(p.sermonId)
  if (sermon?.transcriptText?.trim()) return 'skipped'

  let result: AudioTranscriptionState
  try {
    result = await readAudioTranscription(p.interactionId, sermon?.durationSeconds ?? null)
  } catch (e) {
    console.error(`[audio-transcript] 조회 실패, 다음 조회로 넘김 interaction=${p.interactionId}`, e)
    result = { state: 'running' }
  }

  if (result.state === 'running') {
    if (p.polls + 1 >= MAX_AUDIO_POLLS) {
      return failAudioTranscript(p, new Error(`${MAX_AUDIO_POLLS}회 조회하는 동안 끝나지 않음`), now)
    }
    await extendAudioTranscriptMarker(p.sermonId, now)
    await publishAudioPoll({ ...p, polls: p.polls + 1 })
    return 'running'
  }
  if (result.state === 'failed') return failAudioTranscript(p, new Error(result.error), now)

  await publishSummarizeOrMarkFailed(p.sermonId, result.segments, p.videoId)
  const seconds = Math.round((now.getTime() - p.startedAt) / 1000)
  await log(
    'update',
    'sermon',
    p.sermonId,
    `오디오 변환 완료 (${seconds}초 · ${p.model} · ${result.segments.length}줄)`,
  )
  return 'done'
}
