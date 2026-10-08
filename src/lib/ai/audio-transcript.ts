import type { TranscriptSegment } from '@/lib/transcript/prompt'
import { GoogleGenAI } from '@google/genai'
import {
  AUDIO_TRANSCRIPT_MODEL,
  AUDIO_TRANSCRIPT_MODEL_GA,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  isModelUnavailableError,
  isTransientGeminiError,
} from './gemini'

const TIMESTAMP_LINE = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*(.*)$/

/** 1시간을 넘는 설교에서 Gemini가 타임스탬프를 [MM:SS] 대신 [H:MM:SS]로 바꿔 쓰는 경우가 실측으로 확인됐다. */
export function parseTimestampedTranscript(raw: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  for (const line of raw.split('\n')) {
    const match = TIMESTAMP_LINE.exec(line.trim())
    if (!match) continue
    const [, timestamp, text] = match
    const trimmedText = text.trim()
    if (!trimmedText) continue
    const parts = timestamp.split(':').map(Number)
    const startSeconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
    segments.push({ startSeconds, text: trimmedText })
  }
  return segments
}

/** 받아쓰기가 영상 길이의 이 비율까지는 닿아야 온전한 것으로 본다. 정상 사례 실측이 99% 대라 여유가 크다. */
export const MIN_TRANSCRIPT_COVERAGE = 0.8

/**
 * 앞부분만 받아쓰고 중단된 원고를 거른다. thinking 예산이 부족하면 모델이 도중에 손을 놓고도
 * finishReason=STOP으로 정상 종료하는 것을 실측으로 확인했으므로, finishReason 검사만으로는 못 막는다.
 * durationSeconds가 없으면 비교 기준이 없어 검사하지 않는다.
 */
export function assertCoversFullAudio(segments: TranscriptSegment[], durationSeconds: number | null): void {
  if (durationSeconds == null || durationSeconds <= 0) return
  const lastSeconds = segments.at(-1)?.startSeconds ?? 0
  const covered = lastSeconds / durationSeconds
  if (covered >= MIN_TRANSCRIPT_COVERAGE) return
  throw new Error(
    `gemini audio transcript stopped early: ${lastSeconds}s of ${durationSeconds}s (${Math.round(covered * 100)}%)`,
  )
}

const AUDIO_TRANSCRIPT_PROMPT = `이 오디오는 한국어 교회 설교 영상입니다. 처음부터 끝까지 발화된 내용을 그대로(요약하거나 생략하지 말고) 한국어로 받아쓰기 하세요.
출력 형식은 반드시 아래와 같이, 각 줄마다 [MM:SS] 타임스탬프로 시작해야 합니다. 타임스탬프는 실제 오디오 재생 시각과 최대한 정확히 일치해야 합니다.

[00:02] 첫 문장 내용
[00:06] 다음 문장 내용
...

다른 설명 없이 이 형식의 받아쓰기 텍스트만 출력하세요.`

/**
 * 기본 프레임 수로 넘기면 64분 설교에서 영상 토큰이 입력의 69%를 차지해 Pro의 20만 토큰 초과 요금 구간으로
 * 넘어간다. 프레임을 거의 빼면(0.001) 타임스탬프가 뒤로 갈수록 몇 분씩 밀린다 — 프레임이 시각 기준점 구실을
 * 한다. 10초에 1장이 둘 다 피하는 값이다. 실측은 2026-10-08-audio-transcript-async-design.md.
 */
export const AUDIO_TRANSCRIPT_FPS = 0.1

export const AUDIO_TRANSCRIPT_MODELS: readonly string[] = [
  AUDIO_TRANSCRIPT_MODEL,
  AUDIO_TRANSCRIPT_MODEL_GA,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
]

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenAI({ apiKey })
}

export function buildAudioTranscriptInput(videoId: string) {
  return [
    { type: 'text' as const, text: AUDIO_TRANSCRIPT_PROMPT },
    {
      type: 'video' as const,
      uri: `https://www.youtube.com/watch?v=${videoId}`,
      processing: { type: 'static' as const, fps: AUDIO_TRANSCRIPT_FPS },
    },
  ]
}

/** 모델 체인은 작업 생성에서만 탄다. 생성은 수 초라 일시 오류·단종을 여기서 걸러 낼 수 있다. */
export async function startAudioTranscription(
  videoId: string,
  models: readonly string[] = AUDIO_TRANSCRIPT_MODELS,
): Promise<{ interactionId: string; model: string }> {
  const ai = client()
  let lastError: unknown
  for (const model of [...new Set(models)]) {
    try {
      const created = await ai.interactions.create({
        model,
        input: buildAudioTranscriptInput(videoId),
        background: true,
      })
      return { interactionId: created.id, model }
    } catch (error) {
      lastError = error
      if (!isTransientGeminiError(error) && !isModelUnavailableError(error)) throw error
    }
  }
  throw lastError
}

interface InteractionLike {
  status?: string
  error?: { message?: string }
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[]
}

/** 받아쓰기는 model_output 단계에만 있다. 입력 단계의 프롬프트 예시 줄이 섞이면 파서가 타임스탬프로 읽는다. */
export function extractInteractionText(interaction: InteractionLike): string {
  return (interaction.steps ?? [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .map((c) => c.text ?? '')
    .join('')
}

export type AudioTranscriptionState =
  { state: 'running' } | { state: 'done'; segments: TranscriptSegment[] } | { state: 'failed'; error: string }

/**
 * Interactions 응답에는 finishReason이 없다. 출력 한도에 걸린 절단은 assertCoversFullAudio가 잡는다.
 * 조회 요청 자체의 오류는 던진다 — 호출부가 진행 중과 같게 다룬다.
 */
export async function readAudioTranscription(
  interactionId: string,
  durationSeconds: number | null,
): Promise<AudioTranscriptionState> {
  const interaction = (await client().interactions.get(interactionId)) as InteractionLike
  if (interaction.status === 'in_progress') return { state: 'running' }
  if (interaction.status !== 'completed') {
    return { state: 'failed', error: `interaction ${interaction.status}: ${interaction.error?.message ?? ''}`.trim() }
  }
  const text = extractInteractionText(interaction)
  if (!text.trim()) return { state: 'failed', error: 'gemini returned empty audio transcript' }
  const segments = parseTimestampedTranscript(text)
  try {
    assertCoversFullAudio(segments, durationSeconds)
  } catch (e) {
    return { state: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
  return { state: 'done', segments }
}

/** 함수 시간 상한이 없는 로컬 스크립트용. 라우트는 시작·조회 job으로 나눠 쓴다(audio-transcript-job.ts). */
export async function transcribeFromAudio(
  videoId: string,
  durationSeconds: number | null,
  { pollMs = 15_000, maxPolls = 80 }: { pollMs?: number; maxPolls?: number } = {},
): Promise<TranscriptSegment[]> {
  const { interactionId } = await startAudioTranscription(videoId)
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollMs))
    const result = await readAudioTranscription(interactionId, durationSeconds)
    if (result.state === 'done') return result.segments
    if (result.state === 'failed') throw new Error(result.error)
  }
  throw new Error(`gemini audio transcript still running after ${maxPolls} polls`)
}
