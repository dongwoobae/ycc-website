# YouTube WebSub + Upstash + 자막요약 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube 업로드를 WebSub로 감지해 설교를 즉시 자동 공개하고, Upstash QStash로 자막 준비를 추적해 Gemini 3.5 Flash로 요약을 채운다.

**Architecture:** WebSub 웹훅이 업로드를 알리면 QStash 메시지를 발행한다. 단계별 QStash 워커(ingest → fetch-transcript → summarize)가 영상별 지연 재시도(패턴 B)로 처리하며, 각 워커는 QStash 서명검증으로 보호된다. 새 영상 판별은 DB `youtube_video_id` 비교, 요약 중복은 `summary_status='pending'` 원자적 claim으로 막는다. DB 마이그레이션은 없다.

**Tech Stack:** Next.js 16(App Router) · Drizzle(Neon http) · `@upstash/qstash` · RapidAPI YouTube Transcript · `@google/genai`(Gemini 3.5 Flash) · vitest · npm

**참조 spec:** `docs/superpowers/specs/2026-06-23-youtube-websub-pipeline-design.md`

**공통 규칙:** 단위 테스트는 외부 API 모킹(실제 호출 금지). 테스트 실행은 `npx vitest run <파일>`. 커밋은 Conventional Commits(`feat:`/`refactor:`/`chore:`), Claude 서명/co-author 금지.

---

## 파일 구조 (생성/수정 맵)

**신규**
- `src/lib/youtube/websub.ts` — Atom 파싱, HMAC 검증, 구독요청 본문 빌더
- `src/lib/transcript/rapidapi.ts` — RapidAPI 호출 + 세그먼트 정규화 + 부재 판별
- `src/lib/transcript/prompt.ts` — 세그먼트 → 타임스탬프 원고 텍스트(순수)
- `src/lib/sermons/classify.ts` — videoId → worshipType/autoSummary(재생목록 우선순위)
- `src/lib/sermons/ingest.ts` — ingest 의사결정(순수) + draft upsert
- `src/lib/qstash.ts` — publish 헬퍼 + Receiver 서명검증 + 자기재발행
- `src/app/api/youtube/websub/route.ts` — GET 검증 / POST 알림
- `src/app/api/jobs/ingest-video/route.ts`
- `src/app/api/jobs/fetch-transcript/route.ts`
- `src/app/api/jobs/summarize/route.ts`
- `src/app/api/jobs/websub-renew/route.ts`
- `scripts/websub-subscribe.ts` — 최초 1회 수동 구독
- 각 신규 순수모듈의 `*.test.ts`

**수정**
- `src/lib/types.ts` — `WorshipType`에 `미분류` 추가
- `src/lib/worship.ts` — `미분류` 라벨/표시 정책 헬퍼
- `src/lib/constants.ts`(신규 또는 기존) — `DEFAULT_PREACHER`
- `src/lib/ai/sermon-summary.ts` — `generateSermonSummary` 입력을 자막 텍스트로
- `src/lib/sermons/summarize.ts` — `claimSermonById` 추가, 입력 자막 텍스트화
- `src/components/sermons/SermonSummary.tsx` — 3상태 표시
- `src/components/sermons/SermonCard.tsx` · `WorshipFilter.tsx` · `src/app/sermons/[id]/page.tsx` — `미분류` 뱃지 숨김
- `.env.example`

**제거**
- `src/app/api/cron/sync-sermons/route.ts` · `src/app/api/cron/summarize-sermons/route.ts`
- `vercel.json`의 `crons` 블록
- `src/lib/sermons/sync.ts`의 `syncSermons()`(매핑 헬퍼 `planSermonInserts`는 유지/이동)

---

## Phase 0 — 의존성 · 상수 · 타입

### Task 0.1: QStash SDK 설치

**Files:** `package.json`

- [ ] **Step 1: 설치**

Run: `npm install @upstash/qstash`
Expected: `@upstash/qstash` 가 dependencies에 추가됨.

- [ ] **Step 2: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: @upstash/qstash 의존성 추가"
```

### Task 0.2: WorshipType에 `미분류` 추가

**Files:**
- Modify: `src/lib/types.ts:1-3`
- Modify: `src/lib/worship.ts:7-15`

- [ ] **Step 1: 타입 확장**

`src/lib/types.ts` 의 `WorshipType` 을 교체:

```typescript
export type WorshipType =
  | '주일예배' | '주일찬양예배' | '수요예배' | '금요기도회'
  | '시온찬양대' | '특송' | '특별행사' | '미분류'
```

- [ ] **Step 2: 라벨 맵 보강 + 표시여부 헬퍼**

`src/lib/worship.ts` 의 `worshipLabels` 에 `미분류: '미분류'` 추가하고, 파일 끝에 헬퍼 추가:

```typescript
export const worshipLabels: Record<WorshipType, string> = {
  주일예배: '주일예배',
  주일찬양예배: '주일찬양예배',
  수요예배: '수요예배',
  금요기도회: '금요기도회',
  시온찬양대: '시온찬양대',
  특송: '특송',
  특별행사: '특별행사',
  미분류: '미분류',
}

/** 공개 필터/뱃지에 노출할 worshipType인지. '미분류'는 숨김. */
export function isPublicWorshipType(value: string): boolean {
  return value !== '미분류' && isWorshipType(value)
}
```

> 주의: `worshipFilterItems`/`worshipTypes` 는 `미분류`를 포함하지 않게 그대로 둔다(필터 탭에 미분류 안 보이게).

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 통과(에러 없음).

- [ ] **Step 4: 커밋**

```bash
git add src/lib/types.ts src/lib/worship.ts
git commit -m "feat: worshipType '미분류' 추가 및 공개 표시 제외 헬퍼"
```

### Task 0.3: DEFAULT_PREACHER 상수

**Files:**
- Create: `src/lib/constants.ts`

- [ ] **Step 1: 상수 생성**

```typescript
/** 담임목사가 항상 설교자이므로 자동 수집 시 기본 설교자. 변경 시 이 한 곳만 수정. */
export const DEFAULT_PREACHER = '김선찬 담임목사'
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/constants.ts
git commit -m "feat: DEFAULT_PREACHER 상수 추가"
```

---

## Phase 1 — WebSub 라이브러리

### Task 1.1: Atom 페이로드 파싱

**Files:**
- Create: `src/lib/youtube/websub.ts`
- Test: `src/lib/youtube/websub.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/youtube/websub.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { parseWebSubNotification } from './websub'

const uploadXml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>abc123XYZ_-</yt:videoId>
    <yt:channelId>UCchannel</yt:channelId>
    <title>주일예배 설교</title>
    <published>2026-06-23T01:00:00+00:00</published>
    <updated>2026-06-23T01:00:00+00:00</updated>
  </entry>
</feed>`

const deletedXml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:at="http://purl.org/atompub/tombstones/1.0">
  <at:deleted-entry ref="yt:video:abc123XYZ_-" />
</feed>`

describe('parseWebSubNotification', () => {
  it('extracts videoId and published from an upload entry', () => {
    const r = parseWebSubNotification(uploadXml)
    expect(r).toEqual({ kind: 'upload', videoId: 'abc123XYZ_-', published: '2026-06-23T01:00:00+00:00' })
  })

  it('detects deleted-entry as non-upload', () => {
    expect(parseWebSubNotification(deletedXml)).toEqual({ kind: 'deleted' })
  })

  it('returns unknown for malformed payload', () => {
    expect(parseWebSubNotification('<feed></feed>')).toEqual({ kind: 'unknown' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/youtube/websub.test.ts`
Expected: FAIL — `parseWebSubNotification is not a function`.

- [ ] **Step 3: 구현**

`src/lib/youtube/websub.ts`:

```typescript
export type WebSubNotification =
  | { kind: 'upload'; videoId: string; published: string }
  | { kind: 'deleted' }
  | { kind: 'unknown' }

const tag = (xml: string, name: string): string | null => {
  const m = new RegExp(`<${name}>([^<]+)</${name}>`).exec(xml)
  return m ? m[1] : null
}

/** YouTube WebSub Atom 페이로드에서 videoId/published 추출. 정규식 파싱(의존성 없이). */
export function parseWebSubNotification(xml: string): WebSubNotification {
  if (/<at:deleted-entry/.test(xml)) return { kind: 'deleted' }
  const videoId = tag(xml, 'yt:videoId')
  const published = tag(xml, 'published')
  if (videoId && published) return { kind: 'upload', videoId, published }
  return { kind: 'unknown' }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/youtube/websub.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/youtube/websub.ts src/lib/youtube/websub.test.ts
git commit -m "feat: WebSub Atom 페이로드 파서"
```

### Task 1.2: HMAC 서명 검증

**Files:**
- Modify: `src/lib/youtube/websub.ts`
- Modify: `src/lib/youtube/websub.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`websub.test.ts` 상단 import에 `verifyWebSubSignature` 추가하고 describe 블록 추가:

```typescript
import { createHmac } from 'node:crypto'
// ...
describe('verifyWebSubSignature', () => {
  const secret = 's3cr3t'
  const body = '<feed>x</feed>'
  const sig = 'sha1=' + createHmac('sha1', secret).update(body).digest('hex')

  it('accepts a valid signature', () => {
    expect(verifyWebSubSignature(body, sig, secret)).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifyWebSubSignature(body + 'x', sig, secret)).toBe(false)
  })
  it('rejects missing header', () => {
    expect(verifyWebSubSignature(body, null, secret)).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/youtube/websub.test.ts`
Expected: FAIL — `verifyWebSubSignature is not a function`.

- [ ] **Step 3: 구현 추가**

`websub.ts` 에 추가:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'

/** WebSub hub이 보낸 X-Hub-Signature(sha1=...) 를 WEBSUB_SECRET으로 검증. */
export function verifyWebSubSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const expected = 'sha1=' + createHmac('sha1', secret).update(rawBody).digest('hex')
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/youtube/websub.test.ts`
Expected: PASS (6 passed).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/youtube/websub.ts src/lib/youtube/websub.test.ts
git commit -m "feat: WebSub HMAC 서명 검증"
```

### Task 1.3: 구독 요청(subscribe/renew)

**Files:**
- Modify: `src/lib/youtube/websub.ts`

- [ ] **Step 1: 구현 추가 (외부 호출이라 단위테스트 생략, 본문 빌더만 순수)**

`websub.ts` 에 추가:

```typescript
const HUB = 'https://pubsubhubbub.appspot.com/subscribe'

export function channelTopicUrl(channelId: string): string {
  return `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`
}

/** Google WebSub 허브에 구독(또는 갱신) 요청. 성공 시 허브가 콜백으로 검증을 보냄. */
export async function subscribeToChannel(opts: {
  channelId: string
  callbackUrl: string
  secret: string
  mode?: 'subscribe' | 'unsubscribe'
}): Promise<void> {
  const form = new URLSearchParams({
    'hub.mode': opts.mode ?? 'subscribe',
    'hub.topic': channelTopicUrl(opts.channelId),
    'hub.callback': opts.callbackUrl,
    'hub.verify': 'async',
    'hub.secret': opts.secret,
  })
  const res = await fetch(HUB, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok && res.status !== 202) {
    throw new Error(`websub subscribe failed: ${res.status} ${await res.text()}`)
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/youtube/websub.ts
git commit -m "feat: WebSub 채널 구독/갱신 요청"
```

---

## Phase 2 — RapidAPI 자막 + 프롬프트

### Task 2.1: 세그먼트 → 타임스탬프 원고 텍스트(순수)

**Files:**
- Create: `src/lib/transcript/prompt.ts`
- Test: `src/lib/transcript/prompt.test.ts`

- [ ] **Step 1: 실패 테스트**

`src/lib/transcript/prompt.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { buildTranscriptText, type TranscriptSegment } from './prompt'

const segs: TranscriptSegment[] = [
  { startSeconds: 0, text: '안녕하세요' },
  { startSeconds: 65, text: '오늘 본문은' },
]

describe('buildTranscriptText', () => {
  it('prefixes each line with [MM:SS]', () => {
    expect(buildTranscriptText(segs)).toBe('[00:00] 안녕하세요\n[01:05] 오늘 본문은')
  })
  it('returns empty string for no segments', () => {
    expect(buildTranscriptText([])).toBe('')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/transcript/prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/lib/transcript/prompt.ts`:

```typescript
export interface TranscriptSegment {
  startSeconds: number
  text: string
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** 세그먼트 배열을 "[MM:SS] 텍스트" 줄들로 결합. Gemini가 실제 타임스탬프로 챕터를 끊게 한다. */
export function buildTranscriptText(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${mmss(s.startSeconds)}] ${s.text.trim()}`).join('\n')
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/transcript/prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/transcript/prompt.ts src/lib/transcript/prompt.test.ts
git commit -m "feat: 자막 세그먼트 → 타임스탬프 원고 텍스트 빌더"
```

### Task 2.2: RapidAPI 응답 정규화(순수)

**Files:**
- Create: `src/lib/transcript/rapidapi.ts`
- Test: `src/lib/transcript/rapidapi.test.ts`

> ⚠️ 구현 시 실제 사용할 RapidAPI 제공자의 응답 필드명을 확인할 것. 본 plan은 `[{ text, offset }]`(offset=초) 형태를 가정하며, `normalizeTranscript`의 필드 매핑만 제공자에 맞게 조정하면 된다.

- [ ] **Step 1: 실패 테스트**

`src/lib/transcript/rapidapi.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { normalizeTranscript } from './rapidapi'

describe('normalizeTranscript', () => {
  it('maps text/offset to segments', () => {
    const raw = [
      { text: '가', offset: 0 },
      { text: '나', offset: 12.5 },
    ]
    expect(normalizeTranscript(raw)).toEqual([
      { startSeconds: 0, text: '가' },
      { startSeconds: 12, text: '나' },
    ])
  })
  it('drops blank text and returns [] for empty/invalid', () => {
    expect(normalizeTranscript([{ text: '   ', offset: 1 }])).toEqual([])
    expect(normalizeTranscript(null)).toEqual([])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/transcript/rapidapi.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/lib/transcript/rapidapi.ts`:

```typescript
import type { TranscriptSegment } from './prompt'

interface RawSegment { text?: unknown; offset?: unknown }

/** RapidAPI 응답 배열을 TranscriptSegment[]로 정규화. 빈 텍스트 제거. */
export function normalizeTranscript(raw: unknown): TranscriptSegment[] {
  if (!Array.isArray(raw)) return []
  const out: TranscriptSegment[] = []
  for (const item of raw as RawSegment[]) {
    const text = typeof item.text === 'string' ? item.text.trim() : ''
    if (!text) continue
    const offset = Number(item.offset)
    out.push({ startSeconds: Number.isFinite(offset) ? Math.floor(offset) : 0, text })
  }
  return out
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/transcript/rapidapi.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/transcript/rapidapi.ts src/lib/transcript/rapidapi.test.ts
git commit -m "feat: RapidAPI 자막 응답 정규화"
```

### Task 2.3: RapidAPI fetch 래퍼

**Files:**
- Modify: `src/lib/transcript/rapidapi.ts`

- [ ] **Step 1: 구현 추가(네트워크 호출 — 단위테스트 생략)**

`rapidapi.ts` 에 추가:

```typescript
/** RapidAPI에서 자막을 가져와 정규화. 자막 미생성 시 빈 배열을 반환(=아직 준비 안 됨). */
export async function fetchTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const key = process.env.RAPIDAPI_KEY
  const host = process.env.RAPIDAPI_TRANSCRIPT_HOST
  if (!key || !host) throw new Error('RAPIDAPI_KEY / RAPIDAPI_TRANSCRIPT_HOST not set')

  // ⚠️ 제공자별 경로/쿼리 확인 필요. 예: GET /transcript?video_id=...&lang=ko
  const url = new URL(`https://${host}/transcript`)
  url.searchParams.set('video_id', videoId)
  url.searchParams.set('lang', 'ko')

  const res = await fetch(url.toString(), {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
  })
  // 자막 미생성은 404/빈응답으로 오는 경우가 많음 → 빈 배열(준비 안 됨)로 처리
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`rapidapi transcript ${res.status}`)
  const data = await res.json()
  // 제공자에 따라 { transcript: [...] } 또는 [...] → 둘 다 수용
  return normalizeTranscript(Array.isArray(data) ? data : (data?.transcript ?? data?.data))
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/transcript/rapidapi.ts
git commit -m "feat: RapidAPI 자막 fetch 래퍼"
```

---

## Phase 3 — Gemini 요약을 자막 텍스트 입력으로 전환

### Task 3.1: `generateSermonSummary` 시그니처 변경

**Files:**
- Modify: `src/lib/ai/sermon-summary.ts:36-91`
- 기존 테스트 유지: `src/lib/ai/sermon-summary.test.ts` (parseSermonSummary 검증은 그대로 통과해야 함)

- [ ] **Step 1: 프롬프트·시그니처 교체**

`sermon-summary.ts` 의 `PROMPT` 와 `generateSermonSummary` 를 교체(나머지 `parseSermonSummary`/`schema`/`responseSchema`는 유지):

```typescript
const PROMPT = `당신은 한국어 설교 자막 원고를 요약하는 도우미입니다.
아래는 "[MM:SS] 발화" 형식의 설교 자막 원고입니다. 이를 읽고 한국어로 작성하세요.
1) summary: 한 줄 소개 (한 문장)
2) quickSummary: 핵심 요점 8~12개 (각 한 문장)
3) chapters: 원고 흐름을 시간 구간으로 나눈 각 구간의 시작 시각(초, startSeconds), 제목(title), 요약(summary).
   startSeconds는 원고에 표기된 [MM:SS] 타임스탬프를 초로 환산해 사용하고, 0부터 오름차순이어야 합니다.

[자막 원고]
`

export async function generateSermonSummary(
  transcriptText: string,
  durationSeconds: number | null
): Promise<SermonSummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  if (!transcriptText.trim()) throw new Error('empty transcript')
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'

  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: PROMPT + transcriptText }] }],
    config: { temperature: 0.2, responseMimeType: 'application/json', responseSchema },
  })

  const text = res.text
  if (!text) throw new Error('gemini returned empty response')
  return parseSermonSummary(JSON.parse(text), durationSeconds)
}
```

- [ ] **Step 2: 기존 요약 테스트 통과 확인**

Run: `npx vitest run src/lib/ai/sermon-summary.test.ts`
Expected: PASS (parseSermonSummary 테스트는 영향 없음).

- [ ] **Step 3: 커밋**

```bash
git add src/lib/ai/sermon-summary.ts
git commit -m "refactor: Gemini 요약 입력을 영상 URL → 자막 원고 텍스트로 전환"
```

### Task 3.2: `summarize.ts` — 단건 claim + 자막 입력

**Files:**
- Modify: `src/lib/sermons/summarize.ts`
- Test: `src/lib/sermons/summarize.test.ts`(신규 — claim SQL 구성 검증용 순수 헬퍼)

- [ ] **Step 1: claim 조건을 순수 함수로 분리 + 실패 테스트**

`summarize.ts` 의 claim 자격 조건을 재사용 가능한 순수 함수로 뽑는다. 먼저 테스트 `src/lib/sermons/summarize.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { isClaimEligible, MAX_SUMMARY_ATTEMPTS } from './summarize'

const base = {
  summaryStatus: 'none' as const,
  summaryAttempts: 0,
  summaryNextRetryAt: null as Date | null,
  summaryGeneratedAt: null as Date | null,
  createdAt: new Date('2026-06-23T00:00:00Z'),
}
const now = new Date('2026-06-23T01:00:00Z')

describe('isClaimEligible', () => {
  it('claims a fresh none', () => {
    expect(isClaimEligible(base, now)).toBe(true)
  })
  it('skips when attempts maxed', () => {
    expect(isClaimEligible({ ...base, summaryStatus: 'failed', summaryAttempts: MAX_SUMMARY_ATTEMPTS }, now)).toBe(false)
  })
  it('skips ready', () => {
    expect(isClaimEligible({ ...base, summaryStatus: 'ready' }, now)).toBe(false)
  })
  it('reclaims stale pending (>10m)', () => {
    expect(isClaimEligible({ ...base, summaryStatus: 'pending', createdAt: new Date('2026-06-23T00:40:00Z') }, now)).toBe(true)
  })
  it('does not reclaim fresh pending', () => {
    expect(isClaimEligible({ ...base, summaryStatus: 'pending', createdAt: new Date('2026-06-23T00:59:00Z') }, now)).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/sermons/summarize.test.ts`
Expected: FAIL — `isClaimEligible is not a function`.

- [ ] **Step 3: 구현 — `isClaimEligible` + `claimSermonById` + 자막 입력 처리**

`summarize.ts` 에 추가/수정:

```typescript
export interface ClaimState {
  summaryStatus: string
  summaryAttempts: number
  summaryNextRetryAt: Date | null
  summaryGeneratedAt: Date | null
  createdAt: Date
}

export function isClaimEligible(s: ClaimState, now: Date): boolean {
  if (s.summaryAttempts >= MAX_SUMMARY_ATTEMPTS) return false
  if (s.summaryStatus === 'none' || s.summaryStatus === 'failed') {
    return !s.summaryNextRetryAt || s.summaryNextRetryAt <= now
  }
  if (s.summaryStatus === 'pending' && !s.summaryGeneratedAt) {
    return s.createdAt <= new Date(now.getTime() - STALE_PENDING_MS)
  }
  return false
}

/** 특정 설교 1건을 원자적으로 pending 선점. 자격 미달이면 null. */
export async function claimSermonById(id: string, now: Date = new Date()): Promise<{ id: string; durationSeconds: number | null } | null> {
  const staleBefore = new Date(now.getTime() - STALE_PENDING_MS)
  const result = await db.execute(sql`
    UPDATE sermons SET summary_status='pending', summary_attempts = summary_attempts + 1
    WHERE id = ${id}
      AND summary_attempts < ${MAX_SUMMARY_ATTEMPTS}
      AND (
        (summary_status IN ('none','failed') AND (summary_next_retry_at IS NULL OR summary_next_retry_at <= ${now.toISOString()}))
        OR (summary_status='pending' AND summary_generated_at IS NULL AND created_at <= ${staleBefore.toISOString()})
      )
    RETURNING id, duration_seconds AS "durationSeconds"
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as { id: string; durationSeconds: number | null } | undefined) ?? null
}

/** claim된 설교를 자막 텍스트로 요약해 저장. */
export async function summarizeClaimed(id: string, durationSeconds: number | null, transcriptText: string): Promise<'ready' | 'failed'> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'
  try {
    const result = await generateSermonSummary(transcriptText, durationSeconds)
    await db.update(sermons).set({
      summary: result.summary,
      quickSummary: result.quickSummary,
      chapters: result.chapters,
      summaryStatus: 'ready',
      summaryGeneratedAt: new Date(),
      summaryNextRetryAt: null,
      summaryModel: model,
    }).where(eq(sermons.id, id))
    return 'ready'
  } catch (e) {
    console.error(`[summarize] ${id} failed`, e)
    await db.update(sermons).set({
      summaryStatus: 'failed',
      summaryNextRetryAt: computeNextRetry(MAX_SUMMARY_ATTEMPTS, new Date()),
    }).where(eq(sermons.id, id))
    return 'failed'
  }
}
```

> 기존 `claimNextSermon`/`processClaimedSermon`/`runSummaryWorker`/`generateSummaryForSermon`(영상 URL 기반)은 Phase 9에서 cron과 함께 제거/대체한다. 이 단계에서는 새 함수만 추가한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/sermons/summarize.test.ts`
Expected: PASS (5 passed).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/sermons/summarize.ts src/lib/sermons/summarize.test.ts
git commit -m "feat: 단건 claimSermonById + 자막 텍스트 요약 처리"
```

---

## Phase 4 — 분류 · ingest 의사결정

### Task 4.1: videoId → worshipType 매핑(순수)

**Files:**
- Create: `src/lib/sermons/classify.ts`
- Test: `src/lib/sermons/classify.test.ts`

- [ ] **Step 1: 실패 테스트**

`src/lib/sermons/classify.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { resolveWorshipForVideo } from './classify'
import type { ResolvedPlaylist } from './playlists'

const playlists: ResolvedPlaylist[] = [
  { playlistId: 'PL_SUN', worshipType: '주일예배', autoSummary: true, priority: 1 },
  { playlistId: 'PL_EVENT', worshipType: '특별행사', autoSummary: false, priority: 5 },
]

describe('resolveWorshipForVideo', () => {
  it('picks highest-priority playlist containing the video', () => {
    const membership = new Map([['PL_SUN', new Set(['v1'])], ['PL_EVENT', new Set(['v1'])]])
    expect(resolveWorshipForVideo('v1', playlists, membership)).toEqual({ worshipType: '주일예배', autoSummary: true })
  })
  it('returns null when not in any playlist', () => {
    expect(resolveWorshipForVideo('vX', playlists, new Map())).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/sermons/classify.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/lib/sermons/classify.ts`:

```typescript
import type { WorshipType } from '@/lib/types'
import type { ResolvedPlaylist } from './playlists'
import { resolvePlaylists } from './playlists'
import { listPlaylistVideos } from '@/lib/youtube/client'

export interface WorshipResolution {
  worshipType: WorshipType
  autoSummary: boolean
}

/** 우선순위 순으로 정렬된 playlists에서 videoId를 포함한 첫 재생목록의 worshipType 반환. */
export function resolveWorshipForVideo(
  videoId: string,
  playlists: ResolvedPlaylist[],
  membership: Map<string, Set<string>>
): WorshipResolution | null {
  for (const p of [...playlists].sort((a, b) => a.priority - b.priority)) {
    if (membership.get(p.playlistId)?.has(videoId)) {
      return { worshipType: p.worshipType, autoSummary: p.autoSummary }
    }
  }
  return null
}

/** 설정된 재생목록을 조회해 해당 videoId의 worshipType을 찾는다(미등록 시 null). */
export async function classifyVideo(videoId: string, env: Record<string, string | undefined>): Promise<WorshipResolution | null> {
  const apiKey = env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')
  const playlists = resolvePlaylists(env)
  const membership = new Map<string, Set<string>>()
  for (const p of playlists) {
    try {
      const videos = await listPlaylistVideos(p.playlistId, apiKey)
      membership.set(p.playlistId, new Set(videos.map((v) => v.videoId)))
    } catch (e) {
      console.error(`[classify] playlist ${p.playlistId} failed`, e)
    }
  }
  return resolveWorshipForVideo(videoId, playlists, membership)
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/sermons/classify.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/sermons/classify.ts src/lib/sermons/classify.test.ts
git commit -m "feat: videoId → worshipType 재생목록 분류"
```

### Task 4.2: ingest 의사결정(순수) + upsert

**Files:**
- Create: `src/lib/sermons/ingest.ts`
- Test: `src/lib/sermons/ingest.test.ts`

- [ ] **Step 1: 실패 테스트**

`src/lib/sermons/ingest.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { decideIngest, INGEST_MAX_RETRY } from './ingest'

describe('decideIngest', () => {
  it('skips when already in DB', () => {
    expect(decideIngest({ exists: true, worship: null, attempt: 0 }).action).toBe('skip')
  })
  it('retries when worship unresolved and attempts remain', () => {
    expect(decideIngest({ exists: false, worship: null, attempt: 0 }).action).toBe('retry')
  })
  it('inserts as 미분류 when retries exhausted', () => {
    const r = decideIngest({ exists: false, worship: null, attempt: INGEST_MAX_RETRY })
    expect(r).toMatchObject({ action: 'insert', worshipType: '미분류', autoSummary: false })
  })
  it('inserts with resolved worship', () => {
    const r = decideIngest({ exists: false, worship: { worshipType: '주일예배', autoSummary: true }, attempt: 0 })
    expect(r).toMatchObject({ action: 'insert', worshipType: '주일예배', autoSummary: true })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/sermons/ingest.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

`src/lib/sermons/ingest.ts`:

```typescript
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import type { WorshipType } from '@/lib/types'
import { DEFAULT_PREACHER } from '@/lib/constants'
import type { WorshipResolution } from './classify'
import type { YouTubeVideo } from '@/lib/youtube/client'

export const INGEST_MAX_RETRY = 3

export type IngestDecision =
  | { action: 'skip' }
  | { action: 'retry' }
  | { action: 'insert'; worshipType: WorshipType; autoSummary: boolean }

export function decideIngest(input: { exists: boolean; worship: WorshipResolution | null; attempt: number }): IngestDecision {
  if (input.exists) return { action: 'skip' }
  if (input.worship) return { action: 'insert', worshipType: input.worship.worshipType, autoSummary: input.worship.autoSummary }
  if (input.attempt < INGEST_MAX_RETRY) return { action: 'retry' }
  return { action: 'insert', worshipType: '미분류', autoSummary: false }
}

export async function sermonExists(videoId: string): Promise<boolean> {
  const [row] = await db.select({ id: sermons.id }).from(sermons).where(eq(sermons.youtubeVideoId, videoId)).limit(1)
  return !!row
}

/** draft가 아니라 즉시 공개(isPublished=true) 상태로 설교를 삽입. */
export async function insertSermon(video: YouTubeVideo, worshipType: WorshipType): Promise<string> {
  const [row] = await db.insert(sermons).values({
    title: video.title,
    preacher: DEFAULT_PREACHER,
    worshipType,
    sermonDate: (video.publishedAt || '').slice(0, 10),
    videoUrl: `https://youtu.be/${video.videoId}`,
    thumbnailUrl: video.thumbnailUrl,
    youtubeVideoId: video.videoId,
    durationSeconds: video.durationSeconds,
    summaryStatus: 'none',
    isPublished: true,
  }).onConflictDoNothing({ target: sermons.youtubeVideoId }).returning({ id: sermons.id })
  return row?.id ?? ''
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/sermons/ingest.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/sermons/ingest.ts src/lib/sermons/ingest.test.ts
git commit -m "feat: ingest 의사결정 + 즉시 공개 upsert"
```

### Task 4.3: 단일 영상 상세 조회 헬퍼

**Files:**
- Modify: `src/lib/youtube/client.ts`

- [ ] **Step 1: 구현 추가(네트워크 — 단위테스트 생략)**

`client.ts` 에 추가:

```typescript
interface VideoSnippetResponse {
  items?: Array<{
    id: string
    snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string } | undefined> }
    contentDetails?: { duration?: string }
  }>
}

/** 단일 videoId의 메타데이터 조회. 없으면(비공개/삭제) null. */
export async function getVideoById(videoId: string, apiKey: string): Promise<YouTubeVideo | null> {
  const url = new URL(`${API}/videos`)
  url.searchParams.set('part', 'snippet,contentDetails')
  url.searchParams.set('id', videoId)
  url.searchParams.set('key', apiKey)
  const data = await getJson<VideoSnippetResponse>(url.toString())
  const it = data.items?.[0]
  if (!it) return null
  const thumbs = it.snippet?.thumbnails ?? {}
  const thumb = thumbs.maxres ?? thumbs.high ?? thumbs.medium ?? thumbs.default
  return {
    videoId: it.id,
    title: it.snippet?.title ?? '',
    publishedAt: it.snippet?.publishedAt ?? '',
    thumbnailUrl: thumb?.url ?? null,
    durationSeconds: parseIso8601Duration(it.contentDetails?.duration ?? ''),
  }
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과.

```bash
git add src/lib/youtube/client.ts
git commit -m "feat: 단일 영상 메타데이터 조회 getVideoById"
```

---

## Phase 5 — QStash 헬퍼

### Task 5.1: publish/verify/self-republish 래퍼

**Files:**
- Create: `src/lib/qstash.ts`

- [ ] **Step 1: 구현(SDK 래퍼 — 단위테스트 생략, 타입체크로 검증)**

`src/lib/qstash.ts`:

```typescript
import { Client, Receiver } from '@upstash/qstash'

export type JobName = 'ingest-video' | 'fetch-transcript' | 'summarize'

function baseUrl(): string {
  const cb = process.env.WEBSUB_CALLBACK_URL
  if (!cb) throw new Error('WEBSUB_CALLBACK_URL not set')
  return new URL(cb).origin
}

const client = () => new Client({ token: process.env.QSTASH_TOKEN! })

/** QStash로 워커 작업을 발행. delaySeconds>0이면 지연 발행(패턴 B 재시도). */
export async function publishJob(job: JobName, body: unknown, delaySeconds = 0): Promise<void> {
  await client().publishJSON({
    url: `${baseUrl()}/api/jobs/${job}`,
    body,
    ...(delaySeconds > 0 ? { delay: delaySeconds } : {}),
  })
}

const receiver = () =>
  new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  })

/** QStash 서명 검증. 실패 시 false. */
export async function verifyQStash(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false
  try {
    return await receiver().verify({ body: rawBody, signature })
  } catch {
    return false
  }
}

export const RETRY_DELAY_SECONDS = 30 * 60
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과.

```bash
git add src/lib/qstash.ts
git commit -m "feat: QStash publish/서명검증 헬퍼"
```

---

## Phase 6 — 엔드포인트

### Task 6.1: WebSub 웹훅 라우트

**Files:**
- Create: `src/app/api/youtube/websub/route.ts`

- [ ] **Step 1: 구현**

```typescript
import { parseWebSubNotification, verifyWebSubSignature } from '@/lib/youtube/websub'
import { publishJob } from '@/lib/qstash'

// 구독 검증(GET): hub.challenge 에코
export async function GET(req: Request) {
  const url = new URL(req.url)
  const challenge = url.searchParams.get('hub.challenge')
  if (!challenge) return new Response('bad request', { status: 400 })
  return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } })
}

// 업로드 알림(POST): HMAC 검증 → ingest 발행 → 즉시 200
export async function POST(req: Request) {
  const secret = process.env.WEBSUB_SECRET
  if (!secret) return new Response('not configured', { status: 500 })
  const raw = await req.text()
  if (!verifyWebSubSignature(raw, req.headers.get('x-hub-signature'), secret)) {
    return new Response('invalid signature', { status: 400 })
  }
  const note = parseWebSubNotification(raw)
  if (note.kind === 'upload') {
    await publishJob('ingest-video', { videoId: note.videoId, attempt: 0 })
  }
  return new Response('ok', { status: 200 })
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과.

```bash
git add src/app/api/youtube/websub/route.ts
git commit -m "feat: WebSub 웹훅 라우트(GET 검증 / POST 알림→ingest)"
```

### Task 6.2: ingest-video 워커

**Files:**
- Create: `src/app/api/jobs/ingest-video/route.ts`

- [ ] **Step 1: 구현**

```typescript
import { verifyQStash, publishJob, RETRY_DELAY_SECONDS } from '@/lib/qstash'
import { classifyVideo } from '@/lib/sermons/classify'
import { decideIngest, sermonExists, insertSermon } from '@/lib/sermons/ingest'
import { getVideoById } from '@/lib/youtube/client'

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { videoId, attempt = 0 } = JSON.parse(raw) as { videoId: string; attempt?: number }

  if (await sermonExists(videoId)) return Response.json({ ok: true, skipped: 'exists' })

  const worship = await classifyVideo(videoId, process.env as Record<string, string | undefined>)
  const decision = decideIngest({ exists: false, worship, attempt })

  if (decision.action === 'retry') {
    await publishJob('ingest-video', { videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
    return Response.json({ ok: true, retry: attempt + 1 })
  }
  if (decision.action === 'skip') return Response.json({ ok: true, skipped: 'decided' })

  const apiKey = process.env.YOUTUBE_API_KEY!
  const video = await getVideoById(videoId, apiKey)
  if (!video) return Response.json({ ok: false, error: 'video not found' }, { status: 200 })

  const sermonId = await insertSermon(video, decision.worshipType)
  if (sermonId && decision.autoSummary) {
    await publishJob('fetch-transcript', { sermonId, videoId, attempt: 0 })
  }
  return Response.json({ ok: true, sermonId, worshipType: decision.worshipType })
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과.

```bash
git add src/app/api/jobs/ingest-video/route.ts
git commit -m "feat: ingest-video QStash 워커"
```

### Task 6.3: fetch-transcript 워커

**Files:**
- Create: `src/app/api/jobs/fetch-transcript/route.ts`

- [ ] **Step 1: 구현**

```typescript
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { verifyQStash, publishJob, RETRY_DELAY_SECONDS } from '@/lib/qstash'
import { fetchTranscript } from '@/lib/transcript/rapidapi'
import { buildTranscriptText } from '@/lib/transcript/prompt'

const MAX_TRANSCRIPT_RETRY = 12 // 30분 × 12 ≈ 6시간 대기

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId, videoId, attempt = 0 } = JSON.parse(raw) as { sermonId: string; videoId: string; attempt?: number }

  const segments = await fetchTranscript(videoId)
  if (segments.length === 0) {
    if (attempt < MAX_TRANSCRIPT_RETRY) {
      await publishJob('fetch-transcript', { sermonId, videoId, attempt: attempt + 1 }, RETRY_DELAY_SECONDS)
      return Response.json({ ok: true, retry: attempt + 1 })
    }
    await db.update(sermons).set({ summaryStatus: 'failed' }).where(eq(sermons.id, sermonId))
    return Response.json({ ok: true, gaveUp: true })
  }

  const transcriptText = buildTranscriptText(segments)
  await publishJob('summarize', { sermonId, transcriptText })
  return Response.json({ ok: true, segments: segments.length })
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과.

```bash
git add src/app/api/jobs/fetch-transcript/route.ts
git commit -m "feat: fetch-transcript QStash 워커(자막 준비 추적)"
```

### Task 6.4: summarize 워커

**Files:**
- Create: `src/app/api/jobs/summarize/route.ts`

- [ ] **Step 1: 구현**

```typescript
import { verifyQStash } from '@/lib/qstash'
import { claimSermonById, summarizeClaimed } from '@/lib/sermons/summarize'

export const maxDuration = 300

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  const { sermonId, transcriptText } = JSON.parse(raw) as { sermonId: string; transcriptText: string }

  const claimed = await claimSermonById(sermonId)
  if (!claimed) return Response.json({ ok: true, skipped: 'not claimable' })

  const status = await summarizeClaimed(claimed.id, claimed.durationSeconds, transcriptText)
  return Response.json({ ok: true, status })
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과.

```bash
git add src/app/api/jobs/summarize/route.ts
git commit -m "feat: summarize QStash 워커(원자 claim + 자막요약)"
```

### Task 6.5: websub-renew 워커

**Files:**
- Create: `src/app/api/jobs/websub-renew/route.ts`

- [ ] **Step 1: 구현**

```typescript
import { verifyQStash } from '@/lib/qstash'
import { subscribeToChannel } from '@/lib/youtube/websub'

export async function POST(req: Request) {
  const raw = await req.text()
  if (!(await verifyQStash(raw, req.headers.get('upstash-signature')))) {
    return new Response('unauthorized', { status: 401 })
  }
  await subscribeToChannel({
    channelId: process.env.YOUTUBE_CHANNEL_ID!,
    callbackUrl: process.env.WEBSUB_CALLBACK_URL!,
    secret: process.env.WEBSUB_SECRET!,
  })
  return Response.json({ ok: true })
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과.

```bash
git add src/app/api/jobs/websub-renew/route.ts
git commit -m "feat: websub-renew 워커(QStash Schedule용 구독 갱신)"
```

---

## Phase 7 — 최초 구독 스크립트

### Task 7.1: websub-subscribe 스크립트

**Files:**
- Create: `scripts/websub-subscribe.ts`
- Modify: `package.json`(scripts에 `websub:subscribe` 추가)

- [ ] **Step 1: 스크립트**

```typescript
import 'dotenv/config'
import { subscribeToChannel } from '../src/lib/youtube/websub'

async function main() {
  await subscribeToChannel({
    channelId: process.env.YOUTUBE_CHANNEL_ID!,
    callbackUrl: process.env.WEBSUB_CALLBACK_URL!,
    secret: process.env.WEBSUB_SECRET!,
  })
  console.log('subscribe request sent (hub will verify via callback)')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: package.json scripts 추가**

`"db:seed"` 줄 아래에 추가: `"websub:subscribe": "tsx scripts/websub-subscribe.ts",`

- [ ] **Step 3: 커밋**

```bash
git add scripts/websub-subscribe.ts package.json
git commit -m "feat: 최초 WebSub 구독 스크립트"
```

---

## Phase 8 — UI

### Task 8.1: SermonSummary 3상태 표시

**Files:**
- Modify: `src/components/sermons/SermonSummary.tsx:8-25`

- [ ] **Step 1: 진행중 placeholder 추가**

`SermonSummary.tsx` 의 `const ready = ...` 아래에 상태 분기를 추가하고, 플레이어 다음에 진행중 안내를 렌더:

```tsx
  const ready = sermon.summaryStatus === 'ready'
  const inProgress = sermon.summaryStatus === 'none' || sermon.summaryStatus === 'pending'
```

`<YouTubePlayer ... />` 바로 아래에 삽입:

```tsx
      {inProgress ? (
        <section className="rounded-lg border border-line bg-paper p-6 text-ink-muted shadow-subtle">
          <p className="leading-7">설교 요약 대기중..</p>
        </section>
      ) : null}
```

> `failed`는 `ready`도 `inProgress`도 아니므로 요약 섹션 전체가 자동으로 숨겨진다(영상은 정상 노출).

- [ ] **Step 2: 타입체크 + 빌드 확인**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: 커밋**

```bash
git add src/components/sermons/SermonSummary.tsx
git commit -m "feat: 설교 요약 대기중 상태 표시"
```

### Task 8.2: 미분류 worshipType 뱃지 숨김

**Files:**
- Modify: `src/components/sermons/SermonCard.tsx:32-34`
- Modify: `src/app/sermons/[id]/page.tsx:41`

- [ ] **Step 1: SermonCard 뱃지 조건부**

`SermonCard.tsx` 의 `<span>{sermon.worshipType}</span>` 를 교체:

```tsx
          <span>{sermon.worshipType === '미분류' ? '' : sermon.worshipType}</span>
```

- [ ] **Step 2: 상세 페이지 뱃지 조건부**

`src/app/sermons/[id]/page.tsx` 의
`<p className="text-sm font-semibold text-accent-deep">{sermon.worshipType}</p>` 를 교체:

```tsx
        {sermon.worshipType !== '미분류' ? (
          <p className="text-sm font-semibold text-accent-deep">{sermon.worshipType}</p>
        ) : null}
```

> `WorshipFilter`/`worshipFilterItems`는 `미분류`를 애초에 포함하지 않으므로 필터 탭은 수정 불필요. 단 `getSermonsByWorshipType`에 `미분류`가 전달될 일은 없다(필터에 없음).

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 통과.

```bash
git add src/components/sermons/SermonCard.tsx src/app/sermons/[id]/page.tsx
git commit -m "feat: 미분류 worshipType 공개 뱃지 숨김"
```

---

## Phase 9 — 정리(cron/구버전 제거) · env

### Task 9.1: 구 cron 라우트 · syncSermons · vercel.json 제거

**Files:**
- Delete: `src/app/api/cron/sync-sermons/route.ts`, `src/app/api/cron/summarize-sermons/route.ts`
- Modify: `vercel.json`
- Modify: `src/lib/sermons/summarize.ts`(영상 URL 기반 함수 제거)
- Modify/Delete: `src/lib/sermons/sync.ts`

- [ ] **Step 1: cron 라우트 삭제**

Run:
```bash
git rm src/app/api/cron/sync-sermons/route.ts src/app/api/cron/summarize-sermons/route.ts
```

- [ ] **Step 2: vercel.json의 crons 제거**

`vercel.json` 을 빈 설정으로 교체:

```json
{}
```

- [ ] **Step 3: summarize.ts에서 영상 URL 기반 구버전 함수 제거**

`src/lib/sermons/summarize.ts` 에서 `claimNextSermon`, `processClaimedSermon`, `runSummaryWorker`, `generateSummaryForSermon`(영상 URL 입력판)을 삭제. `import { generateSermonSummary }`는 유지(`summarizeClaimed`에서 사용). `ClaimedSummon`/관련 미사용 인터페이스 정리.

- [ ] **Step 4: sync.ts 처리**

`syncSermons()`(전역 폴링)를 삭제한다. `planSermonInserts`가 어디서도 import되지 않으면 파일 전체 삭제:

Run: `grep -rn "planSermonInserts\|syncSermons" src` 로 참조 확인 후, 미참조면 `git rm src/lib/sermons/sync.ts` 및 `src/lib/sermons/sync.test.ts`.

- [ ] **Step 5: 전체 타입체크·테스트·빌드**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: 타입 통과, 모든 테스트 PASS, 빌드 성공. (실패 시 잔존 import 정리)

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "refactor: Vercel cron·영상URL 요약·전역 동기화 제거(WebSub+QStash 전환)"
```

### Task 9.2: CRON_SECRET 제거 · .env.example 갱신

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: .env.example 갱신**

`CRON_SECRET` 줄 삭제, 아래 신규 키 추가:

```
# QStash
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
# RapidAPI YouTube Transcript
RAPIDAPI_KEY=
RAPIDAPI_TRANSCRIPT_HOST=
# WebSub
WEBSUB_CALLBACK_URL=
WEBSUB_SECRET=
YOUTUBE_CHANNEL_ID=
```

- [ ] **Step 2: CRON_SECRET 잔존 참조 확인**

Run: `grep -rn "CRON_SECRET" src`
Expected: 결과 없음(있으면 제거).

- [ ] **Step 3: 커밋**

```bash
git add .env.example
git commit -m "chore: env에서 CRON_SECRET 제거, QStash/RapidAPI/WebSub 키 추가"
```

---

## 배포 후 1회성 작업 (수동, plan 범위 외 체크리스트)

- Vercel 환경변수에 신규 키 전부 등록(QStash·RapidAPI·WebSub·YOUTUBE_CHANNEL_ID).
- Upstash 콘솔에서 **QStash Schedule** 생성: 하루 1회 `POST {APP}/api/jobs/websub-renew`.
- 배포 후 `npm run websub:subscribe` 1회 실행(허브가 콜백 GET으로 검증 → 구독 활성).
- 테스트 업로드 1건으로 ingest→transcript→summarize 전 구간 동작 확인.

---

## Self-Review (작성자 점검 결과)

- **Spec 커버리지**: 업로드 감지(6.1)·실데이터(4.1/4.3)·QStash 분리(5/6)·자막수집(2)·자막요약(3)·즉시공개+설교자기본값(4.2)·미분류 숨김(8.2)·요약대기중(8.1)·멱등(ingest 6.2/claim 3.2)·구독갱신(6.5)·정리(9) 모두 태스크 존재. ✅
- **Placeholder**: RapidAPI 응답 필드/경로는 "제공자 확인 필요"로 명시(가정 명확화), 그 외 실제 코드 제공. ✅
- **타입 일관성**: `TranscriptSegment`(prompt.ts 정의, rapidapi.ts·prompt.ts·워커 공유), `WorshipResolution`(classify.ts), `IngestDecision`(ingest.ts), `JobName`(qstash.ts) 명칭 교차 일치. `generateSermonSummary(transcriptText, durationSeconds)` 시그니처가 3.1 정의 = 3.2 호출 일치. ✅
