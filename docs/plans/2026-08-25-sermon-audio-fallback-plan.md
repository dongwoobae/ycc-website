# 설교 오디오 폴백 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유튜브 자동자막이 끝내 안 잡히는 설교 영상에서, Gemini에 유튜브 URL을 직접 넘겨 오디오를 받아쓰게 하고 기존 요약 파이프라인을 그대로 재사용한다.

**Architecture:** `fetch-transcript`가 6회(3시간) 소진되면 새 QStash job `fetch-audio-transcript`를 발행한다. 이 job은 오디오 다운로드 없이 Gemini `generateContent`에 유튜브 워치 URL을 `fileData.fileUri`로 직접 전달해 `"[MM:SS] 발화"` 형식 받아쓰기를 받고, 이를 기존 `TranscriptSegment[]` 타입으로 파싱해 `storeTranscript`에 넘긴다. 이후 흐름은 기존 `summarize` job과 완전히 동일하다. 같은 오디오 변환 함수를 관리자 "요약 재생성" 버튼(`fetchAndStoreTranscript`)의 실패 폴백에도 재사용해서, 이미 `no_transcript`로 끝난 기존 3건도 이 버튼으로 수동 해소할 수 있게 한다.

**Tech Stack:** Next.js App Router, Drizzle ORM(Neon), Upstash QStash, `@google/genai`(Gemini), Vitest, `undici`(커스텀 dispatcher).

**Spec:** `docs/specs/2026-08-25-sermon-audio-fallback-design.md`

## Global Constraints

- `MAX_TRANSCRIPT_RETRY`는 12에서 6으로 낮춘다(3시간 대기 후 오디오 폴백 진입).
- 오디오 받아쓰기 모델 체인은 `gemini-3.1-pro-preview` → `gemini-3.1-pro`(preview 단종 시 정식 출시명) → `gemini-3.5-flash` → `gemini-2.5-flash` 4단. `gemini-2.5-pro`는 신규 사용자 대상 서비스 종료(404) 확인되어 사용 금지. `generateContentWithFallback`은 503 등 일시 오류뿐 아니라 404(모델 단종)도 다음 모델로 넘어가도록 판별한다.
- 오디오 변환 함수의 반환 타입은 반드시 `TranscriptSegment[]`(`{startSeconds: number, text: string}`) — 원문 문자열을 그대로 저장하지 않는다.
- 오디오 변환 호출에는 `undici`의 `headersTimeout`/`bodyTimeout`을 600,000ms(10분)로 올린 전역 dispatcher를 적용한다(Node 기본 5분 헤더 타임아웃이 4~5분 걸리는 처리와 충돌해 간헐적 `fetch failed`를 유발하는 것을 실측으로 확인함).
- `fetch-audio-transcript` job의 `maxDuration`은 300(Vercel Hobby 상한).
- 자동 job과 관리자 수동 "요약 재생성" 버튼은 **같은** 오디오 변환 함수(`transcribeFromAudio`)를 공유한다.

---

### Task 1: `generateContentWithFallback`을 모델 배열 기반으로 일반화

**Files:**
- Modify: `src/lib/ai/gemini.ts`
- Test: `src/lib/ai/gemini.test.ts`

**Interfaces:**
- Produces: `generateContentWithFallback(ai, request, models?: readonly string[]): Promise<GenerateContentResponse>` — `models` 생략 시 기존과 동일하게 `[resolveGeminiModel(), FALLBACK_GEMINI_MODEL]`. `isModelUnavailableError(error): boolean` 신규 export. `AUDIO_TRANSCRIPT_MODEL = 'gemini-3.1-pro-preview'`, `AUDIO_TRANSCRIPT_MODEL_GA = 'gemini-3.1-pro'` 상수 신규 export.

- [ ] **Step 1: 실패하는 테스트 작성 — 명시적 모델 배열을 순서대로 시도**

`src/lib/ai/gemini.test.ts`의 기존 4개 `it` 블록을 아래로 전부 교체한다(3번째 인자를 문자열이 아니라 배열로 바꿈):

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  AUDIO_TRANSCRIPT_MODEL,
  AUDIO_TRANSCRIPT_MODEL_GA,
  FALLBACK_GEMINI_MODEL,
  generateContentWithFallback,
  isModelUnavailableError,
  isTransientGeminiError,
} from './gemini'

type Ai = Parameters<typeof generateContentWithFallback>[0]
function makeAi(fn: ReturnType<typeof vi.fn>): Ai {
  return { models: { generateContent: fn } } as unknown as Ai
}

const req = { contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }

describe('isTransientGeminiError', () => {
  it('503/UNAVAILABLE/high demand는 일시오류', () => {
    expect(isTransientGeminiError({ status: 503 })).toBe(true)
    expect(isTransientGeminiError({ status: 429 })).toBe(true)
    expect(isTransientGeminiError(new Error('"status":"UNAVAILABLE"'))).toBe(true)
    expect(isTransientGeminiError(new Error('This model is currently experiencing high demand'))).toBe(true)
  })

  it('비일시오류는 false', () => {
    expect(isTransientGeminiError({ status: 400 })).toBe(false)
    expect(isTransientGeminiError(new Error('invalid argument'))).toBe(false)
  })
})

describe('isModelUnavailableError', () => {
  it('404/NOT_FOUND/"no longer available"는 모델 단종으로 판별', () => {
    expect(isModelUnavailableError({ status: 404 })).toBe(true)
    expect(
      isModelUnavailableError(
        new Error(
          '{"error":{"code":404,"message":"This model models/gemini-2.5-pro is no longer available to new users.","status":"NOT_FOUND"}}',
        ),
      ),
    ).toBe(true)
  })

  it('그 외 오류는 false', () => {
    expect(isModelUnavailableError({ status: 400 })).toBe(false)
    expect(isModelUnavailableError({ status: 503 })).toBe(false)
    expect(isModelUnavailableError(new Error('invalid argument'))).toBe(false)
  })
})

describe('generateContentWithFallback', () => {
  it('primary 성공 시 나머지 모델 미호출', async () => {
    const fn = vi.fn().mockResolvedValue({ text: 'ok' })
    const res = await generateContentWithFallback(makeAi(fn), req, ['gemini-3.5-flash', FALLBACK_GEMINI_MODEL])
    expect(res).toEqual({ text: 'ok' })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ model: 'gemini-3.5-flash', ...req })
  })

  it('primary 503이면 다음 모델로 순서대로 재시도', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ text: 'from-fallback' })
    const res = await generateContentWithFallback(makeAi(fn), req, ['gemini-3.5-flash', FALLBACK_GEMINI_MODEL])
    expect(res).toEqual({ text: 'from-fallback' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith({ model: FALLBACK_GEMINI_MODEL, ...req })
  })

  it('3단 체인에서 앞의 둘이 503이면 세 번째로 재시도', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ text: 'third' })
    const res = await generateContentWithFallback(makeAi(fn), req, [
      AUDIO_TRANSCRIPT_MODEL,
      'gemini-3.5-flash',
      FALLBACK_GEMINI_MODEL,
    ])
    expect(res).toEqual({ text: 'third' })
    expect(fn).toHaveBeenCalledTimes(3)
    expect(fn).toHaveBeenLastCalledWith({ model: FALLBACK_GEMINI_MODEL, ...req })
  })

  it('비일시오류는 즉시 throw, 나머지 모델 미호출', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400 })
    await expect(
      generateContentWithFallback(makeAi(fn), req, ['gemini-3.5-flash', FALLBACK_GEMINI_MODEL]),
    ).rejects.toMatchObject({ status: 400 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('1차 모델이 단종(404)되면 정식 출시 모델로 자동 전환', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({ text: 'from-ga' })
    const res = await generateContentWithFallback(makeAi(fn), req, [AUDIO_TRANSCRIPT_MODEL, AUDIO_TRANSCRIPT_MODEL_GA])
    expect(res).toEqual({ text: 'from-ga' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith({ model: AUDIO_TRANSCRIPT_MODEL_GA, ...req })
  })

  it('배열에 같은 모델이 중복되면 한 번만 시도', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 })
    await expect(
      generateContentWithFallback(makeAi(fn), req, [FALLBACK_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]),
    ).rejects.toMatchObject({ status: 503 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('models 생략 시 기본값(resolveGeminiModel → FALLBACK_GEMINI_MODEL) 사용', async () => {
    const fn = vi.fn().mockResolvedValue({ text: 'ok' })
    await generateContentWithFallback(makeAi(fn), req)
    expect(fn).toHaveBeenCalledWith({ model: 'gemini-3.5-flash', ...req })
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/lib/ai/gemini.test.ts`
Expected: FAIL — `AUDIO_TRANSCRIPT_MODEL`/`AUDIO_TRANSCRIPT_MODEL_GA`/`isModelUnavailableError`가 export되지 않음, 3번째 인자 타입 불일치.

- [ ] **Step 3: `src/lib/ai/gemini.ts` 구현**

`gemini.ts` 전체를 아래로 교체:

```ts
import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from '@google/genai'

/** 기본(우선) 모델. GEMINI_MODEL 환경변수로 덮어쓸 수 있다. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
/** 우선 모델이 일시 과부하(503)일 때 자동 우회할 안정 모델. */
export const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash'
/** 오디오(유튜브 URL) 받아쓰기 1차 모델. */
export const AUDIO_TRANSCRIPT_MODEL = 'gemini-3.1-pro-preview'
/** AUDIO_TRANSCRIPT_MODEL의 preview 태그가 떨어지고 정식 출시되면 쓸 이름. preview가 단종(404)되면 자동으로 이쪽으로 전환된다. */
export const AUDIO_TRANSCRIPT_MODEL_GA = 'gemini-3.1-pro'

export function resolveGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
}

/** 503(UNAVAILABLE)·429·high demand 등 재시도하면 풀릴 수 있는 일시 오류인지 판별. */
export function isTransientGeminiError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  if (status === 503 || status === 500 || status === 429) return true
  const message = error instanceof Error ? error.message : String(error)
  return /UNAVAILABLE|high demand|overloaded|try again later/i.test(message)
}

/** 모델 자체가 단종/이름 변경된 경우(예: gemini-2.5-pro가 신규 사용자 대상 404로 종료된 사례). 이 모델로는 영원히 안 되지만 다음 모델은 될 수 있으므로 폴백 대상이다. */
export function isModelUnavailableError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  if (status === 404) return true
  const message = error instanceof Error ? error.message : String(error)
  return /NOT_FOUND|no longer available/i.test(message)
}

/**
 * models를 순서대로 시도한다. 일시 오류(503 등) 또는 모델 단종(404)이면 다음 모델로 넘어가고,
 * 그 외 오류(예: 400 잘못된 요청)는 즉시 throw한다.
 * models 생략 시 [resolveGeminiModel(), FALLBACK_GEMINI_MODEL] 2단 체인을 쓴다. 중복 모델은 한 번만 시도한다.
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI,
  request: Omit<GenerateContentParameters, 'model'>,
  models: readonly string[] = [resolveGeminiModel(), FALLBACK_GEMINI_MODEL],
): Promise<GenerateContentResponse> {
  const uniqueModels = [...new Set(models)]

  let lastError: unknown
  for (const model of uniqueModels) {
    try {
      return await ai.models.generateContent({ model, ...request })
    } catch (error) {
      lastError = error
      if (!isTransientGeminiError(error) && !isModelUnavailableError(error)) throw error
    }
  }
  throw lastError
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/lib/ai/gemini.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (기존 `sermon-summary.ts`의 `generateContentWithFallback(ai, {...})` 2-인자 호출은 `models` 기본값으로 그대로 컴파일됨)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/ai/gemini.ts src/lib/ai/gemini.test.ts
git commit -m "$(cat <<'EOF'
refactor: Gemini 폴백을 모델 배열 기반으로 일반화한다

오디오 받아쓰기에서 4단 모델 체인(pro-preview→pro→flash→flash)이
필요해져, 기존 2단 하드코딩 대신 임의 길이 배열을 순서대로 시도하도록
바꾼다. preview 모델이 단종(404)되는 경우도 다음 모델로 넘어가게 해서
gemini-2.5-pro가 신규 사용자 대상 서비스 종료된 것과 같은 상황에
대비한다.
EOF
)"
```

---

### Task 2: 요약 프롬프트에 전체 길이·챕터 개수 강제 지시 추가

**Files:**
- Modify: `src/lib/ai/sermon-summary.ts`
- Test: `src/lib/ai/sermon-summary.test.ts`

**Interfaces:**
- Produces: `buildSummaryPrompt(durationSeconds: number | null): string` (신규 export, 기존 `PROMPT` 상수를 대체)
- Consumes: 없음 (Task 1과 독립)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/ai/sermon-summary.test.ts` 최상단에 아래 `describe` 블록을 추가(기존 `parseSermonSummary` 테스트는 그대로 둔다):

```ts
import { buildSummaryPrompt, parseSermonSummary } from './sermon-summary'

describe('buildSummaryPrompt', () => {
  it('길이가 있으면 전체 길이·기대 챕터 수·900초 제한을 명시한다', () => {
    const prompt = buildSummaryPrompt(4140)
    expect(prompt).toContain('4140초')
    expect(prompt).toContain('약 69분')
    expect(prompt).toContain('총 7개 안팎')
    expect(prompt).toContain('900초를 초과해서는 안 됩니다')
  })

  it('짧은 영상도 최소 1개 이상의 기대 챕터 수를 명시한다', () => {
    const prompt = buildSummaryPrompt(200)
    expect(prompt).toContain('총 1개 안팎')
  })

  it('길이를 모르면(null) 강제 챕터 수 지시를 생략한다', () => {
    const prompt = buildSummaryPrompt(null)
    expect(prompt).not.toContain('900초를 초과해서는 안 됩니다')
    expect(prompt).not.toContain('안팎이어야 합니다')
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/lib/ai/sermon-summary.test.ts`
Expected: FAIL — `buildSummaryPrompt` is not exported.

- [ ] **Step 3: 구현**

`src/lib/ai/sermon-summary.ts`에서 기존 `const PROMPT = \`...\`` 선언(현재 42~53행)을 아래로 교체:

```ts
export function buildSummaryPrompt(durationSeconds: number | null): string {
  const durationLine =
    durationSeconds != null
      ? `이 영상의 전체 길이는 ${durationSeconds}초(약 ${Math.round(durationSeconds / 60)}분)입니다.`
      : ''
  const chapterCountLine =
    durationSeconds != null
      ? `- 반드시 지킬 것: 전체 길이가 ${durationSeconds}초이므로 챕터는 총 ${Math.max(1, Math.round(durationSeconds / 600))}개 안팎이어야 합니다. 어떤 챕터도 900초를 초과해서는 안 됩니다. 만약 한 구간이 900초를 넘어갈 것 같으면, 그 구간 안에서 소주제 전환점을 다시 찾아 반드시 둘 이상으로 쪼개세요.`
      : ''

  return `당신은 한국어 설교 영상을 요약하는 도우미입니다.
아래의 "[MM:SS] 발화" 형식 설교 자막 원고를 읽고 한국어로 작성하세요.
${durationLine}
1) summary: 한 줄 소개 (한 문장, 핵심이 되는 성경구절의 위치 (예시: 마태복음 5:3) 30자 내외로 작성)
2) quickSummary: 핵심 요점 8~12개 (각 한 문장)
3) chapters: 설교를 내용 흐름에 따라 나눈 구간 객체 배열(시작 시각 startSeconds, 제목 title, 요약 summary).
- 구간 분할 기준: 설교에서 다루는 주제(말씀 내용)가 바뀌는 지점에서 나눈다. 같은 주제가 이어지면 길게, 주제가 바뀌면 더 짧게 나눈다. 대략 8~10분 간격을 기준으로 삼되, 한 구간은 최소 약 6분(360초) 이상, 최대 약 15분(900초)을 넘지 않도록 한다.
${chapterCountLine}
- title: 해당 구간을 대표하는 짧은 제목
- summary: 해당 구간 설교 내용을 6~10문장으로 구체적으로 풀어 쓴 상세 요약. 핵심 메시지, 인용된 성경 구절, 청중을 향한 적용을 포함한다.
startSeconds는 원고에 표기된 [MM:SS] 타임스탬프를 초로 환산해 사용하고, 0부터 오름차순이어야 합니다.

[자막 원고]
`
}
```

그 다음, `generateSermonSummary` 함수 안의 `parts: [{ text: PROMPT + transcriptText }]`를 `parts: [{ text: buildSummaryPrompt(durationSeconds) + transcriptText }]`로 바꾼다.

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/lib/ai/sermon-summary.test.ts`
Expected: PASS (기존 `parseSermonSummary` 5개 + 신규 3개 = 8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ai/sermon-summary.ts src/lib/ai/sermon-summary.test.ts
git commit -m "$(cat <<'EOF'
feat: 요약 프롬프트에 길이 기반 챕터 개수 강제 지시를 추가한다

실측에서 오디오 변환 자막(타임스탬프가 성긴 편)을 그대로 요약시키면
40분 설교 본문이 챕터 하나(900초 제한 위반)에 뭉쳐 나오는 걸 확인해서,
전체 길이와 기대 챕터 수를 프롬프트에 명시해 강제로 쪼개게 한다.
EOF
)"
```

---

### Task 3: 타임스탬프 받아쓰기 텍스트 파서

**Files:**
- Create: `src/lib/ai/audio-transcript.ts`
- Test: `src/lib/ai/audio-transcript.test.ts`

**Interfaces:**
- Consumes: `TranscriptSegment` type from `@/lib/transcript/prompt` (`{startSeconds: number, text: string}`)
- Produces: `parseTimestampedTranscript(raw: string): TranscriptSegment[]`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/ai/audio-transcript.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseTimestampedTranscript } from './audio-transcript'

describe('parseTimestampedTranscript', () => {
  it('parses [MM:SS] lines', () => {
    const raw = '[00:02] 안녕하세요\n[00:06] 오늘 말씀은'
    expect(parseTimestampedTranscript(raw)).toEqual([
      { startSeconds: 2, text: '안녕하세요' },
      { startSeconds: 6, text: '오늘 말씀은' },
    ])
  })

  it('parses [H:MM:SS] lines (1시간 넘는 영상에서 모델이 바꿔 쓰는 형식)', () => {
    const raw = '[01:06:27] 마지막 문장입니다'
    expect(parseTimestampedTranscript(raw)).toEqual([{ startSeconds: 3987, text: '마지막 문장입니다' }])
  })

  it('skips blank lines and lines without a timestamp', () => {
    const raw = '[00:02] 첫 줄\n\n설명 없는 줄\n[00:10] 다음 줄'
    expect(parseTimestampedTranscript(raw)).toEqual([
      { startSeconds: 2, text: '첫 줄' },
      { startSeconds: 10, text: '다음 줄' },
    ])
  })

  it('skips a timestamp line with no text after it', () => {
    const raw = '[00:02] \n[00:05] 실제 내용'
    expect(parseTimestampedTranscript(raw)).toEqual([{ startSeconds: 5, text: '실제 내용' }])
  })

  it('returns an empty array for empty input', () => {
    expect(parseTimestampedTranscript('')).toEqual([])
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/lib/ai/audio-transcript.test.ts`
Expected: FAIL — `src/lib/ai/audio-transcript.ts`가 없어서 모듈을 찾지 못함.

- [ ] **Step 3: 구현**

Create `src/lib/ai/audio-transcript.ts`:

```ts
import type { TranscriptSegment } from '@/lib/transcript/prompt'

const TIMESTAMP_LINE = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*(.*)$/

/** "[MM:SS] 발화" 또는 "[H:MM:SS] 발화" 줄들을 TranscriptSegment[]로 파싱한다. */
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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/lib/ai/audio-transcript.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/ai/audio-transcript.ts src/lib/ai/audio-transcript.test.ts
git commit -m "feat: 타임스탬프 받아쓰기 텍스트를 TranscriptSegment로 파싱하는 함수를 추가한다"
```

---

### Task 4: 유튜브 URL 직접 입력 오디오 받아쓰기 함수

**Files:**
- Modify: `src/lib/ai/audio-transcript.ts`

**Interfaces:**
- Consumes: `generateContentWithFallback`, `AUDIO_TRANSCRIPT_MODEL`, `DEFAULT_GEMINI_MODEL` from `./gemini` (Task 1). `parseTimestampedTranscript` (Task 3, same file).
- Produces: `transcribeFromAudio(videoId: string): Promise<TranscriptSegment[]>` — `fetchTranscript`(RapidAPI)와 동일한 반환 타입이라 `storeTranscript`에 그대로 넘길 수 있다.

이 함수는 자체적으로 `GoogleGenAI` 클라이언트를 생성해 네트워크를 호출한다 — 기존 `generateSermonSummary`(`src/lib/ai/sermon-summary.ts`)와 동일한 패턴이며, 이 코드베이스에서는 이런 함수를 직접 유닛테스트하지 않고 호출부에서 모듈째로 모킹한다(Task 8에서 검증). 그래서 이 태스크는 별도 실패 테스트 없이 구현하고 타입체크로 확인한다.

- [ ] **Step 1: 구현**

`src/lib/ai/audio-transcript.ts` 최상단에 import를 추가하고, 파일 맨 아래에 아래 코드를 추가:

```ts
import { Agent, setGlobalDispatcher } from 'undici'
import { GoogleGenAI } from '@google/genai'
import {
  AUDIO_TRANSCRIPT_MODEL,
  AUDIO_TRANSCRIPT_MODEL_GA,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  generateContentWithFallback,
} from './gemini'
```

(파일 최상단, 기존 `import type { TranscriptSegment } ...` 아래에 위 3줄을 추가한다.)

파일 맨 아래에 추가:

```ts
const AUDIO_TRANSCRIPT_PROMPT = `이 오디오는 한국어 교회 설교 영상입니다. 처음부터 끝까지 발화된 내용을 그대로(요약하거나 생략하지 말고) 한국어로 받아쓰기 하세요.
출력 형식은 반드시 아래와 같이, 각 줄마다 [MM:SS] 타임스탬프로 시작해야 합니다. 타임스탬프는 실제 오디오 재생 시각과 최대한 정확히 일치해야 합니다.

[00:02] 첫 문장 내용
[00:06] 다음 문장 내용
...

다른 설명 없이 이 형식의 받아쓰기 텍스트만 출력하세요.`

let longRequestDispatcherConfigured = false

/** Node 기본 undici headersTimeout(5분)이 4~5분 걸리는 오디오 처리와 충돌해 간헐적 fetch failed를 일으키는 것을 실측으로 확인 — 10분으로 올린다. */
function ensureLongRequestDispatcher(): void {
  if (longRequestDispatcherConfigured) return
  setGlobalDispatcher(new Agent({ headersTimeout: 600_000, bodyTimeout: 600_000 }))
  longRequestDispatcherConfigured = true
}

/** 유튜브 워치 URL을 Gemini에 직접 넘겨 오디오를 받아쓴다. 오디오 추출/다운로드는 하지 않는다(구글 서버가 처리). */
export async function transcribeFromAudio(videoId: string): Promise<TranscriptSegment[]> {
  ensureLongRequestDispatcher()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const ai = new GoogleGenAI({ apiKey })
  const res = await generateContentWithFallback(
    ai,
    {
      contents: [
        {
          role: 'user',
          parts: [
            { text: AUDIO_TRANSCRIPT_PROMPT },
            { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` } },
          ],
        },
      ],
    },
    [AUDIO_TRANSCRIPT_MODEL, AUDIO_TRANSCRIPT_MODEL_GA, DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL],
  )

  const text = res.text
  if (!text) throw new Error('gemini returned empty audio transcript')
  return parseTimestampedTranscript(text)
}
```

- [ ] **Step 2: 타입체크 + 기존 테스트 회귀 확인**

Run: `npx tsc --noEmit && npx vitest run src/lib/ai/audio-transcript.test.ts`
Expected: 에러 없음, 기존 5개 파서 테스트 PASS(새로 추가한 `transcribeFromAudio`는 이 실행에서 호출되지 않음).

- [ ] **Step 3: 커밋**

```bash
git add src/lib/ai/audio-transcript.ts
git commit -m "$(cat <<'EOF'
feat: 유튜브 URL을 Gemini에 직접 넘겨 오디오를 받아쓰는 함수를 추가한다

오디오 다운로드/추출 없이 fileData.fileUri로 유튜브 워치 URL을
그대로 전달한다 — yt-dlp 등 자체 추출은 Vercel 클라우드 IP에서
유튜브 봇 탐지에 막히는 것을 실측으로 확인해 채택하지 않았다
(docs/specs/2026-08-25-sermon-audio-fallback-design.md 참고).
EOF
)"
```

---

### Task 5: `summarize.ts`에 공용 헬퍼 추출 + `fetch-transcript` 리팩터

**Files:**
- Modify: `src/lib/sermons/summarize.ts`
- Modify: `src/app/api/jobs/fetch-transcript/route.ts`
- Test: `src/lib/sermons/summarize.integration.test.ts`

**Interfaces:**
- Produces: `publishSummarizeOrMarkFailed(sermonId: string, segments: TranscriptSegment[], videoId: string): Promise<void>` — 자막을 저장하고 `summarize` job을 발행하며, 발행 실패 시 `summary_status='failed'`로 마킹한다. `fetch-transcript`와 앞으로 만들 `fetch-audio-transcript`(Task 6)가 공유한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/sermons/summarize.integration.test.ts` 최상단 mock 블록에 QStash mock을 추가(파일 맨 위, 기존 `vi.mock('@/lib/db', ...)` 바로 아래):

```ts
vi.mock('@/lib/qstash', () => ({ publishJob: vi.fn(async () => undefined) }))
```

`const { claimSermonById, ... } = await import('./summarize')` 줄을 아래로 교체해 새 export를 같이 가져온다:

```ts
const { claimSermonById, selectRetryTargets, fetchAndStoreTranscript, summarizeClaimed, publishSummarizeOrMarkFailed } =
  await import('./summarize')
```

파일 맨 아래에 추가:

```ts
describe('publishSummarizeOrMarkFailed (integration)', () => {
  it('stores the transcript and publishes a summarize job', async () => {
    const { publishJob } = await import('@/lib/qstash')
    const id = await insertSermonFixture(h.db)
    await publishSummarizeOrMarkFailed(id, [{ startSeconds: 0, text: 'hi' }], 'vid1')
    const [row] = await h.db.select().from(sermonTranscripts).where(eq(sermonTranscripts.sermonId, id))
    expect(row.transcriptText).toContain('hi')
    expect(publishJob).toHaveBeenCalledWith('summarize', { sermonId: id })
  })

  it('marks the sermon failed when publishing the summarize job throws', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockRejectedValueOnce(new Error('qstash down'))
    const id = await insertSermonFixture(h.db)
    await publishSummarizeOrMarkFailed(id, [{ startSeconds: 0, text: 'hi' }], 'vid1')
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('failed')
  })
})
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/lib/sermons/summarize.integration.test.ts`
Expected: FAIL — `publishSummarizeOrMarkFailed` is not exported.

- [ ] **Step 3: `summarize.ts`에 헬퍼 추가**

`src/lib/sermons/summarize.ts` 상단 import에 `publishJob` 추가:

```ts
import { publishJob } from '@/lib/qstash'
```

`fetchAndStoreTranscript` 함수 바로 아래에 추가:

```ts
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
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/lib/sermons/summarize.integration.test.ts`
Expected: PASS (기존 5개 + 신규 2개 = 7 tests)

- [ ] **Step 5: `fetch-transcript/route.ts`가 새 헬퍼를 쓰도록 리팩터 + 재시도 6회로 축소**

`src/app/api/jobs/fetch-transcript/route.ts` 전체를 아래로 교체:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermonSummaries } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { publishJob, RETRY_DELAY_SECONDS, verifyQStash } from '@/lib/qstash'
import { publishSummarizeOrMarkFailed } from '@/lib/sermons/summarize'
import { fetchTranscript } from '@/lib/transcript/rapidapi'

export const maxDuration = 60

const MAX_TRANSCRIPT_RETRY = 6

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const {
    sermonId,
    videoId,
    attempt = 0,
  } = JSON.parse(raw) as {
    sermonId: string
    videoId: string
    attempt?: number
  }

  const segments = await fetchTranscript(videoId)
  if (segments.length === 0) {
    if (attempt < MAX_TRANSCRIPT_RETRY) {
      console.log(
        `[fetch-transcript] 자막 미준비, ${RETRY_DELAY_SECONDS / 60}분 후 재시도 videoId=${videoId} attempt=${attempt + 1}/${MAX_TRANSCRIPT_RETRY}`,
      )
      await publishJob('fetch-transcript', { sermonId, videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
      return Response.json({ ok: true, retry: attempt + 1 })
    }
    // 유튜브가 자막을 끝내 만들지 않은 경우 — 재시도 대신 오디오 변환 폴백으로 넘긴다.
    console.error(`[fetch-transcript] ${MAX_TRANSCRIPT_RETRY}회 재시도 후 포기(자막 없음), 오디오 변환 시도 videoId=${videoId}`)
    await log(
      'error',
      'sermon',
      sermonId,
      `자막 없음 — ${MAX_TRANSCRIPT_RETRY}회 재시도 후 포기, 오디오 변환 시도: videoId=${videoId}`,
    )
    await publishJob('fetch-audio-transcript', { sermonId, videoId })
    return Response.json({ ok: true, gaveUp: true, audioFallback: true })
  }

  await publishSummarizeOrMarkFailed(sermonId, segments, videoId)
  console.log(`[fetch-transcript] 자막 저장 완료 videoId=${videoId} segments=${segments.length}`)
  return Response.json({ ok: true, segments: segments.length })
}
```

이 라우트 파일은 기존에도 전용 테스트가 없다(코드베이스 관행상 route는 얇게 두고 라이브러리 함수를 테스트한다) — 이번에도 새 테스트 파일을 만들지 않는다.

- [ ] **Step 6: `qstash.ts`의 `JobName`에 새 job 추가**

`src/lib/qstash.ts`의 `JobName` 유니온에 `'fetch-audio-transcript'`를 추가:

```ts
export type JobName =
  | 'ingest-video'
  | 'fetch-transcript'
  | 'fetch-audio-transcript'
  | 'summarize'
  | 'websub-renew'
  | 'retry-summaries'
  | 'reconcile-sermons'
  | 'analytics-rollup'
  | 'publish-post'
```

- [ ] **Step 7: 타입체크 + 전체 테스트 회귀 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 에러 없음, 전체 테스트 PASS (Task 6이 아직 없어 `fetch-audio-transcript` 라우트는 존재하지 않지만, `publishJob`은 문자열 유니온만 검사하므로 이 시점에도 타입 에러 없음)

- [ ] **Step 8: 커밋**

```bash
git add src/lib/sermons/summarize.ts src/lib/sermons/summarize.integration.test.ts src/app/api/jobs/fetch-transcript/route.ts src/lib/qstash.ts
git commit -m "$(cat <<'EOF'
refactor: 자막 저장+summarize 발행을 공용 헬퍼로 뽑고 재시도를 6회로 줄인다

fetch-transcript와 앞으로 추가할 fetch-audio-transcript가 같은
publishSummarizeOrMarkFailed를 쓰게 해서 로직 중복을 없앤다.
재시도 12→6회로 줄여도 오디오 폴백이 이어받으므로 손해가 없다.
EOF
)"
```

---

### Task 6: `fetch-audio-transcript` QStash 워커 신규 작성

**Files:**
- Create: `src/app/api/jobs/fetch-audio-transcript/route.ts`

**Interfaces:**
- Consumes: `transcribeFromAudio` (Task 4), `publishSummarizeOrMarkFailed` (Task 5), `verifyQStash` (기존 `@/lib/qstash`).

- [ ] **Step 1: 구현**

Create `src/app/api/jobs/fetch-audio-transcript/route.ts`:

```ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermonSummaries } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { verifyQStash } from '@/lib/qstash'
import { transcribeFromAudio } from '@/lib/ai/audio-transcript'
import { publishSummarizeOrMarkFailed } from '@/lib/sermons/summarize'

export const maxDuration = 300

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId, videoId } = JSON.parse(raw) as { sermonId: string; videoId: string }

  let segments
  try {
    segments = await transcribeFromAudio(videoId)
    if (segments.length === 0) throw new Error('오디오 변환 결과 없음')
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 150) : String(e).slice(0, 150)
    console.error(`[fetch-audio-transcript] 오디오 변환 실패, 최종 포기 videoId=${videoId}`, e)
    await log('error', 'sermon', sermonId, `오디오 변환 실패 — 최종 포기: videoId=${videoId} ${message}`)
    await db
      .update(sermonSummaries)
      .set({ summaryStatus: 'no_transcript' })
      .where(eq(sermonSummaries.sermonId, sermonId))
    return Response.json({ ok: true, gaveUp: true })
  }

  await publishSummarizeOrMarkFailed(sermonId, segments, videoId)
  console.log(`[fetch-audio-transcript] 오디오 변환 완료 videoId=${videoId} segments=${segments.length}`)
  return Response.json({ ok: true, segments: segments.length })
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 — `publishJob('fetch-audio-transcript', ...)`(Task 5 Step 5)를 포함해 `JobName` 유니온 전체가 일관되게 컴파일됨.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/jobs/fetch-audio-transcript/route.ts
git commit -m "feat: 오디오 변환 QStash 워커(fetch-audio-transcript)를 추가한다"
```

---

### Task 7: 관리자 "요약 재생성" 버튼이 오디오 폴백도 타도록 연결

**Files:**
- Modify: `src/lib/sermons/summarize.ts`
- Modify: `src/lib/actions/sermons.ts`
- Test: `src/lib/sermons/summarize.integration.test.ts`

**Interfaces:**
- Consumes: `transcribeFromAudio` (Task 4)
- Produces: `fetchAndStoreTranscript`의 동작 변경(시그니처는 동일하게 유지 — `(sermonId: string, videoId: string) => Promise<string>`)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/sermons/summarize.integration.test.ts` 최상단 mock 블록에 추가(기존 `vi.mock('@/lib/transcript/rapidapi', ...)` 바로 아래):

```ts
vi.mock('@/lib/ai/audio-transcript', () => ({
  transcribeFromAudio: vi.fn(async () => [{ startSeconds: 0, text: 'audio fallback text' }]),
}))
```

기존 `describe('fetchAndStoreTranscript upsert (integration)', ...)` 블록 안에 테스트를 추가:

```ts
  it('falls back to audio transcription when RapidAPI returns no segments', async () => {
    const { fetchTranscript } = await import('@/lib/transcript/rapidapi')
    vi.mocked(fetchTranscript).mockResolvedValueOnce([])
    const id = await insertSermonFixture(h.db)
    const text = await fetchAndStoreTranscript(id, 'vid-no-captions')
    expect(text).toContain('audio fallback text')
  })

  it('throws when both RapidAPI and audio transcription come back empty', async () => {
    const { fetchTranscript } = await import('@/lib/transcript/rapidapi')
    const { transcribeFromAudio } = await import('@/lib/ai/audio-transcript')
    vi.mocked(fetchTranscript).mockResolvedValueOnce([])
    vi.mocked(transcribeFromAudio).mockResolvedValueOnce([])
    const id = await insertSermonFixture(h.db)
    await expect(fetchAndStoreTranscript(id, 'vid-no-captions-anywhere')).rejects.toThrow('자막 미준비')
  })
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/lib/sermons/summarize.integration.test.ts`
Expected: FAIL — 첫 번째 신규 테스트는 `fetchAndStoreTranscript`가 여전히 RapidAPI 결과만 보고 바로 throw하기 때문에 실패.

- [ ] **Step 3: `fetchAndStoreTranscript` 구현 변경**

`src/lib/sermons/summarize.ts` 상단 import에 추가:

```ts
import { transcribeFromAudio } from '@/lib/ai/audio-transcript'
```

`fetchAndStoreTranscript` 함수를 아래로 교체:

```ts
export async function fetchAndStoreTranscript(sermonId: string, videoId: string): Promise<string> {
  const segments = await fetchTranscript(videoId)
  if (segments.length > 0) return storeTranscript(sermonId, segments)

  const audioSegments = await transcribeFromAudio(videoId)
  if (audioSegments.length === 0) throw new Error('자막 미준비')
  return storeTranscript(sermonId, audioSegments)
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/lib/sermons/summarize.integration.test.ts`
Expected: PASS (기존 7개 + 신규 2개 = 9 tests)

- [ ] **Step 5: 관리자 서버 액션의 `maxDuration` 상향**

`src/lib/actions/sermons.ts`의 `'use server'` 바로 아래(첫 import 줄 위)에 추가:

```ts
export const maxDuration = 300
```

- [ ] **Step 6: 타입체크 + 전체 테스트 회귀 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 에러 없음, 전체 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/sermons/summarize.ts src/lib/sermons/summarize.integration.test.ts src/lib/actions/sermons.ts
git commit -m "$(cat <<'EOF'
feat: 관리자 "요약 재생성" 버튼이 오디오 폴백까지 시도하게 한다

fetchAndStoreTranscript가 RapidAPI 실패 시 오디오 변환으로 폴백해서,
자동 잡 체인과 수동 재생성 버튼이 같은 로직을 공유한다. 이미
no_transcript로 끝난 기존 3건도 이 버튼으로 수동 해소할 수 있다.
서버 액션이 최대 5분 걸릴 수 있어 maxDuration을 300으로 올린다.
EOF
)"
```

---

## 배포 후 확인 (코드 변경 아님)

플랜에는 포함하지 않지만, 배포 직후 사람이 직접 확인해야 하는 항목(스펙의 "미결 사항" 참고):

1. 이미 `no_transcript`인 기존 3건 각각에서 관리자 화면 "요약 재생성" 버튼을 눌러 정상적으로 요약이 생성되는지 확인.
2. 실제 Vercel 프로덕션 환경에서 `fetch-audio-transcript` job이 `maxDuration=300` 안에 끝나는지, `headersTimeout` 관련 오류가 재현되지 않는지 로그로 확인.
