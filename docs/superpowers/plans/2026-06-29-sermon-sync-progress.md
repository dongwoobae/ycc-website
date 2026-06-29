# 설교 동기화 실시간 진행률 (SSE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 설교 동기화 버튼에 SSE 기반 실시간 진행률 모달을 붙여, 비개발자가 진행상황을 보고 중간에 창을 닫지 않도록 한다.

**Architecture:** `resyncAllSermons`에 `onProgress` 콜백을 추가하고, 신규 SSE 라우트(`POST /api/admin/sermons/sync/stream`)가 이를 `ReadableStream`으로 송출한다. 프론트는 `useSermonSync` 훅이 스트림을 읽어 `SermonSyncModal`(confirm→progress→done)을 구동한다.

**Tech Stack:** Next.js 16 (App Router, Route Handlers, nodejs runtime), better-auth(쿠키 세션), drizzle-orm/neon-http, QStash, TypeScript, Tailwind, Vitest.

> **codex 비판 반영본 (2026-06-29):** GET→POST(CSRF), `runtime/dynamic`+heartbeat(Vercel 스트리밍), `revalidatePath`(공개 ISR), SSE 파서 순수함수 추출+테스트, transcript 실패 시 QStash 폴백, 클라 타임아웃 330s+언마운트 abort. **동시실행 서버락은 neon-http(stateless)에서 advisory lock 불가 → 클라 lockRef만 유지(다탭 동시는 known limitation).**

---

## File Structure

신규:
- `src/lib/sse.ts` — `formatSse`(직렬화) + `drainSseEvents`(파싱) 순수 헬퍼.
- `src/app/api/admin/sermons/sync/stream/route.ts` — 인증 + 스트리밍 POST 핸들러.
- `src/components/admin/useSermonSync.ts` — 모달 상태 + SSE 리더 훅.
- `src/components/admin/SermonSyncModal.tsx` — 모달 표현 컴포넌트.

수정:
- `src/lib/sermons/sync.ts` — `resyncAllSermons(onProgress?)` + `SyncProgress` 타입 + transcript 실패 QStash 폴백.
- `src/lib/actions/sermons.ts` — 미사용 `syncNowAction` 제거.
- `src/components/admin/SermonAdminTable.tsx` — 버튼을 모달 흐름으로 교체, 안내문구 갱신.

테스트:
- `src/lib/sse.test.ts`
- `src/lib/sermons/sync.test.ts` (기존 파일에 케이스 추가)

---

## Task 1: 작업 브랜치 + 기존 yt-api 전환 커밋

기존 작업트리에 yt-api 전환(sync.ts) 변경이 미커밋 상태다. 먼저 브랜치를 만들고 그 변경 + 설계/플랜 문서를 독립 커밋한다.

**Files:**
- Modify: (이미 변경된) `src/lib/sermons/sync.ts`

- [ ] **Step 1: 브랜치 생성**

Run:
```bash
git checkout -b feat/sermon-sync-progress
```
Expected: `Switched to a new branch 'feat/sermon-sync-progress'`

- [ ] **Step 2: 기존 yt-api 전환 + 문서 커밋**

```bash
git add src/lib/sermons/sync.ts docs/superpowers/specs/2026-06-29-sermon-sync-progress-design.md docs/superpowers/plans/2026-06-29-sermon-sync-progress.md
git commit -m "feat: 설교 동기화를 yt-api 채널 기반으로 전환"
```

---

## Task 2: SSE 헬퍼 — `formatSse` + `drainSseEvents`

직렬화(서버)와 파싱(클라)을 순수 함수로 분리해 단위테스트로 회귀를 잡는다.

**Files:**
- Create: `src/lib/sse.ts`
- Test: `src/lib/sse.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/sse.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatSse, drainSseEvents } from './sse'

describe('formatSse', () => {
  it('event/data 줄과 빈 줄 종료로 직렬화한다', () => {
    expect(formatSse('progress', { current: 1, total: 3 })).toBe(
      'event: progress\ndata: {"current":1,"total":3}\n\n',
    )
  })
})

describe('drainSseEvents', () => {
  it('완성된 이벤트만 파싱하고 미완성 나머지는 rest로 남긴다', () => {
    const { events, rest } = drainSseEvents('event: progress\ndata: {"current":1}\n\nevent: done\ndata: {')
    expect(events).toEqual([{ event: 'progress', data: '{"current":1}' }])
    expect(rest).toBe('event: done\ndata: {')
  })

  it('주석(heartbeat) 라인은 무시한다', () => {
    const { events } = drainSseEvents(': ping\n\nevent: done\ndata: {"inserted":0}\n\n')
    expect(events).toEqual([{ event: 'done', data: '{"inserted":0}' }])
  })

  it('data가 없는 이벤트는 건너뛴다', () => {
    const { events } = drainSseEvents('event: noop\n\n')
    expect(events).toEqual([])
  })

  it('여러 data 라인은 개행으로 합친다', () => {
    const { events } = drainSseEvents('event: x\ndata: a\ndata: b\n\n')
    expect(events).toEqual([{ event: 'x', data: 'a\nb' }])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/sse.test.ts`
Expected: FAIL — `Failed to resolve import './sse'`

- [ ] **Step 3: 최소 구현**

Create `src/lib/sse.ts`:
```ts
/** Server-Sent Events 한 메시지를 `event:`/`data:` + 빈 줄 종료로 직렬화한다. */
export function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export interface SseEvent {
  event: string
  data: string
}

/**
 * 누적 버퍼에서 완성된 SSE 이벤트들을 뽑아내고, 끝의 미완성 조각은 rest로 돌려준다.
 * - `\n\n`(또는 `\r\n\r\n`)로 이벤트 경계 분할
 * - `:`로 시작하는 주석/heartbeat 라인 무시
 * - 여러 `data:` 라인은 개행으로 합침 (SSE 스펙)
 * - `data`가 하나도 없는 이벤트는 제외
 */
export function drainSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/)
  const rest = parts.pop() ?? ''
  const events: SseEvent[] = []
  for (const raw of parts) {
    if (!raw.trim()) continue
    let event = ''
    const dataLines: string[] = []
    for (const line of raw.split(/\r?\n/)) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (dataLines.length === 0) continue
    events.push({ event, data: dataLines.join('\n') })
  }
  return { events, rest }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/sse.test.ts`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/sse.ts src/lib/sse.test.ts
git commit -m "feat: SSE 직렬화/파싱 헬퍼(formatSse, drainSseEvents) 추가"
```

---

## Task 3: `resyncAllSermons` onProgress 콜백 + transcript 폴백

신규 영상을 먼저 선별해 `total`을 확정하고, 영상별 처리 직전 콜백을 호출한다. 자막 미준비/실패 시 QStash `fetch-transcript`로 백그라운드 재시도를 best-effort 발행해 "영구 미요약" 갭을 줄인다.

**Files:**
- Modify: `src/lib/sermons/sync.ts`
- Test: `src/lib/sermons/sync.test.ts` (케이스 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/sermons/sync.test.ts`의 기존 `vi.mock('@/lib/db', () => ({ db: {} }))` 줄을 아래 블록으로 교체한다(상단 import 바로 아래 mock들이 위치):
```ts
vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => Promise.resolve([]) }) },
}))
vi.mock('@/lib/youtube/rapidapi-channel', () => ({ fetchChannelVideos: vi.fn() }))
vi.mock('./ingest', () => ({ insertSermon: vi.fn(async () => 'sid') }))
vi.mock('./summarize', () => ({
  fetchAndStoreTranscript: vi.fn(),
  claimSermonById: vi.fn(),
  summarizeClaimed: vi.fn(),
}))
vi.mock('@/lib/qstash', () => ({ publishJob: vi.fn(async () => undefined) }))
```

파일 끝에 추가:
```ts
import { resyncAllSermons } from './sync'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import { fetchAndStoreTranscript } from './summarize'
import { publishJob } from '@/lib/qstash'

const vid = (videoId: string, title: string) => ({
  videoId,
  title,
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnailUrl: null,
  durationSeconds: 10,
})

describe('resyncAllSermons onProgress', () => {
  it('신규 영상별로 current/total 진행을 통지한다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    // 비요약 유형('특송')만 써서 transcript/summarize 경로를 타지 않게 한다.
    vi.mocked(fetchChannelVideos).mockResolvedValue([vid('a', '특송 - 은혜'), vid('b', '특송 - 사랑')])

    const calls: Array<{ current: number; total: number }> = []
    const result = await resyncAllSermons((p) => calls.push({ current: p.current, total: p.total }))

    expect(calls).toEqual([
      { current: 1, total: 2 },
      { current: 2, total: 2 },
    ])
    expect(result.inserted).toBe(2)
  })

  it('자막 미준비(요약 유형)면 QStash fetch-transcript로 폴백 발행한다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    vi.mocked(fetchChannelVideos).mockResolvedValue([vid('c', '주일예배 - 말씀')])
    vi.mocked(fetchAndStoreTranscript).mockRejectedValue(new Error('자막 미준비'))

    const result = await resyncAllSermons()

    expect(result.inserted).toBe(1)
    expect(result.summarized).toBe(0)
    expect(publishJob).toHaveBeenCalledWith('fetch-transcript', { sermonId: 'sid', videoId: 'c' })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/sermons/sync.test.ts`
Expected: FAIL — onProgress 미통지 + publishJob 미호출.

- [ ] **Step 3: 구현 교체**

`src/lib/sermons/sync.ts` 상단 import에 추가:
```ts
import { publishJob } from '@/lib/qstash'
```

`AUTO_SUMMARY_TYPES` 선언 위(또는 아래)에 타입 추가:
```ts
export interface SyncProgress {
  current: number
  total: number
  title: string
  phase: string
}
```

`resyncAllSermons` 함수 전체를 아래로 교체:
```ts
export async function resyncAllSermons(
  onProgress?: (p: SyncProgress) => void,
): Promise<{ inserted: number; summarized: number }> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID is not set')
  const maxPages = Number(process.env.SYNC_MAX_PAGES ?? 4)

  let inserted = 0
  let summarized = 0
  const existing = await db.select({ id: sermons.youtubeVideoId }).from(sermons)
  const existingIds = new Set(existing.map((r) => r.id).filter((x): x is string => !!x))

  const videos = await fetchChannelVideos(channelId, maxPages)
  const newVideos = videos.filter((v) => !existingIds.has(v.videoId))
  const total = newVideos.length

  let current = 0
  for (const video of newVideos) {
    current++
    const worshipType = classifyByTitle(video.title)
    const autoSummary = AUTO_SUMMARY_TYPES.has(worshipType)
    onProgress?.({ current, total, title: video.title, phase: autoSummary ? '자막·요약 중' : '등록' })

    const sermonId = await insertSermon(video, worshipType)
    if (!sermonId) continue
    inserted++
    if (!autoSummary) continue

    let transcriptText: string
    try {
      transcriptText = await fetchAndStoreTranscript(sermonId, video.videoId)
    } catch {
      // 자막 미준비 — 등록만 하고, 백그라운드(QStash)로 재시도를 넘긴다(best-effort).
      try {
        await publishJob('fetch-transcript', { sermonId, videoId: video.videoId })
      } catch {
        // QStash 미설정(로컬 등)에서도 동기화 자체는 계속 진행.
      }
      continue
    }
    const claimed = await claimSermonById(sermonId)
    if (!claimed) continue
    const status = await summarizeClaimed(claimed.id, claimed.durationSeconds, transcriptText)
    if (status === 'ready') summarized++
  }
  return { inserted, summarized }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/sermons/sync.test.ts`
Expected: PASS (planSermonInserts 2 + onProgress 1 + 폴백 1)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/sermons/sync.ts src/lib/sermons/sync.test.ts
git commit -m "feat: resyncAllSermons 진행률 콜백 + 자막 미준비 QStash 폴백"
```

---

## Task 4: SSE 스트리밍 라우트 (POST)

**Files:**
- Create: `src/app/api/admin/sermons/sync/stream/route.ts`

- [ ] **Step 1: 라우트 구현**

Create `src/app/api/admin/sermons/sync/stream/route.ts`:
```ts
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { formatSse } from '@/lib/sse'
import { resyncAllSermons } from '@/lib/sermons/sync'

// 인라인 자막+요약을 포함하므로 기본(60s)보다 길게. ⚠️ Vercel Hobby는 60s 상한.
export const maxDuration = 300
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEARTBEAT_MS = 15_000

// 상태변경이므로 GET 아닌 POST (CSRF: 쿠키 세션 + same-origin).
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return new Response('unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // 이미 닫힘
        }
      }
      const send = (event: string, data: unknown) => safeEnqueue(formatSse(event, data))
      // 프록시 idle 종료 방지용 heartbeat(주석 라인).
      const heartbeat = setInterval(() => safeEnqueue(': ping\n\n'), HEARTBEAT_MS)

      try {
        const result = await resyncAllSermons((p) => send('progress', p))
        // 공개 페이지 ISR 캐시 무효화 (기존 syncNowAction 동작 복원).
        revalidatePath('/')
        revalidatePath('/sermons')
        revalidatePath('/admin/sermons')
        send('done', result)
      } catch (e) {
        send('error', { message: e instanceof Error ? e.message : String(e) })
      } finally {
        clearInterval(heartbeat)
        closed = true
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음(출력 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/admin/sermons/sync/stream/route.ts
git commit -m "feat: 설교 동기화 SSE 스트리밍 라우트(POST) 추가"
```

---

## Task 5: `useSermonSync` 훅

**Files:**
- Create: `src/components/admin/useSermonSync.ts`

- [ ] **Step 1: 훅 구현**

Create `src/components/admin/useSermonSync.ts`:
```ts
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { drainSseEvents } from '@/lib/sse'

export type SyncPhase = 'idle' | 'confirm' | 'progress' | 'done'

export interface SyncProgressState {
  current: number
  total: number
  title: string
  phase: string
}

// 서버 maxDuration(300s) 직후를 덮는 backstop. 보통은 스트림 close로 먼저 끝난다.
const SYNC_TIMEOUT_MS = 330_000
const INITIAL: SyncProgressState = { current: 0, total: 0, title: '', phase: '' }

export function useSermonSync() {
  const router = useRouter()
  const [phase, setPhase] = useState<SyncPhase>('idle')
  const [progress, setProgress] = useState<SyncProgressState>(INITIAL)
  const [doneMsg, setDoneMsg] = useState('')
  const lockRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  // 언마운트 시 진행 중 요청 정리(누수 방지).
  useEffect(() => () => abortRef.current?.abort(), [])

  function open() {
    setProgress(INITIAL)
    setDoneMsg('')
    setPhase('confirm')
  }

  function close() {
    if (phase === 'progress') return // 진행 중엔 닫기 차단
    const wasDone = phase === 'done'
    setPhase('idle')
    if (wasDone) router.refresh() // 관리자 표 갱신
  }

  function applyEvent(event: string, dataStr: string): boolean {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(dataStr)
    } catch {
      return false // 깨진 이벤트 건너뜀
    }
    if (event === 'progress') {
      setProgress(data as unknown as SyncProgressState)
      return false
    }
    if (event === 'done') {
      const inserted = Number(data.inserted ?? 0)
      const summarized = Number(data.summarized ?? 0)
      setDoneMsg(
        inserted === 0
          ? '추가된 새 영상이 없습니다.'
          : `동기화 완료: ${inserted}건 추가${summarized ? `, ${summarized}건 요약` : ''}`,
      )
      setPhase('done')
      return true
    }
    if (event === 'error') {
      setDoneMsg(`동기화 실패: ${String(data.message ?? '')}`)
      setPhase('done')
      return true
    }
    return false
  }

  async function start() {
    if (lockRef.current) return
    lockRef.current = true
    setPhase('progress')
    setProgress({ ...INITIAL, phase: '영상 목록 확인 중...' })

    const controller = new AbortController()
    abortRef.current = controller
    const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
    try {
      const res = await fetch('/api/admin/sermons/sync/stream', { method: 'POST', signal: controller.signal })
      if (!res.ok || !res.body) throw new Error()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let completed = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { events, rest } = drainSseEvents(buffer)
        buffer = rest
        for (const ev of events) {
          if (applyEvent(ev.event, ev.data)) completed = true
        }
      }

      if (!completed) {
        setDoneMsg('연결이 끊겼습니다. 일부만 처리됐을 수 있으니 다시 실행해 주세요.')
        setPhase('done')
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      setDoneMsg(isAbort ? '동기화 요청이 시간 초과되었습니다.' : '동기화에 실패했습니다.')
      setPhase('done')
    } finally {
      clearTimeout(timeout)
      abortRef.current = null
      lockRef.current = false
    }
  }

  return { phase, progress, doneMsg, open, start, close }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/admin/useSermonSync.ts
git commit -m "feat: 설교 동기화 SSE 리더 훅 useSermonSync 추가"
```

---

## Task 6: `SermonSyncModal` 컴포넌트

**Files:**
- Create: `src/components/admin/SermonSyncModal.tsx`

- [ ] **Step 1: 모달 구현**

Create `src/components/admin/SermonSyncModal.tsx`:
```tsx
'use client'

import type { SyncPhase, SyncProgressState } from './useSermonSync'

interface Props {
  phase: SyncPhase
  progress: SyncProgressState
  doneMsg: string
  onStart: () => void
  onClose: () => void
}

export default function SermonSyncModal({ phase, progress, doneMsg, onStart, onClose }: Props) {
  if (phase === 'idle') return null
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-paper shadow-2xl">
        <div className="flex h-11 items-center justify-between bg-accent-deep px-5 text-white">
          <h3 className="text-sm font-semibold">설교 동기화</h3>
          {phase !== 'progress' && (
            <button type="button" onClick={onClose} aria-label="닫기" className="text-white/80 hover:text-white">
              ✕
            </button>
          )}
        </div>

        <div className="space-y-4 p-5 text-sm">
          {phase === 'confirm' && (
            <>
              <p className="leading-6 text-ink">
                YouTube 채널에서 새 영상만 가져와 즉시 공개 등록합니다. 예배(주일·수요·금요·찬양)는 자막이 있으면 요약까지
                자동 생성돼요. 진행 중에는 창을 닫지 마세요.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-ink-muted">
                  취소
                </button>
                <button type="button" onClick={onStart} className="rounded-md bg-accent-deep px-4 py-2 font-semibold text-white">
                  시작
                </button>
              </div>
            </>
          )}

          {phase === 'progress' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">{progress.phase || '처리 중...'}</span>
                <span className="text-ink-muted">{progress.total > 0 ? `${progress.current} / ${progress.total}건` : ''}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div className="h-2 rounded-full bg-accent-deep transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              {progress.title && <p className="truncate text-ink-muted">{progress.title}</p>}
              <p className="text-center text-xs text-ink-muted">진행 중에는 창을 닫지 마세요.</p>
            </div>
          )}

          {phase === 'done' && (
            <>
              <p className="text-ink">{doneMsg}</p>
              <div className="flex justify-end">
                <button type="button" onClick={onClose} className="rounded-md bg-accent-deep px-4 py-2 font-semibold text-white">
                  확인
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/admin/SermonSyncModal.tsx
git commit -m "feat: 설교 동기화 진행률 모달 SermonSyncModal 추가"
```

---

## Task 7: `SermonAdminTable` 연결 + 미사용 액션 제거

**Files:**
- Modify: `src/components/admin/SermonAdminTable.tsx`
- Modify: `src/lib/actions/sermons.ts`

- [ ] **Step 1: SermonAdminTable import 교체**

`src/components/admin/SermonAdminTable.tsx`의 import 줄
```tsx
import { syncNowAction, togglePublishAction } from '@/lib/actions/sermons'
```
을 아래로 교체:
```tsx
import { togglePublishAction } from '@/lib/actions/sermons'
import { useSermonSync } from './useSermonSync'
import SermonSyncModal from './SermonSyncModal'
```

- [ ] **Step 2: 훅 인스턴스화**

컴포넌트 본문 상단 상태 선언부:
```tsx
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')
```
바로 아래에 추가:
```tsx
  const sync = useSermonSync()
```

- [ ] **Step 3: 동기화 버튼 onClick 교체**

기존 동기화 `<button ... 지금 동기화 </button>` 블록 전체를 아래로 교체:
```tsx
        <button
          type="button"
          title="YouTube 채널에서 새 영상만 가져와 즉시 공개 등록합니다. 예배(주일·수요·금요·찬양)는 자막 요약까지 자동 생성됩니다."
          onClick={sync.open}
          className="rounded-md bg-accent-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          지금 동기화
        </button>
```

- [ ] **Step 4: 안내 문단 문구 갱신("플레이리스트"→"채널")**

기존 안내 `<p ...>` 블록을 아래로 교체:
```tsx
      <p className="mb-4 text-xs leading-5 text-ink-muted">
        <strong className="font-semibold text-ink">지금 동기화</strong> — YouTube 채널에서 새 영상만 가져와 즉시 공개
        등록합니다. 예배(주일·수요·금요·찬양)는 자막이 있으면 요약까지 자동 생성돼요. 기존 설교는 변경되지 않습니다.
      </p>
```

- [ ] **Step 5: 모달 렌더링 추가**

컴포넌트 최상위 반환 `<div>`의 마지막(닫는 `</div>` 직전)에 추가:
```tsx
      <SermonSyncModal
        phase={sync.phase}
        progress={sync.progress}
        doneMsg={sync.doneMsg}
        onStart={sync.start}
        onClose={sync.close}
      />
```

- [ ] **Step 6: `syncNowAction` 제거**

`src/lib/actions/sermons.ts`에서 함수 전체 삭제:
```ts
export async function syncNowAction() {
  await requireAdmin()
  const result = await resyncAllSermons()
  revalidateSermonPaths()
  return result
}
```
그리고 미사용 import 삭제:
```ts
import { resyncAllSermons } from '@/lib/sermons/sync'
```

- [ ] **Step 7: 타입체크 + 린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음. (미사용 `resyncAllSermons`/`syncNowAction` 경고 없음)

- [ ] **Step 8: 커밋**

```bash
git add src/components/admin/SermonAdminTable.tsx src/lib/actions/sermons.ts
git commit -m "feat: 설교 동기화 버튼을 진행률 모달 흐름으로 교체"
```

---

## Task 8: 전체 검증

**Files:** (검증만)

- [ ] **Step 1: 단위 테스트 전체**

Run: `npm test`
Expected: 전체 PASS (sse 5 + sync 4 포함)

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: 빌드 성공. 라우트 출력에 `ƒ /api/admin/sermons/sync/stream`(dynamic) 포함.

- [ ] **Step 3: 수동 검증 (로컬)**

```bash
npm run dev
```
1. `http://localhost:3000/admin/sermons` 로그인 후 접속.
2. "지금 동기화" → confirm 모달 표시.
3. "시작" → progress 단계에서 닫기(✕) 버튼 숨김·바 갱신 확인. 신규 0건이면 즉시 "추가된 새 영상이 없습니다."
4. done에서 "확인" → 모달 닫히고 표 갱신(router.refresh).
5. 미인증 호출 401 확인:
```bash
curl -i -X POST http://localhost:3000/api/admin/sermons/sync/stream
```
Expected: `HTTP/1.1 401`
6. (선택) 인증 쿠키로 스트림 흐름 확인:
```bash
curl -N -X POST http://localhost:3000/api/admin/sermons/sync/stream -H "Cookie: <better-auth 세션쿠키>"
```
Expected: `event: progress`/`: ping`/`event: done` 라인이 순차 출력(한 번에 몰아서 X).

- [ ] **Step 4: 검증 결과 보고**

테스트/빌드 출력과 수동 확인 결과를 사용자에게 보고한다. (superpowers:verification-before-completion)

> **배포 주의(문서화):** Vercel Hobby는 함수 60s 상한이라 `maxDuration=300`이 무시될 수 있다. 신규 영상이 많은 최초 동기화는 중간에 끊길 수 있으며(스트림 close→"연결이 끊겼습니다"), insert 멱등 + 자막 QStash 폴백으로 재실행/백그라운드 보완된다. 실배포 환경에서 curl로 실제 flush를 1회 확인할 것.

---

## Known Limitations (문서화)

- **다탭/다사용자 동시 동기화 미방지**: 클라 `lockRef`는 같은 탭 재클릭만 차단. neon-http(stateless)에서 pg advisory lock이 작동 불가하고 row-lock은 마이그레이션 비용이 있어, 폐쇄몰·관리자 소수 전제로 서버 가드는 두지 않음(충돌해도 insert 멱등, 중복 외부 API 비용만 일부 발생).
- **insert 후 요약 전 프로세스 강제종료**: 해당 영상은 status가 'none'/'pending'으로 남고 retry-summaries 크론('failed'+자막 보유만 회수)이 못 잡을 수 있음. 자막 단계 실패는 QStash 폴백으로 보완되나, 자막 성공 후 요약 중 강제종료는 잔여 갭으로 남음 → 설교별 수동 'AI 요약 생성'으로 보완 가능.

---

## Self-Review Notes

- **Spec 커버리지**: SSE 라우트(Task4), onProgress(Task3), 헬퍼(Task2), 훅/모달(Task5·6), 버튼·문구(Task7), 검증·401(Task8). codex 비판 8건: #1·#2·#4·#7 Task4, #5·#8 Task2·3·5, #3 Task3, #6 Known Limitations.
- **타입 일관성**: `SyncProgress`(sync.ts) ↔ progress 이벤트 data ↔ `SyncProgressState`(훅) 동일 형태({current,total,title,phase}). `SseEvent`{event,data} = drainSseEvents 반환 ↔ 훅 applyEvent 인자. done data {inserted,summarized} ↔ applyEvent 키 일치.
- **플레이스홀더**: 없음. 모든 코드 단계 전체 코드 포함.
