# 설교 YouTube 동기화 + AI 요약 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교회 YouTube 재생목록의 예배 영상을 자동 동기화해 `sermons`에 등록하고, Gemini로 빠른 요약(~10줄)과 타임스탬프별 요약을 생성·표시한다.

**Architecture:** 백엔드 파이프라인(YouTube Data API 동기화 → claim 기반 큐 → Gemini 요약)을 먼저 만들고, 그 위에 공개 페이지(IFrame Player seek)와 admin CRUD UI를 올린다. 순수 로직(파싱·매핑·검증·재시도 정책)은 별도 함수로 분리해 TDD로 검증하고, I/O·UI는 얇은 래퍼로 둔다.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM + Neon(neon-http), `@google/genai`(Gemini 3.5 Flash), `zod`, vitest. 배포: Vercel(cron).

**Spec:** `docs/superpowers/specs/2026-06-20-sermon-youtube-ai-summary-design.md`

## Global Constraints

- Next.js 16 규칙은 학습 데이터와 다를 수 있음 — 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인할 것 (AGENTS.md).
- DB 드라이버는 **neon-http** (`drizzle-orm/neon-http`) → **interactive transaction 불가**. 상태 선점은 반드시 단일 원자적 `UPDATE`로.
- `summary_status` 값: `none | pending | ready | failed`. 기본 `none`.
- `MAX_SUMMARY_ATTEMPTS = 3`, `STALE_PENDING_MS = 10 * 60 * 1000`.
- 요약 모델 상수: `gemini-3.5-flash` (env `GEMINI_MODEL`로 override 가능).
- WorshipType 7종: `주일예배 | 주일찬양예배 | 수요예배 | 금요기도회 | 시온찬양대 | 특송 | 특별행사`.
- 외부 API(YouTube, Gemini)는 테스트에서 **절대 실제 호출 금지** — mock.
- 모든 admin/cron 진입점은 인증 가드(`requireAdmin` 또는 `CRON_SECRET`) 통과 필수.
- 커밋 메시지는 한국어 + Conventional Commits, 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**생성 (백엔드)**
- `src/lib/sermons/format.ts` / `.test.ts` — 초 → `MM:SS`/`H:MM:SS` 포맷
- `src/lib/youtube/client.ts` / `.test.ts` — YouTube Data API(fetch) + ISO8601 duration 파싱
- `src/lib/sermons/playlists.ts` / `.test.ts` — 재생목록 설정 맵(env → worshipType/autoSummary/priority)
- `src/lib/sermons/sync.ts` / `.test.ts` — `planSermonInserts`(순수) + `syncSermons`(I/O)
- `src/lib/ai/sermon-summary.ts` / `.test.ts` — Gemini 호출 + `parseSermonSummary`(Zod, 순수)
- `src/lib/sermons/summarize.ts` / `.test.ts` — 재시도 정책(순수) + claim/process/worker(I/O)
- `src/lib/actions/sermons.ts` — admin 서버 액션
- `src/app/api/cron/sync-sermons/route.ts` — 동기화 cron
- `src/app/api/cron/summarize-sermons/route.ts` — 요약 워커 cron
- `vercel.json` — cron 스케줄

**생성 (프론트)**
- `src/components/sermons/YouTubePlayer.tsx` — IFrame Player API client 래퍼
- `src/components/sermons/SermonSummary.tsx` — 빠른요약 + 타임라인(클릭 seek)
- `src/app/admin/sermons/[id]/edit/page.tsx` — 검수/편집 페이지
- `src/components/admin/SermonAdminTable.tsx` — admin 목록 테이블(client, 액션 버튼)

**수정**
- `src/lib/db/schema.ts` — sermons 컬럼 추가 + `preacher` nullable
- `src/lib/types.ts` — WorshipType 7종, `SermonChapter`, `Sermon` 필드
- `src/lib/worship.ts` — `worshipTypes`/`worshipLabels` 7종
- `src/lib/data/sermons.ts` — 신규 컬럼 select + 매핑
- `src/app/sermons/[id]/page.tsx` — Player + 요약 섹션
- `src/app/admin/sermons/page.tsx` — 실제 목록
- `.env.example`(없으면 생성) — 신규 env 키 문서화

---

## Task 0: 의존성 설치 + env 키 문서화

**Files:**
- Modify: `package.json`
- Create: `.env.example`

- [ ] **Step 1: 의존성 설치**

```bash
npm install zod @google/genai
```

- [ ] **Step 2: `.env.example` 작성**

```
# YouTube Data API v3
YOUTUBE_API_KEY=

# Gemini (영상 이해) — gemini-3.5-flash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash

# cron 보호 (Authorization: Bearer <CRON_SECRET>)
CRON_SECRET=

# 동기화 대상 재생목록 ID (YouTube 재생목록 URL의 list= 값)
YT_PLAYLIST_SUNDAY=
YT_PLAYLIST_SUNDAY_PRAISE=
YT_PLAYLIST_WEDNESDAY=
YT_PLAYLIST_FRIDAY=
YT_PLAYLIST_CHOIR=
YT_PLAYLIST_SPECIAL_SONG=
YT_PLAYLIST_SPECIAL_EVENT=
```

- [ ] **Step 3: 실제 키를 `.env.local`에도 추가** (사용자가 발급한 값 입력 — git 추적 안 됨)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: 설교 동기화/요약용 의존성·env 키 추가"
```

---

## Task 1: DB 스키마 확장 + 마이그레이션

**Files:**
- Modify: `src/lib/db/schema.ts:36-52` (sermons 정의)
- Test: `src/lib/db/schema.test.ts` (생성)

**Interfaces:**
- Produces: `sermons` 테이블에 컬럼 추가 — `youtubeVideoId`(text unique), `durationSeconds`(int), `quickSummary`(jsonb `string[]`), `chapters`(jsonb `SermonChapter[]`), `summaryStatus`(text), `summaryAttempts`(int), `summaryNextRetryAt`(timestamptz), `summaryGeneratedAt`(timestamptz), `summaryModel`(text). `preacher` → nullable.

- [ ] **Step 1: 실패 테스트 작성** — `src/lib/db/schema.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { sermons } from './schema'

describe('sermons schema', () => {
  it('has the youtube/summary columns', () => {
    const cols = Object.keys(getTableColumns(sermons))
    for (const c of [
      'youtubeVideoId', 'durationSeconds', 'quickSummary', 'chapters',
      'summaryStatus', 'summaryAttempts', 'summaryNextRetryAt', 'summaryGeneratedAt', 'summaryModel',
    ]) {
      expect(cols).toContain(c)
    }
  })

  it('makes preacher nullable', () => {
    expect(getTableColumns(sermons).preacher.notNull).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/db/schema.test.ts`
Expected: FAIL (`youtubeVideoId` 등 컬럼 없음, preacher.notNull === true)

- [ ] **Step 3: 스키마 수정** — `src/lib/db/schema.ts`

`SermonChapter` 타입 import 추가 (파일 상단 import 블록):

```ts
import type { BulletinSection, SermonChapter } from '../types'
```

sermons 정의를 아래로 교체 (기존 `preacher`의 `.notNull()` 제거, 컬럼 추가):

```ts
export const sermons = pgTable('sermons', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  preacher: text('preacher'),
  scripture: text('scripture'),
  seriesId: uuid('series_id').references(() => sermonSeries.id, { onDelete: 'set null' }),
  worshipType: text('worship_type').notNull().default('주일예배'),
  sermonDate: date('sermon_date').notNull(),
  videoUrl: text('video_url'),
  audioUrl: text('audio_url'),
  notesUrl: text('notes_url'),
  thumbnailUrl: text('thumbnail_url'),
  summary: text('summary'),
  youtubeVideoId: text('youtube_video_id').unique(),
  durationSeconds: integer('duration_seconds'),
  quickSummary: jsonb('quick_summary').$type<string[]>(),
  chapters: jsonb('chapters').$type<SermonChapter[]>(),
  summaryStatus: text('summary_status').notNull().default('none'),
  summaryAttempts: integer('summary_attempts').notNull().default(0),
  summaryNextRetryAt: timestamp('summary_next_retry_at', { withTimezone: true }),
  summaryGeneratedAt: timestamp('summary_generated_at', { withTimezone: true }),
  summaryModel: text('summary_model'),
  isPublished: boolean('is_published').notNull().default(false),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [index('sermons_published_date_idx').on(t.isPublished, t.sermonDate)])
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/db/schema.test.ts`
Expected: PASS

- [ ] **Step 5: 마이그레이션 생성 + 적용**

```bash
npm run db:generate
npm run db:migrate
```
Expected: `drizzle/0002_*.sql` 생성, sermons에 컬럼 추가 + preacher NOT NULL 제거. migrate 성공 출력.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/schema.test.ts drizzle/
git commit -m "feat: sermons 테이블에 youtube/요약 컬럼 추가, preacher nullable"
```

---

## Task 2: 타입 + worship 7종 확장

**Files:**
- Modify: `src/lib/types.ts:1-15`
- Modify: `src/lib/worship.ts:3-12`
- Test: `src/lib/worship.test.ts` (기존에 추가)

**Interfaces:**
- Produces: `WorshipType`(7종), `SermonChapter { startSeconds:number; title:string; summary:string }`, `Sermon`에 `preacher?`, `youtubeVideoId?`, `durationSeconds?`, `quickSummary?: string[]`, `chapters?: SermonChapter[]`, `summaryStatus`. `worshipTypes`(7), `worshipLabels`(7).

- [ ] **Step 1: 실패 테스트 추가** — `src/lib/worship.test.ts` 하단에

```ts
import { worshipLabels, worshipTypes } from './worship'

describe('worship types (7종)', () => {
  it('includes all seven categories', () => {
    expect(worshipTypes).toHaveLength(7)
    for (const t of ['주일예배', '주일찬양예배', '수요예배', '금요기도회', '시온찬양대', '특송', '특별행사']) {
      expect(worshipTypes).toContain(t)
      expect(worshipLabels[t as (typeof worshipTypes)[number]]).toBe(t)
    }
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/worship.test.ts`
Expected: FAIL (length 4)

- [ ] **Step 3: types.ts 수정** — `WorshipType`, `SermonChapter`, `Sermon`

```ts
export type WorshipType =
  | '주일예배' | '주일찬양예배' | '수요예배' | '금요기도회'
  | '시온찬양대' | '특송' | '특별행사'

export interface SermonChapter {
  startSeconds: number
  title: string
  summary: string
}

export interface Sermon {
  id: string
  title: string
  preacher?: string
  scripture?: string
  worshipType: WorshipType
  sermonDate: string
  videoUrl: string
  youtubeId: string
  youtubeVideoId?: string
  durationSeconds?: number
  thumbnailUrl?: string
  summary?: string
  quickSummary?: string[]
  chapters?: SermonChapter[]
  summaryStatus: 'none' | 'pending' | 'ready' | 'failed'
  isPublished: boolean
}
```

- [ ] **Step 4: worship.ts 수정** — `worshipTypes`, `worshipLabels`

```ts
export const worshipTypes = [
  '주일예배', '주일찬양예배', '수요예배', '금요기도회', '시온찬양대', '특송', '특별행사',
] as const satisfies readonly WorshipType[]

export const worshipLabels: Record<WorshipType, string> = {
  주일예배: '주일예배',
  주일찬양예배: '주일찬양예배',
  수요예배: '수요예배',
  금요기도회: '금요기도회',
  시온찬양대: '시온찬양대',
  특송: '특송',
  특별행사: '특별행사',
}
```

- [ ] **Step 5: 테스트 통과 + 타입체크**

Run: `npx vitest run src/lib/worship.test.ts && npx tsc --noEmit`
Expected: PASS. (tsc에서 `Sermon.summaryStatus` 누락 등 깨지는 곳 있으면 Task 11에서 데이터 매핑으로 해결 — 지금은 타입만 추가했으니 `src/lib/data/sermons.ts`의 `toSermon`이 `summaryStatus`를 안 줘서 에러날 수 있음. 그 경우 Step 6 전에 `toSermon` 반환에 `summaryStatus: row.isPublished ? 'ready' : 'none'` 임시값을 넣지 말고, Task 11에서 정식 처리하도록 이 Task에서는 `summaryStatus`를 `Sermon`에서 optional로 두지 않는다 — 대신 sermons.ts의 `sermonColumns`/`toSermon`을 Task 11에서 갱신한다. tsc 에러가 나면 Task 11을 먼저 끼워 진행할 것.)

> 주: 타입 추가만으로 `toSermon`이 깨지면, **Task 11(데이터 레이어)** 을 Task 2 직후에 수행해 컴파일을 회복한다. 두 Task는 함께 커밋해도 좋다.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/worship.ts src/lib/worship.test.ts
git commit -m "feat: WorshipType 7종 확장 + SermonChapter/Sermon 타입"
```

---

## Task 3: 타임스탬프 포맷 유틸

**Files:**
- Create: `src/lib/sermons/format.ts`
- Test: `src/lib/sermons/format.test.ts`

**Interfaces:**
- Produces: `formatTimestamp(totalSeconds: number): string` — 1시간 미만 `M:SS`, 이상 `H:MM:SS`. 음수/NaN → `0:00`.

- [ ] **Step 1: 실패 테스트** — `src/lib/sermons/format.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { formatTimestamp } from './format'

describe('formatTimestamp', () => {
  it('formats under an hour as M:SS', () => {
    expect(formatTimestamp(0)).toBe('0:00')
    expect(formatTimestamp(65)).toBe('1:05')
    expect(formatTimestamp(599)).toBe('9:59')
  })
  it('formats an hour or more as H:MM:SS', () => {
    expect(formatTimestamp(3600)).toBe('1:00:00')
    expect(formatTimestamp(3725)).toBe('1:02:05')
  })
  it('guards against bad input', () => {
    expect(formatTimestamp(-5)).toBe('0:00')
    expect(formatTimestamp(Number.NaN)).toBe('0:00')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/sermons/format.test.ts` → FAIL

- [ ] **Step 3: 구현** — `src/lib/sermons/format.ts`

```ts
export function formatTimestamp(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const total = Math.floor(totalSeconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/sermons/format.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sermons/format.ts src/lib/sermons/format.test.ts
git commit -m "feat: 타임스탬프 포맷 유틸"
```

---

## Task 4: YouTube Data API 클라이언트

**Files:**
- Create: `src/lib/youtube/client.ts`
- Test: `src/lib/youtube/client.test.ts`

**Interfaces:**
- Produces:
  - `parseIso8601Duration(iso: string): number` — `PT1H2M3S` → 초. 파싱 실패 → 0.
  - `interface YouTubeVideo { videoId: string; title: string; publishedAt: string; thumbnailUrl: string | null; durationSeconds: number }`
  - `listPlaylistVideos(playlistId: string, apiKey: string): Promise<YouTubeVideo[]>` — `nextPageToken` 전수 순회, `videos.list(contentDetails)`로 duration 보강, videos.list에서 빠진 ID(삭제/비공개) 제외.
- Consumes: 전역 `fetch`.

- [ ] **Step 1: 실패 테스트** — `src/lib/youtube/client.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listPlaylistVideos, parseIso8601Duration } from './client'

afterEach(() => vi.restoreAllMocks())

describe('parseIso8601Duration', () => {
  it('parses H/M/S', () => {
    expect(parseIso8601Duration('PT3S')).toBe(3)
    expect(parseIso8601Duration('PT2M3S')).toBe(123)
    expect(parseIso8601Duration('PT1H2M3S')).toBe(3723)
    expect(parseIso8601Duration('PT1H')).toBe(3600)
  })
  it('returns 0 on garbage', () => {
    expect(parseIso8601Duration('nope')).toBe(0)
  })
})

describe('listPlaylistVideos', () => {
  it('paginates and enriches with duration, dropping inaccessible videos', async () => {
    const fetchMock = vi.fn()
      // playlistItems page 1
      .mockResolvedValueOnce(jsonResponse({
        nextPageToken: 'p2',
        items: [
          { contentDetails: { videoId: 'a' }, snippet: { title: 'A', publishedAt: '2026-01-01T00:00:00Z', thumbnails: { high: { url: 'ta' } } } },
        ],
      }))
      // playlistItems page 2
      .mockResolvedValueOnce(jsonResponse({
        items: [
          { contentDetails: { videoId: 'b' }, snippet: { title: 'B', publishedAt: '2026-01-08T00:00:00Z', thumbnails: {} } },
        ],
      }))
      // videos.list (b is missing => inaccessible)
      .mockResolvedValueOnce(jsonResponse({
        items: [{ id: 'a', contentDetails: { duration: 'PT1H' } }],
      }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await listPlaylistVideos('PL1', 'KEY')
    expect(out).toEqual([
      { videoId: 'a', title: 'A', publishedAt: '2026-01-01T00:00:00Z', thumbnailUrl: 'ta', durationSeconds: 3600 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/youtube/client.test.ts` → FAIL

- [ ] **Step 3: 구현** — `src/lib/youtube/client.ts`

```ts
const API = 'https://www.googleapis.com/youtube/v3'
const MAX_PAGES = 20

export interface YouTubeVideo {
  videoId: string
  title: string
  publishedAt: string
  thumbnailUrl: string | null
  durationSeconds: number
}

export function parseIso8601Duration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) return 0
  const [, h, min, s] = m
  return (Number(h ?? 0) * 3600) + (Number(min ?? 0) * 60) + Number(s ?? 0)
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`youtube api ${res.status}`)
  return res.json()
}

export async function listPlaylistVideos(playlistId: string, apiKey: string): Promise<YouTubeVideo[]> {
  const items: { videoId: string; title: string; publishedAt: string; thumbnailUrl: string | null }[] = []
  let pageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${API}/playlistItems`)
    url.searchParams.set('part', 'snippet,contentDetails')
    url.searchParams.set('maxResults', '50')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('key', apiKey)
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const data = await getJson(url.toString())
    for (const it of data.items ?? []) {
      const videoId = it.contentDetails?.videoId
      if (!videoId) continue
      const thumbs = it.snippet?.thumbnails ?? {}
      const thumb = thumbs.maxres ?? thumbs.high ?? thumbs.medium ?? thumbs.default
      items.push({
        videoId,
        title: it.snippet?.title ?? '',
        publishedAt: it.snippet?.publishedAt ?? '',
        thumbnailUrl: thumb?.url ?? null,
      })
    }
    pageToken = data.nextPageToken
    if (!pageToken) break
  }

  const durations = await fetchDurations(items.map((i) => i.videoId), apiKey)
  // videos.list에서 빠진 ID = 삭제/비공개 → 제외
  return items
    .filter((i) => durations.has(i.videoId))
    .map((i) => ({ ...i, durationSeconds: durations.get(i.videoId)! }))
}

async function fetchDurations(ids: string[], apiKey: string): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const url = new URL(`${API}/videos`)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('key', apiKey)
    const data = await getJson(url.toString())
    for (const it of data.items ?? []) {
      result.set(it.id, parseIso8601Duration(it.contentDetails?.duration ?? ''))
    }
  }
  return result
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/youtube/client.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube/client.ts src/lib/youtube/client.test.ts
git commit -m "feat: YouTube Data API 클라이언트(재생목록 전수 순회 + duration)"
```

---

## Task 5: 재생목록 설정 맵

**Files:**
- Create: `src/lib/sermons/playlists.ts`
- Test: `src/lib/sermons/playlists.test.ts`

**Interfaces:**
- Produces:
  - `interface ResolvedPlaylist { playlistId: string; worshipType: WorshipType; autoSummary: boolean; priority: number }`
  - `resolvePlaylists(env: Record<string, string | undefined>): ResolvedPlaylist[]` — env에 ID가 있는 것만, `priority` 오름차순 정렬.

- [ ] **Step 1: 실패 테스트** — `src/lib/sermons/playlists.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { resolvePlaylists } from './playlists'

describe('resolvePlaylists', () => {
  it('keeps only configured ids, sorted by priority (worship first)', () => {
    const out = resolvePlaylists({
      YT_PLAYLIST_SPECIAL_EVENT: 'PLevent',
      YT_PLAYLIST_SUNDAY: 'PLsun',
      YT_PLAYLIST_CHOIR: '',          // 빈 값은 제외
    })
    expect(out.map((p) => p.playlistId)).toEqual(['PLsun', 'PLevent'])
    expect(out[0]).toMatchObject({ worshipType: '주일예배', autoSummary: true })
    expect(out[1]).toMatchObject({ worshipType: '특별행사', autoSummary: false })
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/sermons/playlists.test.ts` → FAIL

- [ ] **Step 3: 구현** — `src/lib/sermons/playlists.ts`

```ts
import type { WorshipType } from '@/lib/types'

export interface ResolvedPlaylist {
  playlistId: string
  worshipType: WorshipType
  autoSummary: boolean
  priority: number
}

interface PlaylistDef {
  envKey: string
  worshipType: WorshipType
  autoSummary: boolean
  priority: number // 낮을수록 우선 (worshipType 선점)
}

const DEFS: PlaylistDef[] = [
  { envKey: 'YT_PLAYLIST_SUNDAY', worshipType: '주일예배', autoSummary: true, priority: 1 },
  { envKey: 'YT_PLAYLIST_WEDNESDAY', worshipType: '수요예배', autoSummary: true, priority: 2 },
  { envKey: 'YT_PLAYLIST_FRIDAY', worshipType: '금요기도회', autoSummary: true, priority: 3 },
  { envKey: 'YT_PLAYLIST_SUNDAY_PRAISE', worshipType: '주일찬양예배', autoSummary: true, priority: 4 },
  { envKey: 'YT_PLAYLIST_SPECIAL_EVENT', worshipType: '특별행사', autoSummary: false, priority: 5 },
  { envKey: 'YT_PLAYLIST_CHOIR', worshipType: '시온찬양대', autoSummary: false, priority: 6 },
  { envKey: 'YT_PLAYLIST_SPECIAL_SONG', worshipType: '특송', autoSummary: false, priority: 7 },
]

export function resolvePlaylists(env: Record<string, string | undefined>): ResolvedPlaylist[] {
  return DEFS
    .map((d) => ({ ...d, playlistId: (env[d.envKey] ?? '').trim() }))
    .filter((d) => d.playlistId.length > 0)
    .sort((a, b) => a.priority - b.priority)
    .map(({ playlistId, worshipType, autoSummary, priority }) => ({ playlistId, worshipType, autoSummary, priority }))
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/sermons/playlists.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sermons/playlists.ts src/lib/sermons/playlists.test.ts
git commit -m "feat: 재생목록→worshipType 설정 맵(우선순위 선점)"
```

---

## Task 6: 동기화 (순수 계획 + I/O)

**Files:**
- Create: `src/lib/sermons/sync.ts`
- Test: `src/lib/sermons/sync.test.ts`

**Interfaces:**
- Consumes: `listPlaylistVideos`, `resolvePlaylists`, `db`, `sermons`.
- Produces:
  - `interface PlaylistVideo extends YouTubeVideo { worshipType: WorshipType }`
  - `interface NewSermonInsert { youtubeVideoId; title; preacher: null; worshipType; sermonDate; videoUrl; thumbnailUrl; durationSeconds }`
  - `planSermonInserts(existingIds: Set<string>, videos: PlaylistVideo[]): NewSermonInsert[]` — 순수. 우선순위순으로 들어온 videos에서, 이미 있거나 배치 내 중복인 videoId는 제외.
  - `syncSermons(): Promise<{ inserted: number }>` — I/O. env 읽고, 재생목록 순회, 기존 id 조회, plan, bulk insert.

- [ ] **Step 1: 실패 테스트(순수 함수 위주)** — `src/lib/sermons/sync.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { planSermonInserts, type PlaylistVideo } from './sync'

const v = (videoId: string, worshipType: PlaylistVideo['worshipType']): PlaylistVideo => ({
  videoId, worshipType, title: `t-${videoId}`, publishedAt: '2026-01-01T00:00:00Z',
  thumbnailUrl: null, durationSeconds: 100,
})

describe('planSermonInserts', () => {
  it('skips existing and in-batch duplicates, keeps first (highest priority) worshipType', () => {
    const existing = new Set(['old'])
    const out = planSermonInserts(existing, [
      v('new1', '주일예배'),
      v('old', '수요예배'),       // 이미 존재 → skip
      v('new1', '특별행사'),      // 배치 내 중복 → 첫 항목(주일예배) 유지
      v('new2', '금요기도회'),
    ])
    expect(out.map((r) => [r.youtubeVideoId, r.worshipType])).toEqual([
      ['new1', '주일예배'],
      ['new2', '금요기도회'],
    ])
  })

  it('maps fields into insert shape', () => {
    const [row] = planSermonInserts(new Set(), [v('x', '주일예배')])
    expect(row).toEqual({
      youtubeVideoId: 'x',
      title: 't-x',
      preacher: null,
      worshipType: '주일예배',
      sermonDate: '2026-01-01',
      videoUrl: 'https://youtu.be/x',
      thumbnailUrl: null,
      durationSeconds: 100,
    })
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/sermons/sync.test.ts` → FAIL

- [ ] **Step 3: 구현** — `src/lib/sermons/sync.ts`

```ts
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import type { WorshipType } from '@/lib/types'
import { listPlaylistVideos, type YouTubeVideo } from '@/lib/youtube/client'
import { resolvePlaylists } from './playlists'

export interface PlaylistVideo extends YouTubeVideo {
  worshipType: WorshipType
}

export interface NewSermonInsert {
  youtubeVideoId: string
  title: string
  preacher: null
  worshipType: WorshipType
  sermonDate: string
  videoUrl: string
  thumbnailUrl: string | null
  durationSeconds: number
}

export function planSermonInserts(existingIds: Set<string>, videos: PlaylistVideo[]): NewSermonInsert[] {
  const seen = new Set(existingIds)
  const out: NewSermonInsert[] = []
  for (const v of videos) {
    if (seen.has(v.videoId)) continue
    seen.add(v.videoId)
    out.push({
      youtubeVideoId: v.videoId,
      title: v.title,
      preacher: null,
      worshipType: v.worshipType,
      sermonDate: (v.publishedAt || '').slice(0, 10),
      videoUrl: `https://youtu.be/${v.videoId}`,
      thumbnailUrl: v.thumbnailUrl,
      durationSeconds: v.durationSeconds,
    })
  }
  return out
}

export async function syncSermons(): Promise<{ inserted: number }> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')

  const playlists = resolvePlaylists(process.env as Record<string, string | undefined>)
  const collected: PlaylistVideo[] = []
  for (const p of playlists) {
    try {
      const videos = await listPlaylistVideos(p.playlistId, apiKey)
      for (const v of videos) collected.push({ ...v, worshipType: p.worshipType })
    } catch (e) {
      console.error(`[sync] playlist ${p.playlistId} failed`, e)
    }
  }

  const existing = await db.select({ id: sermons.youtubeVideoId }).from(sermons)
  const existingIds = new Set(existing.map((r) => r.id).filter((x): x is string => !!x))
  const rows = planSermonInserts(existingIds, collected)
  if (rows.length === 0) return { inserted: 0 }

  await db.insert(sermons).values(rows.map((r) => ({ ...r, isPublished: false, summaryStatus: 'none' as const })))
  return { inserted: rows.length }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/sermons/sync.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sermons/sync.ts src/lib/sermons/sync.test.ts
git commit -m "feat: 설교 동기화(planSermonInserts 순수 로직 + syncSermons)"
```

---

## Task 7: Gemini 요약 + Zod 검증

**Files:**
- Create: `src/lib/ai/sermon-summary.ts`
- Test: `src/lib/ai/sermon-summary.test.ts`

**Interfaces:**
- Produces:
  - `interface SermonSummaryResult { summary: string; quickSummary: string[]; chapters: SermonChapter[] }`
  - `parseSermonSummary(raw: unknown, durationSeconds: number | null): SermonSummaryResult` — 순수. Zod 파싱 + chapters 오름차순/duration 이하/중복·빈 거부 + quickSummary 개수 상한(20). 위반 시 throw.
  - `generateSermonSummary(videoUrl: string, durationSeconds: number | null): Promise<SermonSummaryResult>` — Gemini 호출 후 `parseSermonSummary`.
- Consumes: `@google/genai`, env `GEMINI_API_KEY`, `GEMINI_MODEL`.

- [ ] **Step 1: 실패 테스트(파싱 위주)** — `src/lib/ai/sermon-summary.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { parseSermonSummary } from './sermon-summary'

const valid = {
  summary: '한 줄 소개',
  quickSummary: ['요점1', '요점2'],
  chapters: [
    { startSeconds: 0, title: '도입', summary: '인사' },
    { startSeconds: 120, title: '본문', summary: '말씀' },
  ],
}

describe('parseSermonSummary', () => {
  it('accepts a well-formed payload', () => {
    expect(parseSermonSummary(valid, 600)).toEqual(valid)
  })
  it('rejects out-of-order chapters', () => {
    const bad = { ...valid, chapters: [valid.chapters[1], valid.chapters[0]] }
    expect(() => parseSermonSummary(bad, 600)).toThrow()
  })
  it('rejects chapter beyond duration', () => {
    expect(() => parseSermonSummary(valid, 100)).toThrow()
  })
  it('rejects empty title/summary', () => {
    const bad = { ...valid, chapters: [{ startSeconds: 0, title: '', summary: 'x' }] }
    expect(() => parseSermonSummary(bad, 600)).toThrow()
  })
  it('rejects wrong shape', () => {
    expect(() => parseSermonSummary({ summary: 1 }, 600)).toThrow()
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/ai/sermon-summary.test.ts` → FAIL

- [ ] **Step 3: 구현** — `src/lib/ai/sermon-summary.ts`

```ts
import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'
import type { SermonChapter } from '@/lib/types'

export interface SermonSummaryResult {
  summary: string
  quickSummary: string[]
  chapters: SermonChapter[]
}

const schema = z.object({
  summary: z.string().min(1).max(500),
  quickSummary: z.array(z.string().min(1)).min(1).max(20),
  chapters: z.array(z.object({
    startSeconds: z.number().int().nonnegative(),
    title: z.string().min(1),
    summary: z.string().min(1),
  })).min(1),
})

export function parseSermonSummary(raw: unknown, durationSeconds: number | null): SermonSummaryResult {
  const parsed = schema.parse(raw)
  let prev = -1
  for (const c of parsed.chapters) {
    if (c.startSeconds <= prev) throw new Error('chapters must be strictly ascending')
    if (durationSeconds != null && c.startSeconds > durationSeconds) throw new Error('chapter beyond duration')
    prev = c.startSeconds
  }
  return parsed
}

const PROMPT = `당신은 한국어 설교 영상을 요약하는 도우미입니다.
이 영상을 보고 아래를 한국어로 작성하세요.
1) summary: 한 줄 소개 (한 문장)
2) quickSummary: 핵심 요점 8~12개 (각 한 문장)
3) chapters: 영상 흐름을 시간 구간으로 나눠 각 구간의 시작 시각(초, startSeconds)·소제목(title)·요약(summary).
   startSeconds는 0부터 시작해 오름차순이어야 하며 영상 길이를 넘지 않습니다.`

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    quickSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSeconds: { type: Type.INTEGER },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['startSeconds', 'title', 'summary'],
      },
    },
  },
  required: ['summary', 'quickSummary', 'chapters'],
}

export async function generateSermonSummary(
  videoUrl: string,
  durationSeconds: number | null,
): Promise<SermonSummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'

  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { fileData: { fileUri: videoUrl } },
        { text: PROMPT },
      ],
    }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema,
    },
  })

  const text = res.text
  if (!text) throw new Error('gemini returned empty response')
  return parseSermonSummary(JSON.parse(text), durationSeconds)
}
```

> 주: `@google/genai`의 정확한 호출 시그니처(`ai.models.generateContent`, `res.text`, `Type` enum, `fileData.fileUri`)는 설치된 버전의 `node_modules/@google/genai` 타입을 확인해 맞출 것. 시그니처가 다르면 `generateSermonSummary` 내부만 조정하고 `parseSermonSummary`(테스트 대상)는 그대로 둔다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/ai/sermon-summary.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/sermon-summary.ts src/lib/ai/sermon-summary.test.ts
git commit -m "feat: Gemini 설교 요약 생성 + Zod 검증"
```

---

## Task 8: 요약 워커 (재시도 정책 + claim/process)

**Files:**
- Create: `src/lib/sermons/summarize.ts`
- Test: `src/lib/sermons/summarize.test.ts`

**Interfaces:**
- Consumes: `db`, `sermons`, `generateSermonSummary`, drizzle `sql`/`eq`.
- Produces:
  - `MAX_SUMMARY_ATTEMPTS = 3`, `STALE_PENDING_MS = 600000`
  - `computeNextRetry(attempts: number, now: Date): Date` — 지수 백오프(예: 5분·15분·45분).
  - `claimNextSermon(now?: Date): Promise<{ id: string; videoUrl: string; durationSeconds: number | null } | null>` — 단일 원자적 UPDATE로 1건 `pending` 선점.
  - `processClaimedSermon(row): Promise<'ready' | 'failed'>` — 요약 생성/저장.
  - `runSummaryWorker(limit: number): Promise<{ processed: number }>` — claim→process 반복.
  - `generateSummaryForSermon(id: string): Promise<'ready' | 'failed'>` — admin 수동 단건(상태 무시하고 강제).

- [ ] **Step 1: 실패 테스트(정책 순수 함수)** — `src/lib/sermons/summarize.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { computeNextRetry } from './summarize'

describe('computeNextRetry', () => {
  const now = new Date('2026-01-01T00:00:00Z')
  it('backs off exponentially by attempt', () => {
    expect(computeNextRetry(1, now).toISOString()).toBe('2026-01-01T00:05:00.000Z')
    expect(computeNextRetry(2, now).toISOString()).toBe('2026-01-01T00:15:00.000Z')
    expect(computeNextRetry(3, now).toISOString()).toBe('2026-01-01T00:45:00.000Z')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/sermons/summarize.test.ts` → FAIL

- [ ] **Step 3: 구현** — `src/lib/sermons/summarize.ts`

```ts
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { generateSermonSummary } from '@/lib/ai/sermon-summary'

export const MAX_SUMMARY_ATTEMPTS = 3
export const STALE_PENDING_MS = 10 * 60 * 1000

export function computeNextRetry(attempts: number, now: Date): Date {
  const minutes = 5 * Math.pow(3, Math.max(0, attempts - 1)) // 5, 15, 45...
  return new Date(now.getTime() + minutes * 60 * 1000)
}

interface ClaimedSermon {
  id: string
  videoUrl: string
  durationSeconds: number | null
}

// 단일 원자적 UPDATE로 1건 선점 (neon-http: 트랜잭션 없이 race-free)
export async function claimNextSermon(now: Date = new Date()): Promise<ClaimedSermon | null> {
  const staleBefore = new Date(now.getTime() - STALE_PENDING_MS)
  const rows = await db.execute(sql`
    UPDATE sermons SET
      summary_status = 'pending',
      summary_attempts = summary_attempts + 1
    WHERE id = (
      SELECT id FROM sermons
      WHERE video_url IS NOT NULL
        AND summary_attempts < ${MAX_SUMMARY_ATTEMPTS}
        AND (
          (summary_status IN ('none', 'failed')
            AND (summary_next_retry_at IS NULL OR summary_next_retry_at <= ${now.toISOString()}))
          OR (summary_status = 'pending' AND summary_generated_at IS NULL
            AND summary_next_retry_at IS NULL AND created_at <= ${staleBefore.toISOString()})
        )
      ORDER BY sermon_date DESC
      LIMIT 1
    )
    RETURNING id, video_url AS "videoUrl", duration_seconds AS "durationSeconds"
  `)
  const row = (rows.rows ?? rows)[0] as ClaimedSermon | undefined
  return row ?? null
}

export async function processClaimedSermon(row: ClaimedSermon): Promise<'ready' | 'failed'> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'
  try {
    const result = await generateSermonSummary(row.videoUrl, row.durationSeconds)
    await db.update(sermons).set({
      summary: result.summary,
      quickSummary: result.quickSummary,
      chapters: result.chapters,
      summaryStatus: 'ready',
      summaryGeneratedAt: new Date(),
      summaryNextRetryAt: null,
      summaryModel: model,
    }).where(eq(sermons.id, row.id))
    return 'ready'
  } catch (e) {
    console.error(`[summarize] ${row.id} failed`, e)
    await db.update(sermons).set({
      summaryStatus: 'failed',
      summaryNextRetryAt: computeNextRetry(MAX_SUMMARY_ATTEMPTS, new Date()),
    }).where(eq(sermons.id, row.id))
    return 'failed'
  }
}

export async function runSummaryWorker(limit: number): Promise<{ processed: number }> {
  let processed = 0
  for (let i = 0; i < limit; i++) {
    const claimed = await claimNextSermon()
    if (!claimed) break
    await processClaimedSermon(claimed)
    processed++
  }
  return { processed }
}

// admin 수동: 상태/시도횟수 무시하고 강제 재생성
export async function generateSummaryForSermon(id: string): Promise<'ready' | 'failed'> {
  const [row] = await db
    .select({ id: sermons.id, videoUrl: sermons.videoUrl, durationSeconds: sermons.durationSeconds })
    .from(sermons).where(eq(sermons.id, id)).limit(1)
  if (!row || !row.videoUrl) throw new Error('sermon not found or has no video')
  await db.update(sermons).set({ summaryStatus: 'pending' }).where(eq(sermons.id, id))
  return processClaimedSermon({ id: row.id, videoUrl: row.videoUrl, durationSeconds: row.durationSeconds })
}
```

> 주: `processClaimedSermon`의 실패 분기에서 `summary_attempts`는 claim 시 이미 +1 되어 있으므로 여기서 추가로 올리지 않는다. `claimNextSermon`의 `db.execute` 반환 형태(`.rows`)는 neon-http 버전에 따라 다를 수 있으니 실제 반환을 로그로 확인 후 인덱싱을 맞춘다.

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/sermons/summarize.test.ts` → PASS

- [ ] **Step 5: 수동 통합 검증(실 DB)** — sermons에 video_url 있는 draft 1건 두고:

```bash
npx tsx -e "import('dotenv').then(d=>d.config({path:'.env.local'})).then(()=>import('./src/lib/sermons/summarize.ts')).then(async m=>{console.log(await m.runSummaryWorker(1))})"
```
Expected: `{ processed: 1 }`, 해당 행 `summary_status='ready'` + chapters 채워짐. (Gemini 키 필요)

- [ ] **Step 6: Commit**

```bash
git add src/lib/sermons/summarize.ts src/lib/sermons/summarize.test.ts
git commit -m "feat: 요약 워커 claim 큐 + 지수 백오프 재시도"
```

---

## Task 9: admin 서버 액션

**Files:**
- Create: `src/lib/actions/sermons.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `db`, `sermons`, `log`, `revalidatePath`, `syncSermons`, `generateSummaryForSermon`, `isWorshipType`.
- Produces (모두 `'use server'`):
  - `getSermonsForAdmin()` / `getSermonForAdmin(id)`
  - `syncNowAction(): Promise<{ inserted: number }>`
  - `generateSummaryAction(id: string): Promise<'ready' | 'failed'>`
  - `updateSermonAction(id, input: SermonEditInput)`
  - `togglePublishAction(id: string, publish: boolean)` — publish=true면 preacher 필수 검증.
  - `interface SermonEditInput { title; preacher; scripture; worshipType; sermonDate }`

- [ ] **Step 1: 구현** — `src/lib/actions/sermons.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { isWorshipType } from '@/lib/worship'
import { syncSermons } from '@/lib/sermons/sync'
import { generateSummaryForSermon } from '@/lib/sermons/summarize'

export interface SermonEditInput {
  title: string
  preacher: string
  scripture: string
  worshipType: string
  sermonDate: string
}

function revalidateSermonPaths(id?: string) {
  revalidatePath('/')
  revalidatePath('/sermons')
  revalidatePath('/admin/sermons')
  if (id) {
    revalidatePath(`/sermons/${id}`)
    revalidatePath(`/admin/sermons/${id}/edit`)
  }
}

export async function getSermonsForAdmin() {
  await requireAdmin()
  return db.select().from(sermons).orderBy(desc(sermons.sermonDate))
}

export async function getSermonForAdmin(id: string) {
  await requireAdmin()
  const [row] = await db.select().from(sermons).where(eq(sermons.id, id)).limit(1)
  return row
}

export async function syncNowAction() {
  await requireAdmin()
  const result = await syncSermons()
  revalidateSermonPaths()
  return result
}

export async function generateSummaryAction(id: string) {
  await requireAdmin()
  const status = await generateSummaryForSermon(id)
  revalidateSermonPaths(id)
  return status
}

export async function updateSermonAction(id: string, input: SermonEditInput) {
  const s = await requireAdmin()
  if (!input.title.trim()) throw new Error('title is required')
  if (!isWorshipType(input.worshipType)) throw new Error('invalid worshipType')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.sermonDate)) throw new Error('invalid sermonDate')
  const [updated] = await db.update(sermons).set({
    title: input.title.trim(),
    preacher: input.preacher.trim() || null,
    scripture: input.scripture.trim() || null,
    worshipType: input.worshipType,
    sermonDate: input.sermonDate,
  }).where(eq(sermons.id, id)).returning({ id: sermons.id, title: sermons.title })
  if (!updated) throw new Error('sermon not found')
  await log('update', 'sermon', updated.id, updated.title, s.user.id)
  revalidateSermonPaths(id)
}

export async function togglePublishAction(id: string, publish: boolean) {
  const s = await requireAdmin()
  if (publish) {
    const [row] = await db.select({ preacher: sermons.preacher }).from(sermons).where(eq(sermons.id, id)).limit(1)
    if (!row) throw new Error('sermon not found')
    if (!row.preacher || !row.preacher.trim()) throw new Error('공개 전 설교자(preacher)를 입력하세요')
  }
  const [updated] = await db.update(sermons).set({ isPublished: publish })
    .where(eq(sermons.id, id)).returning({ id: sermons.id, title: sermons.title })
  if (!updated) throw new Error('sermon not found')
  await log('update', 'sermon', updated.id, `publish=${publish}`, s.user.id)
  revalidateSermonPaths(id)
}
```

- [ ] **Step 2: 타입체크** — Run: `npx tsc --noEmit` → 통과

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/sermons.ts
git commit -m "feat: 설교 admin 서버 액션(동기화/요약/편집/공개)"
```

---

## Task 10: cron 라우트

**Files:**
- Create: `src/app/api/cron/sync-sermons/route.ts`
- Create: `src/app/api/cron/summarize-sermons/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `syncSermons`, `runSummaryWorker`, env `CRON_SECRET`.

> 사전 확인: `node_modules/next/dist/docs/`에서 App Router Route Handler 시그니처(`GET(req: Request)`)와 `export const maxDuration` 지원을 확인할 것.

- [ ] **Step 1: 공통 인증 헬퍼 포함 sync 라우트** — `src/app/api/cron/sync-sermons/route.ts`

```ts
import { syncSermons } from '@/lib/sermons/sync'

export const maxDuration = 60

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 })
  try {
    const result = await syncSermons()
    return Response.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron sync]', e)
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
```

- [ ] **Step 2: summarize 워커 라우트** — `src/app/api/cron/summarize-sermons/route.ts`

```ts
import { runSummaryWorker } from '@/lib/sermons/summarize'

export const maxDuration = 300

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 })
  try {
    const result = await runSummaryWorker(3)
    return Response.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron summarize]', e)
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
```

- [ ] **Step 3: `vercel.json` cron 스케줄**

```json
{
  "crons": [
    { "path": "/api/cron/sync-sermons", "schedule": "0 3 * * 1" },
    { "path": "/api/cron/summarize-sermons", "schedule": "0 * * * *" }
  ]
}
```

> 주: Vercel cron은 호출 시 `Authorization: Bearer $CRON_SECRET`를 자동 첨부한다(프로젝트 env에 `CRON_SECRET` 설정 필요). Hobby 플랜은 cron 빈도/`maxDuration` 제약이 있으니 배포 플랜에 맞게 조정.

- [ ] **Step 4: 빌드 확인** — Run: `npm run build` → 라우트가 빌드되고 타입 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron vercel.json
git commit -m "feat: 동기화/요약 cron 라우트 + 스케줄"
```

---

## Task 11: 데이터 레이어 읽기 갱신

**Files:**
- Modify: `src/lib/data/sermons.ts`
- Test: `src/lib/data/sermons.test.ts` (생성)

**Interfaces:**
- Produces: `toSermon`이 `quickSummary`, `chapters`, `durationSeconds`, `youtubeVideoId`, `summaryStatus`를 매핑. `sermonColumns`에 신규 컬럼 포함.

- [ ] **Step 1: 실패 테스트** — `src/lib/data/sermons.test.ts`

`toSermon`을 테스트하려면 export 필요. 먼저 `sermons.ts`에서 `toSermon`을 `export`로 바꾼 뒤:

```ts
import { describe, expect, it } from 'vitest'
import { toSermon, type SermonListRow } from './sermons'

const base: SermonListRow = {
  id: 'id1', title: 't', preacher: '김목사', scripture: '요 3:16',
  worshipType: '주일예배', sermonDate: '2026-01-01',
  videoUrl: 'https://youtu.be/abc', thumbnailUrl: null, summary: 's',
  isPublished: true, youtubeVideoId: 'abc', durationSeconds: 3600,
  quickSummary: ['p1', 'p2'], chapters: [{ startSeconds: 0, title: 'c', summary: 'cs' }],
  summaryStatus: 'ready',
}

describe('toSermon', () => {
  it('maps summary fields and derives youtubeId', () => {
    const s = toSermon(base)
    expect(s.youtubeId).toBe('abc')
    expect(s.quickSummary).toEqual(['p1', 'p2'])
    expect(s.chapters?.[0].title).toBe('c')
    expect(s.summaryStatus).toBe('ready')
  })
  it('falls back to youtube thumbnail when none stored', () => {
    expect(toSermon({ ...base, thumbnailUrl: null }).thumbnailUrl)
      .toBe('https://img.youtube.com/vi/abc/hqdefault.jpg')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/data/sermons.test.ts` → FAIL

- [ ] **Step 3: `sermons.ts` 수정** — `SermonListRow`/`sermonColumns`/`toSermon`

`SermonListRow` 타입과 `sermonColumns`에 신규 컬럼 추가:

```ts
export type SermonListRow = Pick<
  SermonRow,
  'id' | 'title' | 'preacher' | 'scripture' | 'worshipType' | 'sermonDate' | 'videoUrl'
  | 'thumbnailUrl' | 'summary' | 'isPublished'
  | 'youtubeVideoId' | 'durationSeconds' | 'quickSummary' | 'chapters' | 'summaryStatus'
>

const sermonColumns = {
  id: sermonsTable.id,
  title: sermonsTable.title,
  preacher: sermonsTable.preacher,
  scripture: sermonsTable.scripture,
  worshipType: sermonsTable.worshipType,
  sermonDate: sermonsTable.sermonDate,
  videoUrl: sermonsTable.videoUrl,
  thumbnailUrl: sermonsTable.thumbnailUrl,
  summary: sermonsTable.summary,
  isPublished: sermonsTable.isPublished,
  youtubeVideoId: sermonsTable.youtubeVideoId,
  durationSeconds: sermonsTable.durationSeconds,
  quickSummary: sermonsTable.quickSummary,
  chapters: sermonsTable.chapters,
  summaryStatus: sermonsTable.summaryStatus,
}
```

`toSermon`을 export하고 신규 필드 매핑 추가:

```ts
export function toSermon(row: SermonListRow): Sermon {
  const youtubeId = youtubeIdFromUrl(row.videoUrl)
  return {
    id: row.id,
    title: row.title,
    preacher: row.preacher ?? undefined,
    scripture: row.scripture ?? undefined,
    worshipType: row.worshipType as WorshipType,
    sermonDate: row.sermonDate,
    videoUrl: row.videoUrl ?? '',
    youtubeId,
    youtubeVideoId: row.youtubeVideoId ?? undefined,
    durationSeconds: row.durationSeconds ?? undefined,
    thumbnailUrl:
      row.thumbnailUrl ?? (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : undefined),
    summary: row.summary ?? undefined,
    quickSummary: row.quickSummary ?? undefined,
    chapters: row.chapters ?? undefined,
    summaryStatus: (row.summaryStatus ?? 'none') as Sermon['summaryStatus'],
    isPublished: row.isPublished,
  }
}
```

- [ ] **Step 4: 통과 + 타입체크** — Run: `npx vitest run src/lib/data/sermons.test.ts && npx tsc --noEmit` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/sermons.ts src/lib/data/sermons.test.ts
git commit -m "feat: 데이터 레이어에 요약/youtube 필드 매핑"
```

---

## Task 12: YouTube IFrame Player 컴포넌트

**Files:**
- Create: `src/components/sermons/YouTubePlayer.tsx`

**Interfaces:**
- Produces: `<YouTubePlayer youtubeId title seekToRef />` — `seekToRef`는 `MutableRefObject<((s:number)=>void) | null>`로, 부모가 타임스탬프 클릭 시 호출.

> 사전 확인: Next 16 client component 규칙(`'use client'`)과 외부 스크립트 로딩 방식(`next/script` 또는 직접). IFrame Player API: https 스크립트 `https://www.youtube.com/iframe_api`, `new YT.Player(el, { events })`, `player.seekTo(sec, true)`.

- [ ] **Step 1: 구현** — `src/components/sermons/YouTubePlayer.tsx`

```tsx
'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'

interface Props {
  youtubeId: string
  title: string
  seekToRef?: MutableRefObject<((seconds: number) => void) | null>
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => { seekTo: (s: number, allow: boolean) => void; playVideo: () => void } }
    onYouTubeIframeAPIReady?: () => void
  }
}

function loadApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve()
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script')
      s.id = 'yt-iframe-api'
      s.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(s)
    }
  })
}

export default function YouTubePlayer({ youtubeId, title, seekToRef }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let player: { seekTo: (s: number, b: boolean) => void; playVideo: () => void } | null = null
    let cancelled = false
    loadApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return
      player = new window.YT.Player(hostRef.current, {
        videoId: youtubeId,
        playerVars: { rel: 0 },
      })
      if (seekToRef) {
        seekToRef.current = (seconds: number) => { player?.seekTo(seconds, true); player?.playVideo() }
      }
    })
    return () => {
      cancelled = true
      if (seekToRef) seekToRef.current = null
    }
  }, [youtubeId, seekToRef])

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-subtle">
      <div ref={hostRef} className="aspect-video w-full" aria-label={title} />
    </div>
  )
}
```

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` → 컴파일 통과

- [ ] **Step 3: Commit**

```bash
git add src/components/sermons/YouTubePlayer.tsx
git commit -m "feat: YouTube IFrame Player(seekTo) 컴포넌트"
```

---

## Task 13: 공개 상세 페이지 요약 UI

**Files:**
- Create: `src/components/sermons/SermonSummary.tsx`
- Modify: `src/app/sermons/[id]/page.tsx:48-56`

**Interfaces:**
- Consumes: `YouTubePlayer`, `formatTimestamp`, `Sermon`.
- `SermonSummary`는 client component (seekRef 공유). props: `{ sermon: Sermon }`.

- [ ] **Step 1: 구현** — `src/components/sermons/SermonSummary.tsx`

```tsx
'use client'

import { useRef } from 'react'
import YouTubePlayer from './YouTubePlayer'
import { formatTimestamp } from '@/lib/sermons/format'
import type { Sermon } from '@/lib/types'

export default function SermonSummary({ sermon }: { sermon: Sermon }) {
  const seekRef = useRef<((s: number) => void) | null>(null)
  const ready = sermon.summaryStatus === 'ready'

  return (
    <div className="mt-8 space-y-8">
      <YouTubePlayer youtubeId={sermon.youtubeId} title={sermon.title} seekToRef={seekRef} />

      {ready && sermon.quickSummary?.length ? (
        <section className="rounded-lg border border-line bg-paper p-6 shadow-subtle">
          <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">빠른 요약</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-ink-muted">
            {sermon.quickSummary.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </section>
      ) : null}

      {ready && sermon.chapters?.length ? (
        <section className="rounded-lg border border-line bg-paper p-6 shadow-subtle">
          <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">타임라인 요약</h2>
          <ul className="mt-4 space-y-4">
            {sermon.chapters.map((c, i) => (
              <li key={i} className="flex gap-3">
                <button
                  type="button"
                  onClick={() => seekRef.current?.(c.startSeconds)}
                  className="shrink-0 font-mono text-sm font-semibold text-accent-deep hover:underline"
                >
                  {formatTimestamp(c.startSeconds)}
                </button>
                <div>
                  <p className="font-semibold text-ink">{c.title}</p>
                  <p className="mt-1 leading-7 text-ink-muted">{c.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: 상세 페이지 교체** — `src/app/sermons/[id]/page.tsx`

import 교체 (`YouTubeEmbed` 제거, `SermonSummary` 추가):

```tsx
import SermonSummary from '@/components/sermons/SermonSummary'
```

기존 `<div className="mt-8"><YouTubeEmbed .../></div>` + 그 아래 `{sermon.summary && (...)}` 블록 전체를 아래로 교체:

```tsx
        <SermonSummary sermon={sermon} />
```

- [ ] **Step 3: 빌드 + 타입체크** — Run: `npm run build` → 통과 (사용 안 하게 된 `YouTubeEmbed` import가 남아있지 않은지 확인)

- [ ] **Step 4: Commit**

```bash
git add src/components/sermons/SermonSummary.tsx src/app/sermons/[id]/page.tsx
git commit -m "feat: 공개 상세에 빠른요약+타임라인(클릭 seek) 표시"
```

---

## Task 14: admin 목록 + 편집 페이지

**Files:**
- Modify: `src/app/admin/sermons/page.tsx`
- Create: `src/components/admin/SermonAdminTable.tsx`
- Create: `src/app/admin/sermons/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `getSermonsForAdmin`, `getSermonForAdmin`, `syncNowAction`, `generateSummaryAction`, `togglePublishAction`, `updateSermonAction`, `worshipTypes`.

- [ ] **Step 1: 목록 테이블(client)** — `src/components/admin/SermonAdminTable.tsx`

```tsx
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { generateSummaryAction, syncNowAction, togglePublishAction } from '@/lib/actions/sermons'

interface Row {
  id: string
  sermonDate: string
  title: string
  preacher: string | null
  worshipType: string
  isPublished: boolean
  summaryStatus: string
}

export default function SermonAdminTable({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')

  function run(fn: () => Promise<unknown>, ok: string) {
    setMsg('')
    startTransition(async () => {
      try { await fn(); setMsg(ok) } catch (e) { setMsg(String(e)) }
    })
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(async () => { const r = await syncNowAction(); setMsg(`동기화 완료: ${r.inserted}건 추가`) }, '')}
          className="rounded-md bg-accent-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          지금 동기화
        </button>
        {msg && <span className="text-sm text-ink-muted">{msg}</span>}
      </div>
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>{['Date', 'Title', 'Preacher', 'Worship', 'Summary', 'Published', 'Actions'].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-line"><td className="px-4 py-3 text-ink-muted" colSpan={7}>No sermons.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-4 py-3">{r.sermonDate}</td>
                <td className="px-4 py-3">{r.title}</td>
                <td className="px-4 py-3">{r.preacher ?? '—'}</td>
                <td className="px-4 py-3">{r.worshipType}</td>
                <td className="px-4 py-3">{r.summaryStatus}</td>
                <td className="px-4 py-3">{r.isPublished ? '공개' : '비공개'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link href={`/admin/sermons/${r.id}/edit`} className="text-accent-deep hover:underline">편집</Link>
                    <button type="button" disabled={pending}
                      onClick={() => run(() => generateSummaryAction(r.id), '요약 생성 완료')}
                      className="text-accent-deep hover:underline disabled:opacity-50">요약</button>
                    <button type="button" disabled={pending}
                      onClick={() => run(() => togglePublishAction(r.id, !r.isPublished), '변경됨')}
                      className="text-accent-deep hover:underline disabled:opacity-50">{r.isPublished ? '비공개' : '공개'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 목록 페이지 교체** — `src/app/admin/sermons/page.tsx`

```tsx
import { verifySession } from '@/lib/dal'
import { getSermonsForAdmin } from '@/lib/actions/sermons'
import SermonAdminTable from '@/components/admin/SermonAdminTable'

export default async function AdminSermonsPage() {
  await verifySession()
  const rows = await getSermonsForAdmin()

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-ink">Sermons</h1>
      </div>
      <SermonAdminTable rows={rows.map((r) => ({
        id: r.id, sermonDate: r.sermonDate, title: r.title, preacher: r.preacher,
        worshipType: r.worshipType, isPublished: r.isPublished, summaryStatus: r.summaryStatus,
      }))} />
    </div>
  )
}
```

- [ ] **Step 3: 편집 페이지** — `src/app/admin/sermons/[id]/edit/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { getSermonForAdmin } from '@/lib/actions/sermons'
import SermonEditForm from '@/components/admin/SermonEditForm'

export default async function EditSermonPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession()
  const { id } = await params
  const row = await getSermonForAdmin(id)
  if (!row) notFound()
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-bold text-ink">설교 편집</h1>
      <SermonEditForm
        id={row.id}
        initial={{
          title: row.title, preacher: row.preacher ?? '', scripture: row.scripture ?? '',
          worshipType: row.worshipType, sermonDate: row.sermonDate,
        }}
        summaryStatus={row.summaryStatus}
        quickSummary={row.quickSummary ?? []}
        chapters={row.chapters ?? []}
      />
    </div>
  )
}
```

- [ ] **Step 4: 편집 폼(client)** — `src/components/admin/SermonEditForm.tsx`

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateSummaryAction, updateSermonAction, type SermonEditInput } from '@/lib/actions/sermons'
import { formatTimestamp } from '@/lib/sermons/format'
import { worshipTypes } from '@/lib/worship'
import type { SermonChapter } from '@/lib/types'

interface Props {
  id: string
  initial: SermonEditInput
  summaryStatus: string
  quickSummary: string[]
  chapters: SermonChapter[]
}

export default function SermonEditForm({ id, initial, summaryStatus, quickSummary, chapters }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<SermonEditInput>(initial)
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()

  function set<K extends keyof SermonEditInput>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <label className="block"><span className="text-sm text-ink-muted">제목</span>
          <input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
        <label className="block"><span className="text-sm text-ink-muted">설교자 (공개 전 필수)</span>
          <input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={form.preacher} onChange={(e) => set('preacher', e.target.value)} /></label>
        <label className="block"><span className="text-sm text-ink-muted">본문</span>
          <input className="mt-1 w-full rounded-md border border-line px-3 py-2" value={form.scripture} onChange={(e) => set('scripture', e.target.value)} /></label>
        <label className="block"><span className="text-sm text-ink-muted">예배 종류</span>
          <select className="mt-1 w-full rounded-md border border-line px-3 py-2" value={form.worshipType} onChange={(e) => set('worshipType', e.target.value)}>
            {worshipTypes.map((w) => <option key={w} value={w}>{w}</option>)}
          </select></label>
        <label className="block"><span className="text-sm text-ink-muted">날짜</span>
          <input type="date" className="mt-1 w-full rounded-md border border-line px-3 py-2" value={form.sermonDate} onChange={(e) => set('sermonDate', e.target.value)} /></label>
      </div>

      <div className="flex gap-3">
        <button type="button" disabled={pending}
          onClick={() => { setMsg(''); startTransition(async () => { try { await updateSermonAction(id, form); setMsg('저장됨'); router.refresh() } catch (e) { setMsg(String(e)) } }) }}
          className="rounded-md bg-accent-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">저장</button>
        <button type="button" disabled={pending}
          onClick={() => { setMsg(''); startTransition(async () => { try { const s = await generateSummaryAction(id); setMsg(`요약: ${s}`); router.refresh() } catch (e) { setMsg(String(e)) } }) }}
          className="rounded-md border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">요약 재생성</button>
        {msg && <span className="self-center text-sm text-ink-muted">{msg}</span>}
      </div>

      <div className="rounded-lg border border-line p-4">
        <p className="text-sm text-ink-muted">요약 상태: <strong>{summaryStatus}</strong></p>
        {quickSummary.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-ink-muted">{quickSummary.map((q, i) => <li key={i}>{q}</li>)}</ul>
        )}
        {chapters.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">{chapters.map((c, i) => (
            <li key={i}><span className="font-mono text-accent-deep">{formatTimestamp(c.startSeconds)}</span> · {c.title}</li>
          ))}</ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 빌드 + 타입체크** — Run: `npm run build` → 통과

- [ ] **Step 6: 수동 검증** — admin 로그인 후 `/admin/sermons`에서 "지금 동기화" → 행 생성, "편집"에서 설교자 입력·저장, "공개" 토글(설교자 없으면 에러 메시지) 확인.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/sermons src/components/admin/SermonAdminTable.tsx src/components/admin/SermonEditForm.tsx
git commit -m "feat: 설교 admin 목록/편집 UI(동기화·요약·공개)"
```

---

## Task 15: 전체 회귀 + 정리

- [ ] **Step 1: 전체 테스트** — Run: `npm test` → 전부 PASS
- [ ] **Step 2: 타입체크 + 빌드** — Run: `npx tsc --noEmit && npm run build` → 통과
- [ ] **Step 3: 미사용 코드 확인** — `YouTubeEmbed.tsx`가 더 이상 import되지 않으면 삭제할지 결정(다른 곳 사용 여부 grep). 사용처 없으면 제거 후 커밋.

```bash
git add -A
git commit -m "chore: 회귀 통과 + 미사용 정리"
```

---

## Self-Review

**Spec coverage**
- 재생목록 자동 동기화 → Task 4·5·6·10. AI 요약(Gemini URL 직접) → Task 7. claim 큐/재시도/stale → Task 8. cron+수동 트리거 → Task 9·10·14. jsonb 데이터 모델 → Task 1. worshipType 7종 → Task 2. preacher nullable+공개전검증 → Task 1·9. Zod 검증 → Task 7. 재생목록 우선순위 선점 → Task 5·6. 페이지네이션/접근실패 → Task 4·6. IFrame Player seek → Task 12·13. 빠른요약+타임라인 UI → Task 13. admin CRUD → Task 14. env 문서 → Task 0. 테스트 모킹 → Task 4·7. 모든 스펙 항목에 대응 태스크 존재. ✅
- unlisted/실패=정상상태 → `summaryStatus='failed'` + 요약 없이 공개(Task 8·9·13)로 반영. ✅

**Placeholder scan** — 모든 코드 스텝에 실제 코드 포함. "적절히 처리" 류 없음. ✅

**Type consistency** — `SermonChapter`(Task 2)를 schema(1)·summary(7)·data(11)·UI(13·14)에서 동일 사용. `summaryStatus` 리터럴 유니온 일관. `claimNextSermon` 반환(`videoUrl`,`durationSeconds`)을 `processClaimedSermon`가 그대로 consume. `SermonEditInput`(Task 9) ↔ 폼(Task 14) 일치. `ResolvedPlaylist`(5) ↔ `syncSermons`(6) 일치. ✅

**열린 항목(구현 중 확인 필요, 플랜에 명시됨)**
- `@google/genai` 정확한 시그니처(Task 7 주석), `db.execute` 반환 형태(Task 8 주석), Next 16 Route Handler/Player API 규칙(Task 10·12 사전확인). 각 Task에 확인 지침 포함.
