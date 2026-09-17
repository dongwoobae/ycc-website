# 설교 업로드 감지 폴링 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설교 업로드 감지 주경로를 WebSub 푸시에서 YouTube Data API 폴링으로 옮기고, WebSub은 복구되면 즉시성을 되찾는 부경로로 남긴다.

**Architecture:** `reconcile-sermons` 잡이 uploads 재생목록을 `playlistItems.list`로 읽어 DB와 대조하고, 누락분에 한해서만 `videos.list`로 길이를 채워 등록한다. Data API가 못 쓰이는 모든 경우(키 미설정·403·5xx·네트워크)에는 기존 yt-api 경로로 폴백한다. 폴링 스케줄은 예배 시간대에 집중시키고, 우리가 고칠 수 없는 남의 장애는 `error`가 아닌 `warning`으로 남긴다.

**Tech Stack:** Next.js(App Router) · TypeScript · drizzle-orm/Neon Postgres · Upstash QStash 2.11.1 · vitest · YouTube Data API v3

**Spec:** `docs/specs/2026-09-17-sermon-detection-polling-design.md`

## Global Constraints

- `app_logs.action`은 `text` 컬럼이다. 값을 늘려도 **DB 마이그레이션이 없다**.
- Data API 쿼터는 메서드 단위다. `playlistItems.list`·`videos.list` 모두 **호출당 1 unit**, 무료 한도는 일 10,000 units.
- RapidAPI yt-api 무료 플랜은 **월 300회**이고 자막 조회와 키를 공유한다. 폴백 경로가 호출 수를 늘리지 않게 한다.
- `maxResults`는 **50**(API 상한). 10이면 폴링 간격 사이 11건 이상 업로드 시 11번째부터 영구 누락된다.
- 업로드 시각은 **`contentDetails.videoPublishedAt`**. `snippet.publishedAt`은 재생목록에 담긴 시각이라 다르다.
- **에러 로그에 요청 URL을 넣지 않는다.** Data API는 키를 쿼리스트링에 싣는다. 메서드명·HTTP 상태·정제한 사유만 남긴다.
- 썸네일은 API에서 받지 않는다. 기존 `thumbnailUrlFor(videoId)`를 쓴다.
- 테스트: `npm test`(vitest, `environment: node`). 순수 정규화 함수는 별도 테스트, 네트워크는 목킹.
- 커밋 메시지에 리뷰·자체점검 같은 **과정을 적지 않는다.** 날짜만 쓴다.

---

### Task 1: `warning` 로그 레벨

**Files:**
- Modify: `src/lib/logger.ts`
- Create: `src/app/admin/log/actions.ts`
- Create: `src/app/admin/log/actions.test.ts`
- Modify: `src/app/admin/log/page.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `log('warning', …)` 호출 가능(Task 4·5가 쓴다), `ACTION_OPTIONS`·`ACTION_BADGE` (`./actions`)

- [ ] **Step 1: `LogAction`에 `warning` 추가**

`src/lib/logger.ts`의 4행을 바꾼다.

```ts
type LogAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'error' | 'warning' | 'view'
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/app/admin/log/actions.test.ts`를 만든다. 필터에만 추가하고 뱃지를 빠뜨리면 회색 폴백으로 떨어져 `login`/`logout`과 구분되지 않는데, 화면을 열기 전엔 아무도 모른다. 그 짝을 테스트로 묶는다.

```ts
import { describe, expect, it } from 'vitest'
import { ACTION_BADGE, ACTION_OPTIONS } from './actions'

describe('관리자 로그 액션 목록', () => {
  it('warning을 필터에서 고를 수 있다', () => {
    expect(ACTION_OPTIONS).toContain('warning')
  })

  it('필터에 있는 모든 액션은 뱃지 색을 갖는다', () => {
    const missing = ACTION_OPTIONS.filter((a) => !ACTION_BADGE[a])
    expect(missing).toEqual([])
  })

  it('warning은 error와 다른 색이다', () => {
    expect(ACTION_BADGE.warning).not.toBe(ACTION_BADGE.error)
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/admin/log/actions.test.ts`
Expected: FAIL — `Failed to resolve import "./actions"`

- [ ] **Step 4: 두 상수를 별도 모듈로 옮기고 `warning`을 더한다**

`src/app/admin/log/actions.ts`를 만든다. 페이지 파일에 두면 서버 컴포넌트라 테스트에서 못 읽는다.

```ts
/** 감사 로그 필터 드롭다운 겸 쿼리 파라미터 화이트리스트. */
export const ACTION_OPTIONS = ['create', 'update', 'delete', 'error', 'warning', 'login', 'logout'] as const

/** 미등록 액션은 회색으로 떨어지므로, ACTION_OPTIONS에 넣은 값은 여기에도 넣는다. */
export const ACTION_BADGE: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  login: 'bg-slate-100 text-slate-700',
  logout: 'bg-slate-100 text-slate-700',
}
```

`src/app/admin/log/page.tsx`에서 두 상수 선언을 지우고 import로 바꾼다. `PAGE_SIZE`는 페이지에 남긴다.

```ts
import { ACTION_BADGE, ACTION_OPTIONS } from './actions'
```

- [ ] **Step 5: 테스트와 타입 검사**

Run: `npx vitest run src/app/admin/log/actions.test.ts && npm run typecheck`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/lib/logger.ts src/app/admin/log/actions.ts src/app/admin/log/actions.test.ts src/app/admin/log/page.tsx
git commit -m "feat: 감사 로그에 warning 레벨을 추가한다"
```

---

### Task 2: YouTube Data API 모듈

**Files:**
- Modify: `src/lib/youtube/types.ts`
- Create: `src/lib/youtube/data-api.ts`
- Create: `src/lib/youtube/data-api.test.ts`

**Interfaces:**
- Consumes: `thumbnailUrlFor(videoId: string): string` (`./rapidapi-channel`)
- Produces:
  - `YouTubeVideoCandidate { videoId: string; title: string; publishedAt: string }`
  - `VideoDetail { durationSeconds: number; isLiveOrUpcoming: boolean }`
  - `uploadsPlaylistId(channelId: string): string`
  - `parseIsoDuration(value: unknown): number | null`
  - `normalizePlaylistItems(raw: unknown): YouTubeVideoCandidate[]`
  - `normalizeVideoDetails(raw: unknown): Map<string, VideoDetail>`
  - `listUploadCandidates(channelId: string): Promise<YouTubeVideoCandidate[]>`
  - `fetchVideoDetails(videoIds: string[]): Promise<Map<string, VideoDetail>>`

- [ ] **Step 1: 후보 타입을 분리한다**

`src/lib/youtube/types.ts`를 통째로 바꾼다. `playlistItems.list` 결과에는 길이가 없어 `YouTubeVideo`를 만족하지 못한다. 후보 단계에서 길이 `0`을 채워 넣으면 그 값이 그대로 DB에 저장된다.

```ts
/** 목록 조회로 얻는 최소 정보. 길이·썸네일이 아직 없다. */
export interface YouTubeVideoCandidate {
  videoId: string
  title: string
  publishedAt: string
}

/** 등록에 필요한 값이 모두 채워진 영상. insertSermon은 이것만 받는다. */
export interface YouTubeVideo extends YouTubeVideoCandidate {
  thumbnailUrl: string | null
  durationSeconds: number
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/lib/youtube/data-api.test.ts`를 만든다.

```ts
import { describe, expect, it } from 'vitest'
import {
  normalizePlaylistItems,
  normalizeVideoDetails,
  parseIsoDuration,
  uploadsPlaylistId,
} from './data-api'

describe('uploadsPlaylistId', () => {
  it('UC 접두를 UU로 바꾼다', () => {
    expect(uploadsPlaylistId('UCzB3UsqsJhtFUvPEeOtTL6g')).toBe('UUzB3UsqsJhtFUvPEeOtTL6g')
  })
})

describe('parseIsoDuration', () => {
  it('시·분·초를 초로 바꾼다', () => {
    expect(parseIsoDuration('PT1H3M23S')).toBe(3803)
    expect(parseIsoDuration('PT34M37S')).toBe(2077)
    expect(parseIsoDuration('PT3M37S')).toBe(217)
    expect(parseIsoDuration('PT0S')).toBe(0)
  })

  it('형식이 아니면 null', () => {
    expect(parseIsoDuration('34:37')).toBeNull()
    expect(parseIsoDuration('P')).toBeNull()
    expect(parseIsoDuration(undefined)).toBeNull()
  })
})

describe('normalizePlaylistItems', () => {
  it('업로드 시각은 contentDetails.videoPublishedAt에서 온다', () => {
    expect(
      normalizePlaylistItems({
        items: [
          {
            snippet: { title: '영천중앙교회 260916 수요예배 /', publishedAt: '2020-01-01T00:00:00Z' },
            contentDetails: { videoId: 'c-oLFHUSx8A', videoPublishedAt: '2026-09-16T11:43:13Z' },
          },
        ],
      }),
    ).toEqual([
      {
        videoId: 'c-oLFHUSx8A',
        title: '영천중앙교회 260916 수요예배 /',
        publishedAt: '2026-09-16T11:43:13Z',
      },
    ])
  })

  it('videoId가 없는 항목과 비배열 응답은 버린다', () => {
    expect(normalizePlaylistItems({ items: [{ snippet: { title: 't' } }] })).toEqual([])
    expect(normalizePlaylistItems({})).toEqual([])
    expect(normalizePlaylistItems(null)).toEqual([])
  })
})

describe('normalizeVideoDetails', () => {
  it('길이와 라이브 여부를 videoId로 색인한다', () => {
    const map = normalizeVideoDetails({
      items: [
        {
          id: 'c-oLFHUSx8A',
          snippet: { liveBroadcastContent: 'none' },
          contentDetails: { duration: 'PT34M37S' },
        },
        {
          id: 'live-1',
          snippet: { liveBroadcastContent: 'live' },
          contentDetails: { duration: 'PT0S' },
        },
      ],
    })

    expect(map.get('c-oLFHUSx8A')).toEqual({ durationSeconds: 2077, isLiveOrUpcoming: false })
    expect(map.get('live-1')).toEqual({ durationSeconds: 0, isLiveOrUpcoming: true })
  })

  it('길이를 못 읽은 항목은 넣지 않는다', () => {
    const map = normalizeVideoDetails({
      items: [{ id: 'bad', snippet: { liveBroadcastContent: 'none' }, contentDetails: {} }],
    })
    expect(map.size).toBe(0)
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/youtube/data-api.test.ts`
Expected: FAIL — `Failed to resolve import "./data-api"`

- [ ] **Step 4: 모듈을 구현한다**

`src/lib/youtube/data-api.ts`를 만든다.

```ts
import { thumbnailUrlFor } from './rapidapi-channel'
import type { YouTubeVideo, YouTubeVideoCandidate } from './types'

const API_BASE = 'https://www.googleapis.com/youtube/v3'

/** 누락분 조회 상한. 쿼터는 메서드 단위라 50을 받아도 1 unit이다. */
const MAX_RESULTS = 50

export interface VideoDetail {
  durationSeconds: number
  isLiveOrUpcoming: boolean
}

/** 채널의 uploads 재생목록 ID. UC→UU 치환은 YouTube가 보장하는 규칙이다. */
export function uploadsPlaylistId(channelId: string): string {
  return `UU${channelId.slice(2)}`
}

/** ISO8601 duration(PT1H3M23S)을 초로. 형식이 아니거나 구성요소가 없으면 null. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value)
  if (!m || m.slice(1).every((g) => g === undefined)) return null
  const [, d, h, min, s] = m
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0)
}

interface RawPlaylistItem {
  snippet?: { title?: unknown }
  contentDetails?: { videoId?: unknown; videoPublishedAt?: unknown }
}

/**
 * playlistItems.list 응답을 후보 목록으로 정규화한다.
 * 업로드 시각은 contentDetails.videoPublishedAt이다 — snippet.publishedAt은 재생목록에 담긴 시각이라 다르다.
 */
export function normalizePlaylistItems(raw: unknown): YouTubeVideoCandidate[] {
  const items = (raw as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) return []
  const out: YouTubeVideoCandidate[] = []
  for (const it of items as RawPlaylistItem[]) {
    const videoId = typeof it.contentDetails?.videoId === 'string' ? it.contentDetails.videoId : ''
    if (!videoId) continue
    out.push({
      videoId,
      title: typeof it.snippet?.title === 'string' ? it.snippet.title : '',
      publishedAt:
        typeof it.contentDetails?.videoPublishedAt === 'string' ? it.contentDetails.videoPublishedAt : '',
    })
  }
  return out
}

interface RawVideoItem {
  id?: unknown
  snippet?: { liveBroadcastContent?: unknown }
  contentDetails?: { duration?: unknown }
}

/**
 * videos.list 응답을 videoId → 상세 맵으로 정규화한다.
 * 길이를 못 읽은 항목은 넣지 않는다 — 0초로 저장되면 오디오 받아쓰기의 길이 검사가 기준을 잃는다.
 * snippet은 liveBroadcastContent 때문에 받는다. 제목은 후보에 이미 있어 쓰지 않는다.
 */
export function normalizeVideoDetails(raw: unknown): Map<string, VideoDetail> {
  const items = (raw as { items?: unknown } | null)?.items
  const out = new Map<string, VideoDetail>()
  if (!Array.isArray(items)) return out
  for (const it of items as RawVideoItem[]) {
    const id = typeof it.id === 'string' ? it.id : ''
    if (!id) continue
    const durationSeconds = parseIsoDuration(it.contentDetails?.duration)
    if (durationSeconds === null) continue
    out.set(id, {
      durationSeconds,
      isLiveOrUpcoming: it.snippet?.liveBroadcastContent !== 'none',
    })
  }
  return out
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error('YOUTUBE_API_KEY is not set')
  return key
}

/** 요청 URL은 키를 쿼리스트링에 싣는다. 오류 메시지에 URL을 넣지 않는다. */
async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${API_BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', apiKey())
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`youtube data api ${path} ${res.status}`)
  return res.json()
}

/** uploads 재생목록의 최신 영상 후보를 최신순으로 가져온다. (1 unit) */
export async function listUploadCandidates(channelId: string): Promise<YouTubeVideoCandidate[]> {
  const raw = await getJson('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId(channelId),
    maxResults: String(MAX_RESULTS),
  })
  return normalizePlaylistItems(raw)
}

/** 영상 상세를 한 번에 가져온다. (1 unit, id는 50개까지) */
export async function fetchVideoDetails(videoIds: string[]): Promise<Map<string, VideoDetail>> {
  if (videoIds.length === 0) return new Map()
  const raw = await getJson('videos', {
    part: 'snippet,contentDetails',
    id: videoIds.slice(0, MAX_RESULTS).join(','),
  })
  return normalizeVideoDetails(raw)
}

/** 후보 + 상세를 등록 가능한 완성 타입으로 합친다. */
export function toYouTubeVideo(candidate: YouTubeVideoCandidate, detail: VideoDetail): YouTubeVideo {
  return {
    ...candidate,
    thumbnailUrl: thumbnailUrlFor(candidate.videoId),
    durationSeconds: detail.durationSeconds,
  }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `npx vitest run src/lib/youtube/data-api.test.ts && npm run typecheck`
Expected: 전부 PASS, 타입 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add src/lib/youtube/types.ts src/lib/youtube/data-api.ts src/lib/youtube/data-api.test.ts
git commit -m "feat: YouTube Data API로 업로드 목록과 영상 상세를 읽는다"
```

---

### Task 3: `insertSermon`에 등록 출처

**Files:**
- Modify: `src/lib/sermons/ingest.ts`
- Modify: `src/lib/sermons/ingest.test.ts`
- Modify: `src/lib/sermons/reconcile.ts:32`
- Modify: `src/app/api/jobs/ingest-video/route.ts:44`
- Modify: `src/lib/sermons/sync.ts:51`
- Modify: `src/lib/sermons/sync.test.ts`
- Modify: `scripts/seed-from-rapidapi.ts:21`

**Interfaces:**
- Consumes: Task 2의 `YouTubeVideo`
- Produces: `SermonOrigin = 'websub' | 'reconcile' | 'sync' | 'seed'`, `insertSermon(video, worshipType, origin): Promise<string>`

- [ ] **Step 1: 실패하는 테스트로 바꾼다**

`src/lib/sermons/ingest.test.ts`에서 `insertSermon` 호출 세 곳에 출처를 넘기고, `create` 메시지 단언을 바꾼다.

```ts
  it('정상 등록이면 출처를 붙인 create 로그를 남긴다', async () => {
    const id = await insertSermon(video, '주일예배', 'reconcile')

    expect(id).toBe('sid')
    expect(log).toHaveBeenCalledWith('create', 'sermon', 'sid', '주일예배 - 제목 (주일예배) — 폴링')
  })

  it('자식 행 생성이 실패하면 sermons 행만 남았음을 로그로 남기고 다시 던진다', async () => {
    // 1번째 insert(sermons)는 통과시키고 2번째(sermon_summaries)부터 실패시킨다.
    state.failFromCall = 2

    await expect(insertSermon(video, '주일예배', 'reconcile')).rejects.toThrow('column does not exist')

    expect(log).toHaveBeenCalledWith('error', 'sermon', 'sid', expect.stringContaining('videoId=vid-1'))
    const [action, , , message] = vi.mocked(log).mock.calls[0]
    expect(action).toBe('error')
    expect(message).toContain('sermons 행만 남음')
  })

  it('sermons 행 자체가 실패하면 id 없이 로그를 남기고 다시 던진다', async () => {
    state.failFromCall = 1

    await expect(insertSermon(video, '주일예배', 'reconcile')).rejects.toThrow('column does not exist')

    expect(log).toHaveBeenCalledWith('error', 'sermon', undefined, expect.stringContaining('videoId=vid-1'))
  })
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/sermons/ingest.test.ts`
Expected: FAIL — `expected '주일예배 - 제목 (주일예배)' to equal '주일예배 - 제목 (주일예배) — 폴링'`

- [ ] **Step 3: `insertSermon` 시그니처를 바꾼다**

`src/lib/sermons/ingest.ts`에 타입과 라벨을 더하고 함수를 고친다. 인자를 선택적으로 두면 새 호출부가 조용히 잘못 분류되므로 필수로 둔다.

```ts
/** 설교가 등록된 경로. 값 자체는 영문으로 두고 표시할 때만 한국어로 바꾼다. */
export type SermonOrigin = 'websub' | 'reconcile' | 'sync' | 'seed'

const ORIGIN_LABEL: Record<SermonOrigin, string> = {
  websub: '푸시',
  reconcile: '폴링',
  sync: '수동',
  seed: '시드',
}
```

`insertSermon`의 시그니처와 `create` 로그 한 줄을 바꾼다.

```ts
export async function insertSermon(
  video: YouTubeVideo,
  worshipType: WorshipType,
  origin: SermonOrigin,
): Promise<string> {
```

```ts
      await log('create', 'sermon', id, `${video.title} (${worshipType}) — ${ORIGIN_LABEL[origin]}`)
```

함수 JSDoc에 한 줄을 더한다. 푸시 복구를 이 로그로 알아채는 것이 설계의 전제다.

```ts
 * 등록 경로를 create 로그에 남긴다 — WebSub 푸시가 복구되면 `— 푸시` 행이 나타나는 것이 유일한 신호다.
```

- [ ] **Step 4: 네 호출부에 출처를 넘긴다**

```ts
// src/lib/sermons/reconcile.ts
      sermonId = await insertSermon(video, worshipType, 'reconcile')
```

```ts
// src/app/api/jobs/ingest-video/route.ts
  const sermonId = await insertSermon(video, worshipType, 'websub')
```

```ts
// src/lib/sermons/sync.ts
      sermonId = await insertSermon(video, worshipType, 'sync')
```

```ts
// scripts/seed-from-rapidapi.ts
    const sermonId = await insertSermon(video, worshipType, 'seed')
```

- [ ] **Step 5: sync 테스트에 출처 단언을 더한다**

`src/lib/sermons/sync.test.ts`의 첫 테스트 본문 끝에 추가한다.

```ts
    expect(insertSermon).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'a' }), '특송', 'sync')
```

- [ ] **Step 6: 테스트와 타입 검사**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS. 타입 오류가 남아 있으면 출처를 안 넘긴 호출부가 있다는 뜻이다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/sermons/ingest.ts src/lib/sermons/ingest.test.ts src/lib/sermons/reconcile.ts src/lib/sermons/sync.ts src/lib/sermons/sync.test.ts src/app/api/jobs/ingest-video/route.ts scripts/seed-from-rapidapi.ts
git commit -m "feat: 설교 등록 로그에 어느 경로로 들어왔는지 남긴다"
```

---

### Task 4: reconcile을 Data API 주경로로

**Files:**
- Modify: `src/lib/sermons/reconcile.ts`
- Modify: `src/lib/sermons/reconcile.test.ts`
- Modify: `README.md` (설교 파이프라인 절 2문장)

**Interfaces:**
- Consumes: Task 2의 `listUploadCandidates`·`fetchVideoDetails`·`toYouTubeVideo`·`VideoDetail`, Task 3의 `insertSermon(…, 'reconcile')`, Task 1의 `log('warning', …)`
- Produces: `reconcileSermons(): Promise<{ checked: number; inserted: number }>` (반환 모양 유지)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/sermons/reconcile.test.ts`를 통째로 바꾼다. 기존 3개 테스트는 목 대상만 바꾸면 폴백 분기를 타 그대로 통과하므로, **주경로를 타는 케이스와 폴백으로 내려가는 케이스를 따로 고정한다.**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/db', () => ({
  db: { select: () => ({ from: () => Promise.resolve([{ id: 'existing-video' }]) }) },
}))
vi.mock('@/lib/youtube/data-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/youtube/data-api')>()),
  listUploadCandidates: vi.fn(),
  fetchVideoDetails: vi.fn(),
}))
vi.mock('@/lib/youtube/rapidapi-channel', () => ({ fetchChannelVideos: vi.fn() }))
vi.mock('./ingest', () => ({ insertSermon: vi.fn(async () => 'sid') }))
vi.mock('@/lib/qstash', () => ({ publishJob: vi.fn(async () => undefined) }))
vi.mock('@/lib/logger', () => ({ log: vi.fn(async () => undefined) }))

import { reconcileSermons } from './reconcile'
import { fetchVideoDetails, listUploadCandidates } from '@/lib/youtube/data-api'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import { insertSermon } from './ingest'
import { publishJob } from '@/lib/qstash'
import { log } from '@/lib/logger'
import { revalidatePath } from 'next/cache'

const candidate = (videoId: string, title: string) => ({
  videoId,
  title,
  publishedAt: '2026-01-01T00:00:00Z',
})

const detail = (durationSeconds = 10, isLiveOrUpcoming = false) => ({ durationSeconds, isLiveOrUpcoming })

const ytVideo = (videoId: string, title: string) => ({
  ...candidate(videoId, title),
  thumbnailUrl: null,
  durationSeconds: 10,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
  vi.stubEnv('YOUTUBE_API_KEY', 'k')
  vi.mocked(insertSermon).mockResolvedValue('sid')
})

describe('reconcileSermons — Data API 주경로', () => {
  it('DB에 없는 영상만 등록하고, 요약 유형이면 fetch-transcript를 발행한다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([
      candidate('existing-video', '주일예배 - 이미 있음'),
      candidate('missing-1', '주일예배 - 누락된 설교'),
      candidate('missing-2', '특송 - 비요약 유형'),
    ])
    vi.mocked(fetchVideoDetails).mockResolvedValue(
      new Map([
        ['missing-1', detail()],
        ['missing-2', detail()],
      ]),
    )

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 3, inserted: 2 })
    expect(insertSermon).toHaveBeenCalledTimes(2)
    // 요약 유형(주일예배)만 자막 체인에 투입, 특송은 등록만
    expect(publishJob).toHaveBeenCalledTimes(1)
    expect(publishJob).toHaveBeenCalledWith('fetch-transcript', { sermonId: 'sid', videoId: 'missing-1', attempt: 0 })
  })

  it('누락분이 없으면 videos.list를 호출하지 않는다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('existing-video', '주일예배 - 이미 있음')])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 0 })
    expect(fetchVideoDetails).not.toHaveBeenCalled()
  })

  it('진행 중 라이브·예약 공개는 등록하지 않는다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('live-1', '주일예배 - 방송 중')])
    vi.mocked(fetchVideoDetails).mockResolvedValue(new Map([['live-1', detail(0, true)]]))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 0 })
    expect(insertSermon).not.toHaveBeenCalled()
  })

  it('상세를 못 받은 영상은 건너뛴다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('missing-1', '주일예배 - 상세 없음')])
    vi.mocked(fetchVideoDetails).mockResolvedValue(new Map())

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 0 })
    expect(insertSermon).not.toHaveBeenCalled()
  })

  it('빈 목록을 "전부 삭제됨"으로 해석하지 않는다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 0, inserted: 0 })
    expect(insertSermon).not.toHaveBeenCalled()
  })

  it('revalidate가 던져도 남은 누락분을 계속 등록한다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([
      candidate('missing-1', '주일예배 - 첫째'),
      candidate('missing-2', '주일예배 - 둘째'),
    ])
    vi.mocked(fetchVideoDetails).mockResolvedValue(
      new Map([
        ['missing-1', detail()],
        ['missing-2', detail()],
      ]),
    )
    vi.mocked(revalidatePath).mockImplementationOnce(() => {
      throw new Error('revalidate failed')
    })

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 2, inserted: 2 })
  })

  it('한 영상의 등록이 실패해도 나머지 영상은 계속 등록한다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([
      candidate('missing-4', '주일예배 - 등록 실패'),
      candidate('missing-5', '수요예배 - 정상 등록'),
    ])
    vi.mocked(fetchVideoDetails).mockResolvedValue(
      new Map([
        ['missing-4', detail()],
        ['missing-5', detail()],
      ]),
    )
    vi.mocked(insertSermon).mockRejectedValueOnce(new Error('insert failed'))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 2, inserted: 1 })
    expect(publishJob).toHaveBeenCalledWith('fetch-transcript', { sermonId: 'sid', videoId: 'missing-5', attempt: 0 })
  })

  it('fetch-transcript 발행이 실패해도 등록 결과는 유지된다', async () => {
    vi.mocked(listUploadCandidates).mockResolvedValue([candidate('missing-3', '수요예배 - 발행 실패 케이스')])
    vi.mocked(fetchVideoDetails).mockResolvedValue(new Map([['missing-3', detail()]]))
    vi.mocked(publishJob).mockRejectedValueOnce(new Error('qstash down'))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 1 })
  })
})

describe('reconcileSermons — yt-api 폴백', () => {
  it('키가 없으면 yt-api로 내려가고 warning을 남긴다', async () => {
    vi.stubEnv('YOUTUBE_API_KEY', '')
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('YOUTUBE_API_KEY is not set'))
    vi.mocked(fetchChannelVideos).mockResolvedValue([ytVideo('missing-1', '주일예배 - 폴백 등록')])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 1 })
    expect(fetchChannelVideos).toHaveBeenCalledWith('UC_test', 1)
    expect(log).toHaveBeenCalledWith('warning', 'sermon', undefined, expect.stringContaining('폴백'))
  })

  it('폐기된 키로 403이 나도 폴백이 걸려 주경로가 멈추지 않는다', async () => {
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('youtube data api playlistItems 403'))
    vi.mocked(fetchChannelVideos).mockResolvedValue([ytVideo('missing-1', '주일예배 - 폴백 등록')])

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 1, inserted: 1 })
    expect(insertSermon).toHaveBeenCalledTimes(1)
  })

  it('폴백 경로는 videos.list를 쓰지 않는다 — 추가 호출 없이 목록의 길이를 그대로 쓴다', async () => {
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('youtube data api playlistItems 500'))
    vi.mocked(fetchChannelVideos).mockResolvedValue([ytVideo('missing-1', '주일예배 - 폴백 등록')])

    await reconcileSermons()

    expect(fetchVideoDetails).not.toHaveBeenCalled()
  })

  it('폴백까지 실패하면 예외를 던지지 않고 빈 결과로 끝낸다', async () => {
    vi.mocked(listUploadCandidates).mockRejectedValue(new Error('youtube data api playlistItems 500'))
    vi.mocked(fetchChannelVideos).mockRejectedValue(new Error('yt-api channel/videos 429'))

    const result = await reconcileSermons()

    expect(result).toEqual({ checked: 0, inserted: 0 })
    expect(log).toHaveBeenCalledWith('error', 'sermon', undefined, expect.stringContaining('조회 실패'))
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/sermons/reconcile.test.ts`
Expected: FAIL — `listUploadCandidates`를 호출하지 않아 `checked: 0`이 나온다

- [ ] **Step 3: reconcile을 구현한다**

`src/lib/sermons/reconcile.ts`를 통째로 바꾼다.

```ts
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { publishJob } from '@/lib/qstash'
import { expectsAutoSummary } from '@/lib/worship'
import {
  fetchVideoDetails,
  listUploadCandidates,
  toYouTubeVideo,
  type VideoDetail,
} from '@/lib/youtube/data-api'
import { fetchChannelVideos } from '@/lib/youtube/rapidapi-channel'
import type { YouTubeVideoCandidate } from '@/lib/youtube/types'
import { classifyByTitle } from './classify-title'
import { insertSermon } from './ingest'
import { revalidateSermonPaths } from './revalidate'

interface UploadListing {
  candidates: YouTubeVideoCandidate[]
  detailsFor: (videoIds: string[]) => Promise<Map<string, VideoDetail>>
}

/**
 * 업로드 목록을 가져온다. Data API가 못 쓰이는 모든 경우에 yt-api로 폴백한다.
 *
 * 폴백 조건을 "키 미설정"으로만 두면 폐기된 키가 설정돼 있을 때 매 회차 403으로 건너뛰며
 * 주경로가 무기한 멈춘다 — 능동 알림이 없어 사람이 로그를 보기 전까지 아무도 모른다.
 * 폴백의 상세 조회는 이미 받아 둔 목록에서 꺼내 쓴다. yt-api 호출 수가 늘지 않아야 한다.
 */
async function listUploads(channelId: string): Promise<UploadListing> {
  try {
    return { candidates: await listUploadCandidates(channelId), detailsFor: fetchVideoDetails }
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.warn(`[reconcile] Data API 조회 실패 — yt-api로 폴백: ${reason}`)
    await log('warning', 'sermon', undefined, `[reconcile] Data API 조회 실패 — yt-api로 폴백: ${reason}`)
    const videos = await fetchChannelVideos(channelId, 1)
    const byId = new Map(videos.map((v) => [v.videoId, v]))
    return {
      candidates: videos,
      detailsFor: async (ids) =>
        new Map(
          ids
            .map((id) => byId.get(id))
            .filter((v): v is NonNullable<typeof v> => !!v)
            .map((v) => [v.videoId, { durationSeconds: v.durationSeconds, isLiveOrUpcoming: false }]),
        ),
    }
  }
}

/**
 * 채널 최신 영상과 DB를 대조해 새 설교를 등록하는 폴링(스케줄 전용).
 * WebSub 푸시가 죽어 있는 동안 이것이 유일한 등록 경로다(2026-09-17).
 * 등록은 in-process로 직접 수행해 QStash 아웃바운드 장애와 독립적으로 동작하고,
 * 자막·요약은 기존 fetch-transcript 체인에 best-effort로 넘긴다.
 */
export async function reconcileSermons(): Promise<{ checked: number; inserted: number }> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID
  if (!channelId) throw new Error('YOUTUBE_CHANNEL_ID is not set')

  let listing: UploadListing
  try {
    listing = await listUploads(channelId)
  } catch (e) {
    // 주경로·폴백이 모두 죽은 회차. 다음 회차가 같은 누락분을 다시 잡는다.
    const reason = e instanceof Error ? e.message : String(e)
    console.error(`[reconcile] 업로드 목록 조회 실패 — 이번 회차를 건너뛴다: ${reason}`)
    await log('error', 'sermon', undefined, `[reconcile] 업로드 목록 조회 실패 — 이번 회차 건너뜀: ${reason}`)
    return { checked: 0, inserted: 0 }
  }

  const existing = await db.select({ id: sermons.youtubeVideoId }).from(sermons)
  const existingIds = new Set(existing.map((r) => r.id).filter((x): x is string => !!x))
  const missing = listing.candidates.filter((v) => !existingIds.has(v.videoId))
  if (missing.length === 0) return { checked: listing.candidates.length, inserted: 0 }

  const details = await listing.detailsFor(missing.map((v) => v.videoId))

  let inserted = 0
  for (const candidate of missing) {
    const detail = details.get(candidate.videoId)
    // 상세를 못 받았거나 방송 중·예약 공개다. 길이가 확정되지 않아 지금 등록하면 0초로 남는다.
    if (!detail || detail.isLiveOrUpcoming) continue

    const video = toYouTubeVideo(candidate, detail)
    const worshipType = classifyByTitle(video.title)
    let sermonId: string
    try {
      // 실패 사유는 insertSermon이 남긴다. 여기서는 한 건의 실패로 남은 누락분까지 놓치지 않게만 한다.
      sermonId = await insertSermon(video, worshipType, 'reconcile')
    } catch {
      continue
    }
    if (!sermonId) continue
    inserted++

    try {
      // ISR 무효화 실패가 밖으로 나가면 회차 전체가 죽어 남은 누락분이 시도조차 되지 않는다.
      revalidateSermonPaths(sermonId)
    } catch (e) {
      console.error(`[reconcile] ISR 무효화 실패 videoId=${video.videoId}`, e)
    }

    if (!expectsAutoSummary(worshipType)) continue
    try {
      await publishJob('fetch-transcript', { sermonId, videoId: video.videoId, attempt: 0 })
    } catch (e) {
      console.error(`[reconcile] fetch-transcript 발행 실패 videoId=${video.videoId}`, e)
      await log(
        'error',
        'sermon',
        sermonId,
        `[reconcile] fetch-transcript 발행 실패 — 자막·요약 미진행: videoId=${video.videoId}`,
      )
    }
  }
  return { checked: listing.candidates.length, inserted }
}
```

등록과 ISR 무효화를 별도 `try`로 나눈 것이 핵심이다. 무효화 실패는 이미 등록된 설교를 되돌리지 않으므로 `inserted`를 깎지 않고 삼키되, 밖으로 새어 회차를 죽이지도 않는다.

- [ ] **Step 4: 기존 로그 행을 없앤다**

`[reconcile] WebSub 알림 소실 감지 — 보정 등록됨(푸시 경로 점검 필요)` `log('error', …)` 호출과 그 위 `console.warn`을 지운다. 폴링이 주경로가 된 이상 정상 동작이고, `insertSermon`의 `create` 행과 중복된다. Step 3의 구현 코드에는 이미 빠져 있다.

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `npx vitest run src/lib/sermons/reconcile.test.ts && npm run typecheck`
Expected: 전부 PASS

- [ ] **Step 6: README의 거짓이 된 두 문장을 고친다**

설교 파이프라인 절의 `**폴링 없이 실시간으로**` 문장을 바꾼다.

```markdown
새 설교 영상이 YouTube에 올라오면 **예배 시간대 집중 폴링**으로 등록·자막화·요약까지 자동으로 진행됩니다. WebSub 푸시가 살아 있으면 업로드 즉시 같은 체인을 탑니다.
```

WebSub 항목의 `주기적 폴링이 없어 YouTube API 쿼터·함수 호출을 평소엔 0으로 유지합니다.` 한 문장을 바꾼다.

```markdown
푸시가 도착하면 업로드 순간에 바로 체인이 돌아 폴링 주기를 기다리지 않습니다. 다만 Google 허브가 2026-09-03부터 이 채널에 배달을 멈춰, 현재 등록을 실제로 수행하는 것은 폴링입니다.
```

- [ ] **Step 7: 커밋**

```bash
git add src/lib/sermons/reconcile.ts src/lib/sermons/reconcile.test.ts README.md
git commit -m "feat: 설교 감지를 YouTube Data API 폴링 주경로로 바꾼다"
```

---

### Task 5: `websub-renew` 실패를 warning으로

**Files:**
- Modify: `src/app/api/jobs/websub-renew/route.ts`
- Modify: `src/app/api/jobs/websub-renew/route.test.ts`

**Interfaces:**
- Consumes: Task 1의 `log('warning', …)`
- Produces: 없음

- [ ] **Step 1: 실패 케이스 테스트를 바꾼다**

`src/app/api/jobs/websub-renew/route.test.ts`의 첫 테스트를 이름까지 바꾼다. 테스트 이름이 "500을 돌려 QStash 재시도를 유도한다"로 의도를 못박고 있다.

```ts
  it('허브 재구독이 실패하면 warning을 남기고 200을 돌려 재시도를 끊는다', async () => {
    vi.stubEnv('YOUTUBE_CHANNEL_ID', 'UC_test')
    vi.stubEnv('WEBSUB_SECRET', 's')
    vi.mocked(subscribeToChannel).mockRejectedValueOnce(new Error('websub subscribe failed: 503 Transient error'))

    const res = await POST(req())

    expect(res.status).toBe(200)
    expect(log).toHaveBeenCalledWith(
      'warning',
      'sermon',
      undefined,
      expect.stringContaining('websub subscribe failed: 503'),
    )
  })
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/jobs/websub-renew/route.test.ts`
Expected: FAIL — `expected 500 to be 200`

- [ ] **Step 3: 라우트를 고친다**

`src/app/api/jobs/websub-renew/route.ts`의 `catch` 블록을 바꾼다. 주석도 함께 바꾼다 — 현재 주석은 500을 돌리는 이유를 설명하고 있어 거짓이 된다.

```ts
  } catch (e) {
    // 허브 장애는 우리가 고칠 수 없고, 설교 등록은 폴링이 책임진다(2026-09-17).
    // 500으로 재시도를 유도하면 같은 실패가 하루 4행 쌓일 뿐이라 200으로 끊는다.
    // 리스는 5일이고 갱신은 매일이라 연속 4회 실패까지 견딘다.
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[websub-renew] 허브 재구독 실패', e)
    await log('warning', 'sermon', undefined, `[websub-renew] 허브 재구독 실패: ${reason}`)
    return Response.json({ ok: false, error: 'subscribe failed' }, { status: 200 })
  }
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `npx vitest run src/app/api/jobs/websub-renew/route.test.ts && npm run typecheck`
Expected: 두 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/jobs/websub-renew/route.ts src/app/api/jobs/websub-renew/route.test.ts
git commit -m "fix: 허브 재구독 실패를 warning으로 내리고 재시도를 끊는다"
```

---

### Task 6: 폴링 스케줄과 폐기 경로

**Files:**
- Modify: `src/lib/qstash.ts`
- Create: `src/lib/qstash.test.ts`
- Modify: `scripts/qstash-schedules.ts`
- Modify: `README.md` (운영 절 스케줄 표)

**Interfaces:**
- Consumes: 없음
- Produces: `syncSchedules(desired: ManagedSchedule[]): Promise<{ upserted: string[]; deleted: string[] }>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/qstash.test.ts`를 만든다.

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

const create = vi.fn(async () => ({ scheduleId: 'x' }))
const list = vi.fn(async () => [] as { scheduleId: string }[])
const del = vi.fn(async () => undefined)

vi.mock('@upstash/qstash', () => ({
  Client: class {
    schedules = { create, list, delete: del }
  },
  Receiver: class {},
}))

import { syncSchedules } from './qstash'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('QSTASH_TOKEN', 't')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.ycjc.kr')
})

describe('syncSchedules', () => {
  it('원하는 스케줄을 등록하고 목록에서 사라진 ycc- 스케줄은 삭제한다', async () => {
    list.mockResolvedValue([
      { scheduleId: 'ycc-reconcile-sermons' },
      { scheduleId: 'ycc-obsolete' },
      { scheduleId: 'someone-elses' },
    ])

    const result = await syncSchedules([
      { job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-reconcile-sermons' },
    ])

    expect(create).toHaveBeenCalledWith({
      destination: 'https://www.ycjc.kr/api/jobs/reconcile-sermons',
      cron: '0 0 * * *',
      scheduleId: 'ycc-reconcile-sermons',
    })
    expect(del).toHaveBeenCalledTimes(1)
    expect(del).toHaveBeenCalledWith('ycc-obsolete')
    expect(result.deleted).toEqual(['ycc-obsolete'])
  })

  it('우리 접두사가 아닌 스케줄은 건드리지 않는다', async () => {
    list.mockResolvedValue([{ scheduleId: 'someone-elses' }])

    await syncSchedules([])

    expect(del).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/qstash.test.ts`
Expected: FAIL — `syncSchedules is not a function`

- [ ] **Step 3: `syncSchedules`를 구현한다**

`src/lib/qstash.ts`의 `upsertSchedule`을 대체한다. 접두사는 소유권 표시다 — 이 스크립트가 만들지 않은 스케줄을 지우면 안 된다.

```ts
/** 이 저장소가 소유하는 스케줄의 ID 접두사. 이 접두사가 아닌 것은 지우지 않는다. */
const MANAGED_PREFIX = 'ycc-'

export interface ManagedSchedule {
  job: JobName
  cron: string
  scheduleId: string
}

/**
 * ycc- 스케줄의 desired set을 QStash에 적용한다(멱등).
 *
 * create만 하면 스크립트에서 항목을 지우거나 ID를 바꿔도 QStash에는 옛 스케줄이 남아
 * 계속 실행된다 — 중복 폴링·중복 로그·쿼터 소모가 조용히 이어진다. 그래서 삭제까지 여기서 한다.
 */
export async function syncSchedules(
  desired: ManagedSchedule[],
): Promise<{ upserted: string[]; deleted: string[] }> {
  const c = client()
  for (const s of desired) {
    await c.schedules.create({
      destination: `${baseUrl()}/api/jobs/${s.job}`,
      cron: s.cron,
      scheduleId: s.scheduleId,
    })
  }

  const wanted = new Set(desired.map((s) => s.scheduleId))
  const deleted: string[] = []
  for (const s of await c.schedules.list()) {
    if (!s.scheduleId.startsWith(MANAGED_PREFIX) || wanted.has(s.scheduleId)) continue
    await c.schedules.delete(s.scheduleId)
    deleted.push(s.scheduleId)
  }
  return { upserted: desired.map((s) => s.scheduleId), deleted }
}
```

- [ ] **Step 4: 등록 스크립트를 바꾼다**

`scripts/qstash-schedules.ts`의 `main`과 상단 JSDoc을 바꾼다. 업로드 시각 분포의 근거는 설계 문서에 있으므로 여기서 숫자를 되풀이하지 않고 가리키기만 한다.

```ts
import { syncSchedules } from '../src/lib/qstash'
import { getCanonicalSiteOrigin } from '../src/lib/site-origin'

/**
 * QStash 정기 스케줄의 desired set을 적용한다(멱등). 목록에서 빠진 ycc- 스케줄은 삭제된다.
 * 대상 origin은 site-origin 기반 프로덕션 URL — 로컬 실행 시 NEXT_PUBLIC_SITE_URL을 반드시 앞에 붙인다.
 *
 * reconcile-sermons가 설교 등록의 주경로다. 주일·수요 예배 시간대에 매시간 돌리고 매일 1회로 받친다.
 * 시간대를 정한 근거(업로드 시각 분포)는 docs/specs/2026-09-17-sermon-detection-polling-design.md에 있다.
 * websub-renew는 부경로 유지용이다. 허브 리스가 5일이라 매일이면 연속 4회 실패까지 견딘다.
 */
async function main() {
  const { upserted, deleted } = await syncSchedules([
    { job: 'websub-renew', cron: '0 0 * * *', scheduleId: 'ycc-websub-renew' },
    { job: 'retry-summaries', cron: '0 * * * *', scheduleId: 'ycc-retry-summaries' },
    { job: 'reconcile-sermons', cron: '0 0 * * *', scheduleId: 'ycc-reconcile-sermons' },
    { job: 'reconcile-sermons', cron: '0 2-8 * * 0', scheduleId: 'ycc-reconcile-sermons-sun' },
    { job: 'reconcile-sermons', cron: '0 11-14 * * 3', scheduleId: 'ycc-reconcile-sermons-wed' },
    { job: 'analytics-rollup', cron: '10 15 * * *', scheduleId: 'ycc-analytics-rollup' },
  ])
  console.log(`QStash schedules → ${getCanonicalSiteOrigin()}`)
  console.log(`  적용: ${upserted.join(', ')}`)
  console.log(`  삭제: ${deleted.length ? deleted.join(', ') : '없음'}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 5: 테스트와 타입 검사**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS. `upsertSchedule`을 참조하는 곳이 남아 있으면 타입 오류로 드러난다.

- [ ] **Step 6: README 운영 절의 스케줄 표를 고친다**

`qstash:schedules`는 다음 4개 스케줄을... 문장과 그 표를 바꾼다.

```markdown
`qstash:schedules`는 다음 스케줄의 desired set을 적용합니다. 목록에서 빠진 `ycc-` 스케줄은 삭제됩니다.

| 스케줄                       | 주기                        | 역할                                           |
| ---------------------------- | --------------------------- | ---------------------------------------------- |
| `websub-renew`               | 매일                        | WebSub 구독 lease 갱신(부경로 유지용)          |
| `retry-summaries`            | 매시간                      | 오디오 변환 잔류 회수, 요약 미완료분 재시도    |
| `reconcile-sermons`          | 매일                        | 업로드 감지 안전망                             |
| `reconcile-sermons-sun`      | 주일 11~17시 KST 매시간     | 업로드 감지 주경로(주일 예배)                  |
| `reconcile-sermons-wed`      | 수요일 20~23시 KST 매시간   | 업로드 감지 주경로(수요 예배)                  |
| `analytics-rollup`           | 매일                        | 방문 로그 → 일일 통계(`daily_page_stats`) 집계 |
```

- [ ] **Step 7: 커밋**

```bash
git add src/lib/qstash.ts src/lib/qstash.test.ts scripts/qstash-schedules.ts README.md
git commit -m "feat: 폴링 스케줄을 예배 시간대에 집중시키고 폐기 경로를 만든다"
```

---

## 배포 후 확인

코드가 아니라 사람이 하는 절차다. 계획 완료 조건에 포함한다.

- [ ] Vercel 환경변수에 `YOUTUBE_API_KEY`가 있는지 확인한다(운영에는 등록돼 있으나 이 키를 쓰는 코드가 없어 아직 검증되지 않았다).
- [ ] 배포 후 `NEXT_PUBLIC_SITE_URL=https://www.ycjc.kr npm run qstash:schedules`를 실행한다(등록은 그대로 반영되고, 삭제만 기본 dry-run이다). **origin을 붙이지 않으면 `.env.local`의 `ycc-website.vercel.app`으로 스케줄 대상이 전부 바뀐다.**
- [ ] 출력의 "삭제 예정" 줄이 비어 있는지 본다. 비어 있지 않은데 예상 밖 ID가 있으면 멈추고 확인한다. 문제 없으면 같은 명령에 `-- --apply`를 붙여 다시 실행하고, "삭제" 줄이 방금 본 "삭제 예정" 목록과 일치하는지 확인한다.
- [ ] 2026-09-20(주일) 업로드가 폴링 창 안에서 잡히는지 확인한다. 기대: 감지 지연 59분 이내, 관리자 로그에 `create … — 폴링` 행. 비교 기준은 09-16 수요예배의 12시간 17분이다.
- [ ] 관리자 로그에 `[reconcile] Data API 조회 실패 — yt-api로 폴백` warning이 없는지 확인한다. 있으면 키가 서버에서 안 먹는 것이다(리퍼러 제한을 걸었을 가능성부터 본다).
- [ ] 계획이 끝나 base 브랜치로 병합할 때 이 문서를 `git rm` 한다.
