# 오디오 받아쓰기 비동기 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자막 없는 설교의 오디오 받아쓰기가 Vercel 300초 상한에 걸려 요약이 멈추는 문제를 없앤다.

**Architecture:** Gemini Interactions API `background: true`로 받아쓰기 작업을 만들고(시작 job), QStash 지연 메시지로 30초마다 결과를 조회한다(조회 job). 입력은 fps 0.001로 프레임을 사실상 뺀다. 오디오 회수와 요약 선점이 같은 시도 횟수를 쓰던 결함은 자막 저장 시 횟수를 0으로 되돌려 끊는다.

**Tech Stack:** Next.js 16 route handlers, `@google/genai` 2.9.0 (`ai.interactions.create/get`), Upstash QStash, Drizzle + PGlite(통합 테스트), Vitest

**Spec:** `docs/specs/2026-10-08-audio-transcript-async-design.md`

## Global Constraints

- 시작 job QStash 재전달 0회, 조회 job 1회
- 조회 간격 30초, 상한 40회
- `AUDIO_ONLY_FPS = 0.001`
- `MAX_TRANSCRIPT_RETRY = 2`
- 로그 문구: `AI 요약 완료 (시도 N회 · S초 · 모델)`, `AI 요약 실패 (시도 N회 · S초): …`, `오디오 변환 시작 (시도 N회 · 모델)`, `오디오 변환 완료 (S초 · 모델 · L줄)`, `오디오 변환 실패(시도 N회 · S초): videoId=… …`
- 주석은 WHY·외부 제약·위험만. 다른 파일의 상수 값·줄 번호를 주석에 쓰지 않는다
- 커밋 메시지에 리뷰·점검 과정이나 AI 서명을 쓰지 않는다
- 테스트: `npx vitest run <path>`. 통합 테스트는 PGlite라 로컬에서 돈다

---

### Task 1: 자막 저장 시 시도 횟수를 되돌리고 선점 거절을 드러낸다

**Files:**

- Modify: `src/lib/sermons/summarize.ts` (`publishSummarizeOrMarkFailed`, `reclaimStaleAudioTranscripts`의 인계 UPDATE, 신규 `warnIfSummaryAttemptsExhausted`)
- Modify: `src/app/api/jobs/summarize/route.ts`
- Test: `src/lib/sermons/summarize.integration.test.ts`

**Interfaces:**

- Produces: `warnIfSummaryAttemptsExhausted(sermonId: string): Promise<boolean>`

- [ ] **Step 1: 실패하는 테스트 작성** — `summarize.integration.test.ts` 끝에 추가. `appLogs`를 schema import에 더한다.

```ts
describe('자막 확보 시 시도 횟수 초기화 (integration)', () => {
  it('오디오 회수로 횟수를 다 쓴 뒤 자막이 들어와도 요약을 선점할 수 있다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'pending',
      summaryAttempts: MAX_SUMMARY_ATTEMPTS,
      summaryNextRetryAt: new Date(Date.now() + 60_000),
    })
    await publishSummarizeOrMarkFailed(id, [{ startSeconds: 0, text: '받아쓰기' }], 'vid')
    const claimed = await claimSermonById(id)
    expect(claimed?.attempts).toBe(1)
  })

  it('스위퍼가 자막 있는 잔류를 인계할 때도 횟수를 되돌린다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'pending',
      summaryAttempts: MAX_SUMMARY_ATTEMPTS,
      summaryNextRetryAt: new Date(Date.now() - 60_000),
      transcriptText: '[00:00] 말씀',
    })
    const out = await reclaimStaleAudioTranscripts()
    expect(out.handedOff).toContain(id)
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryAttempts).toBe(0)
    expect((await selectRetryTargets()).map((t) => t.id)).toContain(id)
  })
})

describe('warnIfSummaryAttemptsExhausted (integration)', () => {
  it('횟수를 다 쓴 none 행이면 경고를 남긴다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'none',
      summaryAttempts: MAX_SUMMARY_ATTEMPTS,
    })
    expect(await warnIfSummaryAttemptsExhausted(id)).toBe(true)
    const logs = await h.db.select().from(appLogs).where(eq(appLogs.entityId, id))
    expect(logs.map((l) => l.action)).toContain('warning')
  })

  it('다른 선점이 잡고 있는 행은 정상 거절이라 남기지 않는다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'pending',
      summaryAttempts: 1,
      summaryClaimedAt: new Date(),
    })
    expect(await warnIfSummaryAttemptsExhausted(id)).toBe(false)
  })
})
```

`warnIfSummaryAttemptsExhausted`를 파일 상단 동적 import 목록에 추가한다.

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/sermons/summarize.integration.test.ts` → 새 테스트 4개 FAIL(`claimed`가 null, 인계 후 횟수 3, 함수 없음).

- [ ] **Step 3: 구현** — `publishSummarizeOrMarkFailed`의 표시 해제 UPDATE에 `summaryAttempts: 0`을 더하고, 기존 주석 뒤에 이유를 한 줄 붙인다.

```ts
// 시도 횟수도 되돌린다. 스위퍼의 오디오 회수가 같은 횟수를 소비해, 세 번째 회수에서 받아쓰기가
// 성공하면 요약 선점이 상한에 막혀 아무도 다시 발행하지 않는다(2026-10-04).
await db.update(sermonSummaries).set({ summaryStatus: 'none', summaryNextRetryAt: null, summaryAttempts: 0 })
```

`reclaimStaleAudioTranscripts`의 `handed` UPDATE에 `summary_attempts = 0,`을 더한다. `selectRetryTargets` 위에 새 함수:

```ts
/** 선점이 횟수 상한에 막힌 행을 로그로 드러낸다. 중복 전달로 인한 거절(pending·ready)은 정상이라 남기지 않는다. */
export async function warnIfSummaryAttemptsExhausted(sermonId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: sermonSummaries.summaryStatus, attempts: sermonSummaries.summaryAttempts })
    .from(sermonSummaries)
    .where(eq(sermonSummaries.sermonId, sermonId))
    .limit(1)
  if (!row || !['none', 'failed'].includes(row.status) || row.attempts < MAX_SUMMARY_ATTEMPTS) return false
  await log('warning', 'sermon', sermonId, `요약 시도 ${row.attempts}회 소진으로 건너뜀 — 관리자 요약 재생성 필요`)
  return true
}
```

`summarize/route.ts`:

```ts
const claimed = await claimSermonById(sermonId)
if (!claimed) {
  await warnIfSummaryAttemptsExhausted(sermonId)
  return Response.json({ ok: true, skipped: 'not claimable' })
}
```

- [ ] **Step 4: 통과 확인** — 같은 명령으로 전체 PASS. 기존 인계 테스트(`hands a stale row that already has a transcript over…`)가 횟수를 단언하면 새 동작에 맞게 고친다.

- [ ] **Step 5: 커밋** — `fix: 자막이 들어오면 요약 시도 횟수를 되돌리고 소진된 선점 거절을 로그로 남긴다`

---

### Task 2: 요약 소요 시간과 모델을 로그에 남긴다

**Files:**

- Modify: `src/lib/sermons/summarize.ts` (`summarizeClaimed`)
- Test: `src/lib/sermons/summarize.integration.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `summarizeClaimed (integration)` describe에 추가.

```ts
it('완료 로그에 시도 횟수·소요 초·모델을 남긴다', async () => {
  const id = await insertSermonFixture(h.db, { withSummaryRow: true })
  await summarizeClaimed(id, 600, '[00:00] 말씀', 1)
  const logs = await h.db.select().from(appLogs).where(eq(appLogs.entityId, id))
  expect(logs.map((l) => l.message)).toContainEqual(expect.stringMatching(/^AI 요약 완료 \(시도 1회 · \d+초 · \S+\)$/))
})
```

- [ ] **Step 2: 실패 확인** — 기존 문구 `AI 요약 완료 (시도 1회)`라 FAIL.

- [ ] **Step 3: 구현**

```ts
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
  const startedAt = Date.now()
  const elapsed = () => Math.round((Date.now() - startedAt) / 1000)
  try {
    const result = await generateSermonSummary(transcriptText, durationSeconds)
    const usedModel = result.model ?? model
    // (UPDATE는 summaryModel: usedModel 로 바꾸는 것 외 그대로)
    console.log(`[summarize] AI 요약 완료 sermonId=${id} (시도 ${attempts}회, ${elapsed()}초, model=${usedModel})`)
    await log('update', 'sermon', id, `AI 요약 완료 (시도 ${attempts}회 · ${elapsed()}초 · ${usedModel})`)
    return 'ready'
  } catch (e) {
    console.error(`[summarize] ${id} failed`, e)
    await log('error', 'sermon', id, `AI 요약 실패 (시도 ${attempts}회 · ${elapsed()}초): ${e instanceof Error ? e.message.slice(0, 150) : String(e).slice(0, 150)}`)
```

`rg -n "AI 요약 완료|AI 요약 실패" src` 로 이 문구를 파싱하는 곳이 없는지 확인한다.

- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat: 요약 로그에 소요 시간과 모델을 남긴다`

---

### Task 3: 받아쓰기를 Interactions background 작업으로 바꾼다

**Files:**

- Modify: `src/lib/ai/audio-transcript.ts`
- Test: `src/lib/ai/audio-transcript.test.ts`

**Interfaces:**

- Produces:
  - `AUDIO_ONLY_FPS = 0.001`, `AUDIO_TRANSCRIPT_MODELS: readonly string[]`
  - `buildAudioTranscriptInput(videoId: string)` → Interactions input 배열
  - `startAudioTranscription(videoId: string, models?: readonly string[]): Promise<{ interactionId: string; model: string }>`
  - `extractInteractionText(interaction: { steps?: … }): string`
  - `type AudioTranscriptionState = { state: 'running' } | { state: 'done'; segments: TranscriptSegment[] } | { state: 'failed'; error: string }`
  - `readAudioTranscription(interactionId: string, durationSeconds: number | null): Promise<AudioTranscriptionState>` — 조회 자체의 네트워크 오류는 throw
  - `transcribeFromAudio(videoId, durationSeconds, options?: { pollMs?: number; maxPolls?: number }): Promise<TranscriptSegment[]>` — 시그니처 유지(로컬 스크립트 경로)

- [ ] **Step 1: 실패하는 테스트** — 기존 파서·길이 검사 테스트는 두고 파일 상단에 SDK 목과 새 describe를 더한다.

```ts
const { create, get } = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn() }))
vi.mock('@google/genai', () => ({ GoogleGenAI: vi.fn(() => ({ interactions: { create, get } })) }))

const output = (text: string) => ({
  status: 'completed',
  steps: [
    { type: 'user_input', content: [{ type: 'text', text: '프롬프트 [00:01] 섞이면 안 됨' }] },
    { type: 'thought', signature: 'x' },
    { type: 'model_output', content: [{ type: 'text', text }] },
  ],
})

describe('startAudioTranscription', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    create.mockReset()
    get.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('프레임을 뺀 background 작업을 첫 모델로 만든다', async () => {
    create.mockResolvedValue({ id: 'int-1', status: 'in_progress' })
    const out = await startAudioTranscription('vid')
    expect(out).toEqual({ interactionId: 'int-1', model: AUDIO_TRANSCRIPT_MODELS[0] })
    const params = create.mock.calls[0][0]
    expect(params.background).toBe(true)
    expect(params.input[1]).toEqual({
      type: 'video',
      uri: 'https://www.youtube.com/watch?v=vid',
      processing: { type: 'static', fps: AUDIO_ONLY_FPS },
    })
  })

  it('생성 단계의 404·503은 다음 모델로 넘긴다', async () => {
    create
      .mockRejectedValueOnce({ status: 404 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ id: 'int-3' })
    const out = await startAudioTranscription('vid', ['a', 'b', 'c'])
    expect(out).toEqual({ interactionId: 'int-3', model: 'c' })
  })

  it('그 밖의 오류는 바로 던진다', async () => {
    create.mockRejectedValue({ status: 400 })
    await expect(startAudioTranscription('vid', ['a', 'b'])).rejects.toMatchObject({ status: 400 })
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('readAudioTranscription', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    get.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('진행 중이면 running', async () => {
    get.mockResolvedValue({ status: 'in_progress' })
    expect(await readAudioTranscription('int', 100)).toEqual({ state: 'running' })
  })

  it('끝까지 받아쓴 결과는 model_output만 파싱한다', async () => {
    get.mockResolvedValue(output('[00:00] 시작\n[01:35] 끝'))
    expect(await readAudioTranscription('int', 100)).toEqual({
      state: 'done',
      segments: [
        { startSeconds: 0, text: '시작' },
        { startSeconds: 95, text: '끝' },
      ],
    })
  })

  it('앞부분만 받아쓴 결과는 실패로 본다', async () => {
    get.mockResolvedValue(output('[00:00] 시작\n[00:10] 중단'))
    const out = await readAudioTranscription('int', 100)
    expect(out).toMatchObject({ state: 'failed', error: expect.stringContaining('stopped early') })
  })

  it('작업이 failed면 실패로 본다', async () => {
    get.mockResolvedValue({ status: 'failed', error: { message: 'boom' } })
    expect(await readAudioTranscription('int', 100)).toMatchObject({
      state: 'failed',
      error: expect.stringContaining('boom'),
    })
  })
})

describe('transcribeFromAudio', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'k')
    create.mockReset()
    get.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('끝날 때까지 조회해 세그먼트를 돌려준다', async () => {
    create.mockResolvedValue({ id: 'int' })
    get.mockResolvedValueOnce({ status: 'in_progress' }).mockResolvedValueOnce(output('[00:00] 시작\n[01:35] 끝'))
    const segments = await transcribeFromAudio('vid', 100, { pollMs: 0 })
    expect(segments).toHaveLength(2)
    expect(get).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/ai/audio-transcript.test.ts` → import 실패로 FAIL.

- [ ] **Step 3: 구현** — `audio-transcript.ts`에서 `undici` dispatcher·`generateContentWithFallback`·`FinishReason` 경로를 지우고 다음으로 바꾼다. 파서·`assertCoversFullAudio`·프롬프트는 그대로.

```ts
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

/**
 * 받아쓰기에 화면은 쓰지 않는다. 기본 프레임 수로 넘기면 64분 설교에서 영상 토큰이 입력의 69%를
 * 차지해 Pro의 20만 토큰 초과 요금 구간으로 넘어간다 — 실측은 2026-10-08-audio-transcript-async-design.md.
 */
export const AUDIO_ONLY_FPS = 0.001

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
      processing: { type: 'static' as const, fps: AUDIO_ONLY_FPS },
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
```

SDK 타입이 `processing.fps`·`input` 형태를 거부하면 `@google/genai`의 `interactions` 입력 타입에 맞춰 고친다(필드 이름은 실측으로 확인된 위 형태가 정답).

`rg -n "undici" src package.json`로 다른 사용처가 없으면 `npm uninstall undici`.

- [ ] **Step 4: 통과 확인** — 같은 파일 + `npm run typecheck`
- [ ] **Step 5: 커밋** — `feat: 오디오 받아쓰기를 프레임 없는 Gemini background 작업으로 만든다`

---

### Task 4: 시작 job과 조회 job

**Files:**

- Create: `src/lib/sermons/audio-transcript-job.ts`
- Create: `src/app/api/jobs/poll-audio-transcript/route.ts`
- Modify: `src/app/api/jobs/fetch-audio-transcript/route.ts`
- Modify: `src/lib/qstash.ts` (`JobName`에 `'poll-audio-transcript'`)
- Modify: `src/lib/sermons/summarize.ts` (`extendAudioTranscriptMarker` 신규, `publishAudioTranscript` 옵션, `AUDIO_TRANSCRIPT_TIMEOUT_SECONDS` 삭제, 진행 표시 관련 주석)
- Test: `src/lib/sermons/audio-transcript-job.integration.test.ts` (신규), `src/lib/sermons/summarize.integration.test.ts` (`publishAudioTranscript` 단언)

**Interfaces:**

- Consumes: Task 3의 `startAudioTranscription`, `readAudioTranscription`, `AudioTranscriptionState`
- Produces:
  - `AUDIO_POLL_INTERVAL_SECONDS = 30`, `MAX_AUDIO_POLLS = 40`
  - `interface AudioStartPayload { sermonId: string; videoId: string; attempt?: number }`
  - `interface AudioPollPayload { sermonId: string; videoId: string; attempt: number; interactionId: string; model: string; startedAt: number; polls: number }`
  - `runAudioTranscriptStart(p: AudioStartPayload, now?: Date): Promise<'skipped' | 'started' | 'retry' | 'gaveUp'>`
  - `runAudioTranscriptPoll(p: AudioPollPayload, now?: Date): Promise<'skipped' | 'running' | 'done' | 'retry' | 'gaveUp'>`
  - `extendAudioTranscriptMarker(sermonId: string, now?: Date): Promise<void>` (summarize.ts)

- [ ] **Step 1: 실패하는 테스트** — 새 파일. 목 구성은 `summarize.integration.test.ts` 상단과 같은 방식.

```ts
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb, insertSermonFixture, type TestDb } from '@/test/pg'
import { appLogs, sermonSummaries, sermonTranscripts } from '@/lib/db/schema'

const h = vi.hoisted(() => ({ db: null as unknown as TestDb }))
vi.mock('@/lib/db', () => ({
  get db() {
    return h.db
  },
}))
const { publishJob } = vi.hoisted(() => ({ publishJob: vi.fn(async () => undefined) }))
vi.mock('@/lib/qstash', () => ({ publishJob }))
const { startAudioTranscription, readAudioTranscription } = vi.hoisted(() => ({
  startAudioTranscription: vi.fn(),
  readAudioTranscription: vi.fn(),
}))
vi.mock('@/lib/ai/audio-transcript', () => ({
  startAudioTranscription,
  readAudioTranscription,
  transcribeFromAudio: vi.fn(),
}))

let close: () => Promise<void>
beforeAll(async () => {
  const t = await makeTestDb()
  h.db = t.db
  close = t.close
})
afterAll(async () => {
  await close()
})
beforeEach(() => {
  publishJob.mockClear()
  startAudioTranscription.mockReset()
  readAudioTranscription.mockReset()
})

const { runAudioTranscriptStart, runAudioTranscriptPoll, AUDIO_POLL_INTERVAL_SECONDS, MAX_AUDIO_POLLS } =
  await import('./audio-transcript-job')
const { AUDIO_TRANSCRIPT_STALE_MS } = await import('./summarize')

const summaryRow = async (id: string) =>
  (await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id)))[0]
const messages = async (id: string) =>
  (await h.db.select().from(appLogs).where(eq(appLogs.entityId, id))).map((l) => l.message ?? '')
const poll = (id: string, over: Partial<Parameters<typeof runAudioTranscriptPoll>[0]> = {}) => ({
  sermonId: id,
  videoId: 'vid',
  attempt: 0,
  interactionId: 'int-1',
  model: 'gemini-3.1-pro-preview',
  startedAt: Date.now() - 150_000,
  polls: 0,
  ...over,
})

describe('runAudioTranscriptStart (integration)', () => {
  it('자막이 이미 있으면 작업을 만들지 않는다', async () => {
    const id = await insertSermonFixture(h.db, { withSummaryRow: true, transcriptText: '[00:00] x' })
    expect(await runAudioTranscriptStart({ sermonId: id, videoId: 'vid' })).toBe('skipped')
    expect(startAudioTranscription).not.toHaveBeenCalled()
  })

  it('진행 표시를 남기고 작업을 만든 뒤 30초 뒤 조회를 발행한다', async () => {
    const id = await insertSermonFixture(h.db, { withSummaryRow: true })
    startAudioTranscription.mockResolvedValue({ interactionId: 'int-1', model: 'gemini-3.1-pro-preview' })
    expect(await runAudioTranscriptStart({ sermonId: id, videoId: 'vid' })).toBe('started')
    expect((await summaryRow(id)).summaryStatus).toBe('pending')
    expect(publishJob).toHaveBeenCalledWith(
      'poll-audio-transcript',
      expect.objectContaining({
        sermonId: id,
        interactionId: 'int-1',
        model: 'gemini-3.1-pro-preview',
        polls: 0,
        attempt: 0,
      }),
      AUDIO_POLL_INTERVAL_SECONDS,
      { retries: 1 },
    )
    expect(await messages(id)).toContain('오디오 변환 시작 (시도 1회 · gemini-3.1-pro-preview)')
  })

  it('작업 생성이 실패하면 실패 로그를 남기고 재시도로 넘긴다', async () => {
    const id = await insertSermonFixture(h.db, { withSummaryRow: true })
    startAudioTranscription.mockRejectedValue(new Error('400 bad'))
    expect(await runAudioTranscriptStart({ sermonId: id, videoId: 'vid', attempt: 0 })).toBe('retry')
    expect(publishJob).toHaveBeenCalledWith('fetch-audio-transcript', expect.objectContaining({ attempt: 1 }), 0, {
      retries: 0,
    })
    expect((await messages(id)).some((m) => m.startsWith('오디오 변환 실패(시도 1회'))).toBe(true)
  })
})

describe('runAudioTranscriptPoll (integration)', () => {
  it('진행 중이면 진행 표시를 늘리고 다음 조회를 발행한다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'pending',
      summaryNextRetryAt: new Date(Date.now() + 1000),
    })
    readAudioTranscription.mockResolvedValue({ state: 'running' })
    const now = new Date()
    expect(await runAudioTranscriptPoll(poll(id, { polls: 3 }), now)).toBe('running')
    expect((await summaryRow(id)).summaryNextRetryAt?.getTime()).toBe(now.getTime() + AUDIO_TRANSCRIPT_STALE_MS)
    expect(publishJob).toHaveBeenCalledWith(
      'poll-audio-transcript',
      expect.objectContaining({ polls: 4 }),
      AUDIO_POLL_INTERVAL_SECONDS,
      { retries: 1 },
    )
  })

  it('조회 요청이 실패해도 진행 중으로 보고 다시 조회한다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'pending',
      summaryNextRetryAt: new Date(Date.now() + 1000),
    })
    readAudioTranscription.mockRejectedValue(new Error('fetch failed'))
    expect(await runAudioTranscriptPoll(poll(id))).toBe('running')
  })

  it('상한까지 끝나지 않으면 실패로 넘긴다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'pending',
      summaryNextRetryAt: new Date(Date.now() + 1000),
    })
    readAudioTranscription.mockResolvedValue({ state: 'running' })
    expect(await runAudioTranscriptPoll(poll(id, { polls: MAX_AUDIO_POLLS - 1 }))).toBe('retry')
  })

  it('완료되면 자막을 저장하고 요약을 발행하며 소요 시간을 남긴다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'pending',
      summaryAttempts: 3,
      summaryNextRetryAt: new Date(Date.now() + 1000),
    })
    readAudioTranscription.mockResolvedValue({ state: 'done', segments: [{ startSeconds: 0, text: '말씀' }] })
    const now = new Date()
    expect(await runAudioTranscriptPoll(poll(id, { startedAt: now.getTime() - 152_000 }), now)).toBe('done')
    const [t] = await h.db.select().from(sermonTranscripts).where(eq(sermonTranscripts.sermonId, id))
    expect(t.transcriptText).toContain('말씀')
    const row = await summaryRow(id)
    expect([row.summaryStatus, row.summaryAttempts]).toEqual(['none', 0])
    expect(publishJob).toHaveBeenCalledWith('summarize', { sermonId: id })
    expect(await messages(id)).toContain('오디오 변환 완료 (152초 · gemini-3.1-pro-preview · 1줄)')
  })

  it('결과가 실패면 마지막 시도에서 자막 없음으로 끝낸다', async () => {
    const id = await insertSermonFixture(h.db, {
      withSummaryRow: true,
      summaryStatus: 'pending',
      summaryNextRetryAt: new Date(Date.now() + 1000),
    })
    readAudioTranscription.mockResolvedValue({ state: 'failed', error: 'stopped early' })
    expect(await runAudioTranscriptPoll(poll(id, { attempt: 1 }))).toBe('gaveUp')
    expect((await summaryRow(id)).summaryStatus).toBe('no_transcript')
  })

  it('자막이 이미 있으면 조회하지 않는다', async () => {
    const id = await insertSermonFixture(h.db, { withSummaryRow: true, transcriptText: '[00:00] x' })
    expect(await runAudioTranscriptPoll(poll(id))).toBe('skipped')
    expect(readAudioTranscription).not.toHaveBeenCalled()
  })
})
```

`summarize.integration.test.ts`의 `publishAudioTranscript` 테스트 단언을 `{ retries: 0 }`으로 바꾼다(기존 `retries: 1, timeoutSeconds: 300`은 이 변경이 깨는 단언이다).

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/sermons/` → 새 파일 import 실패, `publishAudioTranscript` 단언 FAIL.

- [ ] **Step 3: 구현**

`summarize.ts`:

- `AUDIO_TRANSCRIPT_TIMEOUT_SECONDS`와 그 주석 삭제. `publishAudioTranscript` 옵션을 `{ retries: 0 }`으로, 주석을 "재전달되면 background 작업이 두 번 만들어진다. 끊긴 시작은 진행 표시 만료로 스위퍼가 줍는다."로.
- `AUDIO_TRANSCRIPT_STALE_MS` 주석: 조회 job이 매번 만료 시각을 늘리므로, 이 값은 조회 사슬이 끊겼다고 판단할 공백이라는 점으로 고친다.
- `markAudioTranscriptInFlight` 주석: 300초 강제 종료 대신 "시작 job이나 조회 사슬이 끊기면 어떤 종결 처리도 일어나지 않는다 — 이 표시가 그 잔류의 흔적이다"로.
- 신규:

```ts
/** 조회 job이 살아 있는 동안 스위퍼가 진행 중인 작업을 가로채지 않게 만료 시각을 민다. 이미 풀린 표시는 건드리지 않는다. */
export async function extendAudioTranscriptMarker(sermonId: string, now: Date = new Date()): Promise<void> {
  await db.execute(sql`
    UPDATE sermon_summaries ss SET
      summary_next_retry_at = ${new Date(now.getTime() + AUDIO_TRANSCRIPT_STALE_MS).toISOString()}
    WHERE ss.sermon_id = ${sermonId}
      AND ss.summary_status = 'pending'
      AND ss.summary_claimed_at IS NULL
      AND ss.summary_next_retry_at IS NOT NULL
      AND NOT ${TRANSCRIPT_EXISTS}
  `)
}
```

`src/lib/sermons/audio-transcript-job.ts`:

```ts
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

/** 조회 job의 재전달은 한 번 둔다. 조회는 멱등이고, 완료를 두 번 보더라도 자막 유무 검사가 두 번째를 건너뛴다. */
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
    await publishAudioPoll({ ...p, attempt, ...started, startedAt: now.getTime(), polls: 0 })
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
```

`fetch-audio-transcript/route.ts`:

```ts
import { verifyQStash } from '@/lib/qstash'
import { runAudioTranscriptStart, type AudioStartPayload } from '@/lib/sermons/audio-transcript-job'

// 작업 생성만 하고 돌아온다. 받아쓰기는 Gemini 쪽에서 돌고 poll-audio-transcript가 결과를 가져온다.
export const maxDuration = 60

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const outcome = await runAudioTranscriptStart(JSON.parse(raw) as AudioStartPayload)
  return Response.json({ ok: true, outcome })
}
```

`poll-audio-transcript/route.ts`: 같은 모양으로 `runAudioTranscriptPoll(JSON.parse(raw) as AudioPollPayload)`, `maxDuration = 60`.

`qstash.ts`의 `JobName`에 `| 'poll-audio-transcript'`.

- [ ] **Step 4: 통과 확인** — `npx vitest run src/lib/sermons/ src/lib/ai/` + `npm run typecheck`
- [ ] **Step 5: 커밋** — `feat: 오디오 받아쓰기를 시작 job과 30초 간격 조회 job으로 나눈다`

---

### Task 5: 자막 대기를 1시간으로 줄인다

**Files:**

- Modify: `src/lib/sermons/summarize.ts` (`MAX_TRANSCRIPT_RETRY`, `requestSummaryRegeneration` 주석의 "3시간")
- Modify: `README.md` (자막 재시도 횟수 서술)

- [ ] **Step 1:** `MAX_TRANSCRIPT_RETRY = 2`. 주석에 근거 위치만 단다: `소진하면 오디오 폴백으로 넘어간다. 횟수 근거는 2026-10-08-audio-transcript-async-design.md "자막 대기".`
- [ ] **Step 2:** `requestSummaryRegeneration`의 "관리자가 3시간을 기다릴 이유가 없다" → "관리자가 자막 대기를 기다릴 이유가 없다".
- [ ] **Step 3:** `rg -n "6회|최대 6|3시간" README.md src` 결과의 자막 대기 서술을 2회·1시간으로 고친다.
- [ ] **Step 4:** `npx vitest run src/lib/sermons/` PASS
- [ ] **Step 5: 커밋** — `fix: 자막 대기를 3시간에서 1시간으로 줄인다`

---

### Task 6: 업로드 감지 폴링 시간표

**Files:**

- Modify: `scripts/qstash-schedules.ts`
- Modify: `README.md` (운영 절 스케줄 표)
- Modify: `docs/specs/2026-09-17-sermon-detection-polling-design.md` (스케줄 표 위 배너)

- [ ] **Step 1:** desired 배열의 sun·wed 두 줄을 다음으로 바꾼다.

```ts
      { job: 'reconcile-sermons', cron: '20,40 3 * * 0', scheduleId: 'ycc-reconcile-sermons-sun-head' },
      { job: 'reconcile-sermons', cron: '*/20 4-6 * * 0', scheduleId: 'ycc-reconcile-sermons-sun' },
      { job: 'reconcile-sermons', cron: '0 7 * * 0', scheduleId: 'ycc-reconcile-sermons-sun-tail' },
      { job: 'reconcile-sermons', cron: '20,40 11 * * 3', scheduleId: 'ycc-reconcile-sermons-wed' },
      { job: 'reconcile-sermons', cron: '0,20 12 * * 3', scheduleId: 'ycc-reconcile-sermons-wed-tail' },
```

파일 머리 주석의 "매시간"·근거 위치를 "20분 간격, 근거는 2026-10-08-audio-transcript-async-design.md '폴링 시간표'"로.

- [ ] **Step 2:** README 운영 절 표의 sun·wed 두 행을 위 다섯 스케줄로 바꾼다.
- [ ] **Step 3:** 09-17 spec "폴링 스케줄의 근거" 절 머리에 배너: `> **2026-10-08 — 아래 시간표는 일 12:20~16:00·수 20:20~21:20 20분 간격으로 바뀌었다.** 이 두 스케줄은 운영에 등록된 적이 없었다. 새 시간표와 근거는 2026-10-08-audio-transcript-async-design.md "폴링 시간표".`
- [ ] **Step 4:** `npx prettier --write` 대상 파일, `npm run format:check`
- [ ] **Step 5: 커밋** — `chore: 업로드 감지 폴링을 실측 업로드 시각에 맞춰 20분 간격으로 촘촘히 둔다`

---

### Task 7: 문서 정리

**Files:**

- Modify: `docs/specs/2026-08-25-sermon-audio-fallback-design.md` (머리 배너 + 대조표)
- Modify: `README.md` (오디오 파이프라인 서술, 라우트 목록)
- Modify: `docs/specs/2026-10-08-audio-transcript-async-design.md` (상태 줄)

- [ ] **Step 1:** 08-25 spec 첫 메타 블록 아래에 배너와 표:

```markdown
> **2026-10-08 — 받아쓰기 호출 방식이 바뀌었다.** 아래 본문은 당시 기록이다. 현재 방식은 `2026-10-08-audio-transcript-async-design.md`.
>
> | 항목              | 이 문서                                      | 현재                                                |
> | ----------------- | -------------------------------------------- | --------------------------------------------------- |
> | 호출              | `generateContent` 동기, 함수 1회 안에서 완료 | Interactions `background` 작업 + 30초 간격 조회 job |
> | 입력              | YouTube URL 그대로                           | fps 0.001로 프레임 제외                             |
> | 자막 대기         | `MAX_TRANSCRIPT_RETRY` 6                     | 2                                                   |
> | 오디오 job 재전달 | `retries: 1`, `timeout: 300`                 | 시작 0회, 조회 1회                                  |
> | HTTP 타임아웃     | undici dispatcher 10분                       | 없음(요청이 수 초)                                  |
> | 진행 표시 만료    | 함수 상한 + 재전달 한 판                     | 조회마다 연장, 사슬이 끊긴 공백                     |
```

이 문서 본문(15·18·58·95·118행 등)은 고치지 않는다.

- [ ] **Step 2:** README의 오디오 폴백 서술과 `fetch-audio-transcript` 라우트 설명을 시작·조회 job으로, `poll-audio-transcript` 라우트를 목록에 추가.
- [ ] **Step 3:** 새 spec 상태 줄을 `구현 완료 (2026-10-08)`로.
- [ ] **Step 4:** prettier, format:check
- [ ] **Step 5: 커밋** — `docs: 오디오 받아쓰기 비동기 전환을 README와 이전 설계 문서에 반영한다`

---

### Task 8: 검증

- [ ] **Step 1:** `npm run typecheck && npm run lint && npm run format:check && npx vitest run` 전부 PASS
- [ ] **Step 2:** 실측 — 스크래치 스크립트로 `transcribeFromAudio('sLZ52maHI0Q', 3866, { pollMs: 10_000 })`를 로컬에서 실행. 소요 시간, 줄 수, 마지막 타임스탬프를 기록(DB 쓰기 없음).
- [ ] **Step 3:** back-trace — `rg -n "AUDIO_TRANSCRIPT_TIMEOUT_SECONDS|ensureLongRequestDispatcher|headersTimeout|undici|generateContentWithFallback|reconcile-sermons-sun|reconcile-sermons-wed|MAX_TRANSCRIPT_RETRY|6회|3시간" src scripts docs README.md` 결과를 (a) 고침 (b) 날짜 있는 기록 (c) 무관으로 분류.
- [ ] **Step 4:** 운영 반영 안내(사용자 실행): 배포 후 `NEXT_PUBLIC_SITE_URL=https://www.ycjc.kr npm run qstash:schedules -- --apply`
