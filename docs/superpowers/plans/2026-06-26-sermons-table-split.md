# sermons 테이블 생명주기별 분할 — 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비대한 `sermons` 테이블에서 자막/요약/썸네일 파생·파이프라인 데이터를 1:1 위성 테이블 3개로 분리해, AI 자동 파이프라인이 도메인 행을 쓰지 않게 한다.

**Architecture:** Expand/Contract 마이그레이션. (A) 위성 테이블 생성 + 백필, sermons 원본 컬럼은 유지 → (코드 전환) → (B) 별도 PR에서 sermons 원본 컬럼 DROP. 전환 기간에는 컬럼이 양쪽에 공존한다.

**Tech Stack:** Next.js, drizzle-orm(pg), Neon(Postgres), vitest, pnpm. 마이그레이션은 drizzle-kit `generate`→**수동 백필 SQL 추가**→`migrate`. `db:push` 사용 금지.

**테스트 전략:** 두 층으로 나눈다.
- **순수 단위(기존 목킹 유지)**: `toSermon` 매핑, `planSermonInserts`, 스키마 컬럼 존재 등 DB 불필요한 표면.
- **PGlite 통합(신규, 위험 쿼리 한정)**: 목킹으로 검증 불가능한 쿼리 — `claimSermonById` 원자성·행보장·stale 재클레임, `selectRetryTargets` 조인 필터, `fetchAndStoreTranscript` upsert, `summarizeClaimed` 위성 갱신 — 만 인프로세스 Postgres(`@electric-sql/pglite`)로 진짜 RED→GREEN 검증한다. drizzle에 pglite 드라이버가 번들돼 있어 Docker/네트워크 불필요(Windows OK).
- 나머지 일반 쿼리(목록/상세 조인 등)는 `pnpm build`(타입체크) + `pnpm lint` + 사용자의 수동 마이그레이션 적용으로 검증한다. 통합 테스트는 위험 쿼리에만 한정한다(전면 도입 안 함 — 비용 대비 효율).

**참조 spec:** `docs/superpowers/specs/2026-06-26-sermons-table-split-design.md`

---

## 파일 구조

- `src/lib/db/schema.ts` — 위성 테이블 3개(`sermonTranscripts`/`sermonSummaries`/`sermonThumbnails`) 추가, `$inferSelect` 타입 추가. (Phase A에서는 sermons 원본 컬럼 **유지**, Phase B에서 제거.)
- `src/lib/db/schema.test.ts` — 위성 컬럼 존재 검증 추가.
- `drizzle/<NNNN>_*.sql` — 마이그레이션 A(위성 생성 + 백필). 수동 백필 SQL 포함.
- `src/lib/data/sermons.ts` — 목록/상세 조인 쿼리, 컬럼셋, `SermonListRow` 타입.
- `src/lib/sermons/summarize.ts` — claim(CTE) / summarize / retry(조인) / transcript(upsert).
- `src/lib/thumbnails/store.ts`, `src/lib/actions/thumbnails.ts` — 썸네일 작업 컬럼 upsert, summary 조회 출처 변경.
- `src/lib/sermons/ingest.ts`, `src/lib/sermons/sync.ts`, `src/lib/seed/sermons.ts`, `scripts/seed*.ts` — 위성 기본 행 생성.
- `src/lib/data/admin-dashboard.ts`, `src/lib/actions/sermons.ts`, `scripts/summarize-sermons.ts` — summaryStatus 조회 출처 변경.

---

## Phase A — 스키마 + 마이그레이션(비파괴)

### Task 1: 위성 테이블 스키마 정의

**Files:**
- Modify: `src/lib/db/schema.ts`
- Test: `src/lib/db/schema.test.ts`

- [ ] **Step 1: 위성 컬럼 존재 검증 테스트 추가 (실패하는 테스트)**

`src/lib/db/schema.test.ts` 상단 import에 위성 테이블을 추가하고, describe 블록을 추가한다:

```ts
import { sermons, sermonTranscripts, sermonSummaries, sermonThumbnails } from './schema'

describe('sermon satellite tables', () => {
  it('sermon_summaries has summary + pipeline columns', () => {
    const cols = Object.keys(getTableColumns(sermonSummaries))
    for (const c of [
      'sermonId', 'summary', 'quickSummary', 'chapters',
      'summaryStatus', 'summaryAttempts', 'summaryNextRetryAt', 'summaryGeneratedAt', 'summaryModel', 'createdAt',
    ]) expect(cols).toContain(c)
  })
  it('sermon_transcripts has transcript columns', () => {
    const cols = Object.keys(getTableColumns(sermonTranscripts))
    for (const c of ['sermonId', 'transcriptText', 'transcriptFetchedAt']) expect(cols).toContain(c)
  })
  it('sermon_thumbnails has thumbnail working columns', () => {
    const cols = Object.keys(getTableColumns(sermonThumbnails))
    for (const c of ['sermonId', 'thumbnailCandidates', 'thumbnailBgKeywords', 'thumbnailBackgrounds']) expect(cols).toContain(c)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test src/lib/db/schema.test.ts`
Expected: FAIL — `sermonTranscripts`/`sermonSummaries`/`sermonThumbnails` export 없음.

- [ ] **Step 3: 위성 테이블 정의 추가**

`src/lib/db/schema.ts`의 `sermons` 정의 **직후**에 추가한다(`ThumbnailCandidate`/`ThumbnailStyle`/`SermonChapter`는 파일 상단에서 이미 import됨):

```ts
export const sermonTranscripts = pgTable('sermon_transcripts', {
  sermonId: uuid('sermon_id').primaryKey().references(() => sermons.id, { onDelete: 'cascade' }),
  transcriptText: text('transcript_text'),
  transcriptFetchedAt: timestamp('transcript_fetched_at', { withTimezone: true }),
})

export const sermonSummaries = pgTable('sermon_summaries', {
  sermonId: uuid('sermon_id').primaryKey().references(() => sermons.id, { onDelete: 'cascade' }),
  summary: text('summary'),
  quickSummary: jsonb('quick_summary').$type<string[]>(),
  chapters: jsonb('chapters').$type<SermonChapter[]>(),
  summaryStatus: text('summary_status').notNull().default('none'),
  summaryAttempts: integer('summary_attempts').notNull().default(0),
  summaryNextRetryAt: timestamp('summary_next_retry_at', { withTimezone: true }),
  summaryGeneratedAt: timestamp('summary_generated_at', { withTimezone: true }),
  summaryModel: text('summary_model'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [index('sermon_summaries_status_retry_idx').on(t.summaryStatus, t.summaryNextRetryAt)])

export const sermonThumbnails = pgTable('sermon_thumbnails', {
  sermonId: uuid('sermon_id').primaryKey().references(() => sermons.id, { onDelete: 'cascade' }),
  thumbnailCandidates: jsonb('thumbnail_candidates').$type<ThumbnailCandidate[]>(),
  thumbnailBgKeywords: text('thumbnail_bg_keywords'),
  thumbnailBackgrounds: jsonb('thumbnail_backgrounds').$type<Partial<Record<ThumbnailStyle, string>>>(),
})
```

파일 하단 타입 export 블록에 추가:

```ts
export type SermonTranscriptRow = typeof sermonTranscripts.$inferSelect
export type SermonSummaryRow = typeof sermonSummaries.$inferSelect
export type SermonThumbnailRow = typeof sermonThumbnails.$inferSelect
```

> 주의(Phase A): `sermons`의 기존 13개 컬럼은 **그대로 둔다**. 전환 기간 공존이 의도된 설계다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/db/schema.ts src/lib/db/schema.test.ts
git commit -m "feat: sermon 위성 테이블 3개(transcripts/summaries/thumbnails) 스키마 추가"
```

---

### Task 2: 마이그레이션 A 생성 + 수동 백필

**Files:**
- Create: `drizzle/<NNNN>_*.sql` (drizzle-kit이 생성)

- [ ] **Step 1: 마이그레이션 생성**

Run: `pnpm db:generate`
Expected: `drizzle/`에 새 `.sql` 파일 생성. 내용은 `CREATE TABLE sermon_transcripts/sermon_summaries/sermon_thumbnails` + FK + 인덱스 **뿐**(sermons 컬럼은 schema에 남아 있으므로 DROP 없음).

- [ ] **Step 2: 생성된 파일에 백필 SQL을 수동 추가**

생성된 마이그레이션 `.sql` 파일 **맨 끝**에 다음을 붙인다. `created_at`은 원본 `sermons.created_at`을 복사한다(spec 판단 3):

```sql
--> statement-breakpoint
INSERT INTO sermon_summaries
  (sermon_id, summary, quick_summary, chapters, summary_status, summary_attempts,
   summary_next_retry_at, summary_generated_at, summary_model, created_at)
SELECT id, summary, quick_summary, chapters, summary_status, summary_attempts,
       summary_next_retry_at, summary_generated_at, summary_model, created_at
FROM sermons
ON CONFLICT (sermon_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO sermon_transcripts (sermon_id, transcript_text, transcript_fetched_at)
SELECT id, transcript_text, transcript_fetched_at FROM sermons
ON CONFLICT (sermon_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO sermon_thumbnails (sermon_id, thumbnail_candidates, thumbnail_bg_keywords, thumbnail_backgrounds)
SELECT id, thumbnail_candidates, thumbnail_bg_keywords, thumbnail_backgrounds FROM sermons
ON CONFLICT (sermon_id) DO NOTHING;
```

> `created_at`은 `sermons` 백필분은 NOT NULL 보장(원본은 defaultNow로 채워져 있음). 혹시 NULL이면 `COALESCE(created_at, now())`로 감싼다.

- [ ] **Step 3: 마이그레이션 정합성 체크**

Run: `pnpm db:check`
Expected: 에러 없음(스냅샷/저널 정합).

- [ ] **Step 4: 커밋**

```bash
git add drizzle/
git commit -m "feat: 마이그레이션 A — 위성 테이블 생성 + 기존 데이터 백필(created_at 보존)"
```

> 실제 DB 적용(`pnpm db:migrate`)은 **사용자가** dev/branch Neon DB에서 수행해 확인한다(Phase A 종료 게이트). 비파괴이므로 롤백은 코드 되돌림만으로 가능.

---

### Task 2.5: PGlite 통합 테스트 하니스

**Files:**
- Create: `src/test/pg.ts` (테스트 DB 팩토리)
- Modify: `package.json` (devDependency)

- [ ] **Step 1: PGlite dev 의존성 설치**

Run: `pnpm add -D @electric-sql/pglite`
Expected: `package.json` devDependencies에 추가됨.

> drizzle pglite 드라이버/마이그레이터는 `drizzle-orm`에 이미 번들됨(추가 설치 불필요).

- [ ] **Step 2: 테스트 DB 팩토리 작성**

`src/test/pg.ts`:

```ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '@/lib/db/schema'

export type TestDb = ReturnType<typeof drizzle<typeof schema>>

/** 인프로세스 Postgres를 띄우고 drizzle/ 마이그레이션을 적용한 테스트 DB를 만든다. */
export async function makeTestDb(): Promise<{ db: TestDb; close: () => Promise<void> }> {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  return { db, close: () => client.close() }
}

/** sermons + (선택) sermon_summaries 기본 행을 만들고 sermon id를 반환한다. */
export async function insertSermonFixture(
  db: TestDb,
  opts: { withSummaryRow?: boolean; summaryStatus?: string; transcriptText?: string } = {}
): Promise<string> {
  const [s] = await db
    .insert(schema.sermons)
    .values({ title: 't', worshipType: '주일예배', sermonDate: '2026-01-01', isPublished: true })
    .returning({ id: schema.sermons.id })
  const id = s.id
  if (opts.withSummaryRow !== false) {
    await db.insert(schema.sermonSummaries).values({ sermonId: id, summaryStatus: opts.summaryStatus ?? 'none' })
  }
  if (opts.transcriptText !== undefined) {
    await db.insert(schema.sermonTranscripts).values({ sermonId: id, transcriptText: opts.transcriptText })
  }
  return id
}
```

> `migrate()`가 특정 마이그레이션에서 실패하면(예: pglite 미지원 구문), 해당 파일을 확인해 pglite 호환 형태로 우회하거나, 통합 테스트에 필요한 테이블만 별도 setup SQL로 적용한다. 우선 전체 `migrate()`를 시도한다.

- [ ] **Step 3: 하니스 자체 점검 테스트 (선택, 빠른 sanity)**

`src/test/pg.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { makeTestDb, insertSermonFixture } from './pg'

describe('test db harness', () => {
  it('boots pglite, applies migrations, inserts a sermon', async () => {
    const { db, close } = await makeTestDb()
    const id = await insertSermonFixture(db)
    expect(id).toMatch(/[0-9a-f-]{36}/)
    await close()
  })
})
```

Run: `pnpm test src/test/pg.test.ts`
Expected: PASS. (실패 시 Step 2의 우회 노트 적용.)

- [ ] **Step 4: 커밋**

```bash
git add src/test/pg.ts src/test/pg.test.ts package.json pnpm-lock.yaml
git commit -m "test: PGlite 인프로세스 Postgres 통합 테스트 하니스 추가"
```

---

## Phase B — 읽기 경로(데이터 계층) 전환

### Task 3: 목록/상세 조회를 sermon_summaries 조인으로

**Files:**
- Modify: `src/lib/data/sermons.ts`
- Test: `src/lib/data/sermons.test.ts` (기존 `toSermon` 테스트 — 그대로 통과해야 함)

- [ ] **Step 1: `SermonListRow`의 summaryStatus를 nullable로 (LEFT JOIN 반영)**

`src/lib/data/sermons.ts`의 `SermonListRow` 타입에서 `summaryStatus`를 join 결과에 맞춰 nullable 허용으로 바꾼다. `Pick<...>`에서 `summaryStatus`를 빼고 교차 타입에 명시 추가:

```ts
export type SermonListRow = Pick<
  SermonRow,
  | 'id' | 'title' | 'displayTitle' | 'preacher' | 'worshipType' | 'sermonDate'
  | 'videoUrl' | 'thumbnailUrl' | 'customThumbnailUrl' | 'isPublished'
  | 'youtubeVideoId' | 'durationSeconds'
> & {
  summary: SermonSummaryRow['summary']
  summaryStatus: SermonSummaryRow['summaryStatus'] | null
  quickSummary?: SermonSummaryRow['quickSummary']
  chapters?: SermonSummaryRow['chapters']
}
```

import에 타입 추가: `import { sermons as sermonsTable, sermonSummaries, type SermonRow, type SermonSummaryRow } from '@/lib/db/schema'`

> `toSermon` 본문 line 85는 이미 `row.summaryStatus ?? 'none'`로 null을 처리하므로 매핑 로직 변경 불필요.

- [ ] **Step 2: 컬럼셋의 summary 출처를 위성으로**

`sermonListColumns`에서 `summary`/`summaryStatus`를, `sermonColumns`에서 `quickSummary`/`chapters`를 `sermonSummaries.*`로 교체:

```ts
const sermonListColumns = {
  id: sermonsTable.id,
  title: sermonsTable.title,
  displayTitle: sermonsTable.displayTitle,
  preacher: sermonsTable.preacher,
  worshipType: sermonsTable.worshipType,
  sermonDate: sermonsTable.sermonDate,
  videoUrl: sermonsTable.videoUrl,
  thumbnailUrl: sermonsTable.thumbnailUrl,
  customThumbnailUrl: sermonsTable.customThumbnailUrl,
  summary: sermonSummaries.summary,
  isPublished: sermonsTable.isPublished,
  youtubeVideoId: sermonsTable.youtubeVideoId,
  durationSeconds: sermonsTable.durationSeconds,
  summaryStatus: sermonSummaries.summaryStatus,
}
const sermonColumns = {
  ...sermonListColumns,
  quickSummary: sermonSummaries.quickSummary,
  chapters: sermonSummaries.chapters,
}
```

- [ ] **Step 3: 각 조회 쿼리에 leftJoin 추가**

`getSermons`/`getSermonById`/`getSermonForAdmin`/`getSermonsByWorshipType`/`getLatestSermons`의 `.from(sermonsTable)` 뒤에 `.leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermonsTable.id))`를 추가한다. 예(`getSermons`):

```ts
export async function getSermons(): Promise<Sermon[]> {
  const rows = await db
    .select(sermonListColumns)
    .from(sermonsTable)
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermonsTable.id))
    .where(eq(sermonsTable.isPublished, true))
    .orderBy(desc(sermonsTable.sermonDate))
  return rows.map(toSermon)
}
```

나머지 4개 함수도 동일하게 `.leftJoin(...)`을 `.from()`과 `.where()` 사이에 삽입한다(where/orderBy/limit 조건은 그대로 유지).

- [ ] **Step 4: 단위 테스트 통과 확인 (toSermon 회귀)**

Run: `pnpm test src/lib/data/sermons.test.ts`
Expected: PASS (toSermon 입력 shape 불변 → 기존 4개 테스트 그대로 통과).

- [ ] **Step 5: 타입체크/린트**

Run: `pnpm build` 그리고 `pnpm lint`
Expected: 타입 에러·린트 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/data/sermons.ts
git commit -m "refactor: 설교 목록/상세 조회를 sermon_summaries LEFT JOIN으로 전환"
```

---

## Phase C — 파이프라인 쓰기 경로 전환

### Task 4: claim/summarize/retry/transcript를 위성 기준으로

**Files:**
- Modify: `src/lib/sermons/summarize.ts`
- Test: `src/lib/sermons/summarize.integration.test.ts` (신규, PGlite)

- [ ] **Step 1: 위험 쿼리 통합 테스트 작성 (RED)**

`src/lib/sermons/summarize.integration.test.ts`. `vi.hoisted` 홀더로 `@/lib/db`의 `db`를 pglite 인스턴스로 주입한다(함수들이 호출 시점에 `db`를 읽으므로 getter로 라이브 바인딩):

```ts
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { makeTestDb, insertSermonFixture, type TestDb } from '@/test/pg'
import { sermonSummaries, sermonTranscripts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const h = vi.hoisted(() => ({ db: null as unknown as TestDb }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))

let close: () => Promise<void>
beforeAll(async () => { const t = await makeTestDb(); h.db = t.db; close = t.close })
afterAll(async () => { await close() })

// 모듈은 mock 설정 이후 import (동적 import로 보장)
const { claimSermonById, selectRetryTargets, fetchAndStoreTranscript, summarizeClaimed } =
  await import('./summarize')

describe('claimSermonById (integration)', () => {
  it('claims a none-status sermon by updating sermon_summaries, then blocks double-claim', async () => {
    const id = await insertSermonFixture(h.db, { summaryStatus: 'none' })
    const first = await claimSermonById(id)
    expect(first?.id).toBe(id)
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('pending')
    expect(row.summaryAttempts).toBe(1)
    const second = await claimSermonById(id) // non-stale pending → 재클레임 불가
    expect(second).toBeNull()
  })

  it('defensively creates a missing summary row, then claims', async () => {
    const id = await insertSermonFixture(h.db, { withSummaryRow: false }) // 위성 행 없음
    const claimed = await claimSermonById(id)
    expect(claimed?.id).toBe(id)
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('pending')
  })
})

describe('selectRetryTargets (integration)', () => {
  it('selects failed sermons that have a transcript, respecting attempts cap', async () => {
    const ok = await insertSermonFixture(h.db, { summaryStatus: 'failed', transcriptText: 'abc' })
    await insertSermonFixture(h.db, { summaryStatus: 'failed' }) // 자막 없음 → 제외
    const targets = await selectRetryTargets(10)
    expect(targets.map((t) => t.id)).toEqual([ok])
  })
})

describe('fetchAndStoreTranscript upsert (integration)', () => {
  it('inserts then updates the same transcript row', async () => {
    const id = await insertSermonFixture(h.db)
    // fetchTranscript는 외부호출이므로 모킹 — buildTranscriptText 경유 결과만 검증
    vi.mock('@/lib/transcript/rapidapi', () => ({ fetchTranscript: vi.fn(async () => [{ text: 'hello', start: 0, dur: 1 }]) }))
    await fetchAndStoreTranscript(id, 'vid1')
    const [row] = await h.db.select().from(sermonTranscripts).where(eq(sermonTranscripts.sermonId, id))
    expect(row.transcriptText).toContain('hello')
  })
})
```

> 위 `summarizeClaimed`는 Gemini 외부호출을 포함하므로 통합 테스트에선 `generateSermonSummary`를 모킹해 위성 갱신(`summary_status='ready'`)만 확인하는 케이스를 추가한다(선택). 외부 모킹이 번거로우면 claim/retry/upsert 3종만으로도 핵심 위험은 커버된다.

- [ ] **Step 2: 통합 테스트 실패 확인 (RED)**

Run: `pnpm test src/lib/sermons/summarize.integration.test.ts`
Expected: FAIL — 현재 `claimSermonById`는 `sermons`를 UPDATE하므로 `sermon_summaries.summaryStatus`가 'pending'으로 바뀌지 않고, retry/transcript도 위성을 보지 않아 단언 실패.

- [ ] **Step 3: import에 위성 테이블 추가**

```ts
import { sermons, sermonSummaries, sermonTranscripts } from '@/lib/db/schema'
```

- [ ] **Step 4: `selectRetryTargets`를 조인 쿼리로**

상태/시도/백오프는 `sermonSummaries`, 자막은 `sermonTranscripts`, 예배유형은 `sermons`에서 가져온다:

```ts
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
```

- [ ] **Step 5: `claimSermonById`를 행 보장 + CTE로**

```ts
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
      RETURNING sermon_id
    )
    SELECT s.id, s.duration_seconds AS "durationSeconds", t.transcript_text AS "transcriptText"
    FROM claimed c
    JOIN sermons s ON s.id = c.sermon_id
    LEFT JOIN sermon_transcripts t ON t.sermon_id = c.sermon_id
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as ClaimedSermon | undefined) ?? null
}
```

- [ ] **Step 6: `forceClaimSermonById`도 동일 패턴으로**

```ts
export async function forceClaimSermonById(id: string): Promise<ClaimedSermon | null> {
  await db.execute(sql`INSERT INTO sermon_summaries (sermon_id) VALUES (${id}) ON CONFLICT (sermon_id) DO NOTHING`)
  const result = await db.execute(sql`
    WITH claimed AS (
      UPDATE sermon_summaries SET
        summary_status = 'pending',
        summary_attempts = summary_attempts + 1,
        summary_next_retry_at = NULL
      WHERE sermon_id = ${id}
      RETURNING sermon_id
    )
    SELECT s.id, s.duration_seconds AS "durationSeconds", t.transcript_text AS "transcriptText"
    FROM claimed c
    JOIN sermons s ON s.id = c.sermon_id
    LEFT JOIN sermon_transcripts t ON t.sermon_id = c.sermon_id
  `)
  const rows = Array.isArray(result) ? result : result.rows
  return (rows[0] as ClaimedSermon | undefined) ?? null
}
```

- [ ] **Step 7: `fetchAndStoreTranscript`를 upsert로**

```ts
export async function fetchAndStoreTranscript(sermonId: string, videoId: string): Promise<string> {
  const segments = await fetchTranscript(videoId)
  if (segments.length === 0) throw new Error('자막 미준비')
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
```

- [ ] **Step 8: `summarizeClaimed` set 대상을 sermon_summaries로**

두 `db.update(sermons)` 호출을 `db.update(sermonSummaries)`로 바꾸고 `.where(eq(sermonSummaries.sermonId, id))`로 변경(set 필드명은 동일):

```ts
await db.update(sermonSummaries).set({
  summary: result.summary, quickSummary: result.quickSummary, chapters: result.chapters,
  summaryStatus: 'ready', summaryGeneratedAt: new Date(), summaryNextRetryAt: null, summaryModel: model,
}).where(eq(sermonSummaries.sermonId, id))
// catch 블록:
await db.update(sermonSummaries).set({
  summaryStatus: 'failed', summaryNextRetryAt: computeNextRetry(MAX_SUMMARY_ATTEMPTS, new Date()),
}).where(eq(sermonSummaries.sermonId, id))
```

- [ ] **Step 9: `manualSummarize`의 transcript 조회를 위성에서**

`sermons` select에서 `transcriptText`를 빼고 `sermonTranscripts` leftJoin으로 가져온다:

```ts
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
```

(이후 로직은 그대로.)

- [ ] **Step 10: 통합 테스트 통과 확인 (GREEN)**

Run: `pnpm test src/lib/sermons/summarize.integration.test.ts`
Expected: PASS — claim이 `sermon_summaries`를 'pending'으로 갱신, 행 부재 시 방어적 생성, retry 조인 필터, transcript upsert 모두 통과.

- [ ] **Step 11: 타입체크/린트**

Run: `pnpm build` 그리고 `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 12: 커밋**

```bash
git add src/lib/sermons/summarize.ts src/lib/sermons/summarize.integration.test.ts
git commit -m "refactor: 요약 파이프라인(claim/summarize/retry/transcript)을 위성 테이블 기준으로 전환 + PGlite 통합 테스트"
```

---

## Phase D — 썸네일 경로 전환

### Task 5: 썸네일 store/actions를 sermon_thumbnails/sermon_summaries 기준으로

**Files:**
- Modify: `src/lib/thumbnails/store.ts`, `src/lib/actions/thumbnails.ts`

- [ ] **Step 1: `store.ts` import + upsert 전환**

import를 `import { sermons, sermonThumbnails } from '@/lib/db/schema'`로 바꾸고, `storeBackground`/`storeCandidate`의 `db.update(sermons)`를 `sermonThumbnails` upsert로 교체.

`storeBackground`:
```ts
const updated = await db
  .insert(sermonThumbnails)
  .values({ sermonId, thumbnailBackgrounds: { [style]: url } })
  .onConflictDoUpdate({
    target: sermonThumbnails.sermonId,
    set: {
      thumbnailBackgrounds: sql`coalesce(${sermonThumbnails.thumbnailBackgrounds}, '{}'::jsonb) || ${JSON.stringify({ [style]: url })}::jsonb`,
    },
  })
  .returning({ id: sermonThumbnails.sermonId })
if (updated.length === 0) throw new Error('sermon not found')
return url
```

`storeCandidate`:
```ts
const updated = await db
  .insert(sermonThumbnails)
  .values({ sermonId, thumbnailCandidates: [candidate] })
  .onConflictDoUpdate({
    target: sermonThumbnails.sermonId,
    set: {
      thumbnailCandidates: sql`coalesce(${sermonThumbnails.thumbnailCandidates}, '[]'::jsonb) || ${JSON.stringify([candidate])}::jsonb`,
    },
  })
  .returning({ id: sermonThumbnails.sermonId })
if (updated.length === 0) throw new Error('sermon not found')
return candidate
```

> upsert이므로 위성 행이 없어도 안전. `sermons` import는 더 이상 안 쓰면 제거.

- [ ] **Step 2: `actions/thumbnails.ts` — summary/keywords 조회 출처 변경**

import에 `sermonSummaries, sermonThumbnails` 추가. `suggestThumbnailTextAction`의 select에서 `summary`/`quickSummary`를 `sermonSummaries`에서 leftJoin으로 가져온다:

```ts
const [row] = await db
  .select({
    title: sermons.title,
    displayTitle: sermons.displayTitle,
    summary: sermonSummaries.summary,
    quickSummary: sermonSummaries.quickSummary,
  })
  .from(sermons)
  .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
  .where(eq(sermons.id, id))
  .limit(1)
```

- [ ] **Step 3: `resolveBgKeywords` — bgKeywords는 thumbnails, summary는 summaries**

```ts
async function resolveBgKeywords(id: string): Promise<string> {
  const [row] = await db
    .select({
      bgKeywords: sermonThumbnails.thumbnailBgKeywords,
      summary: sermonSummaries.summary,
      quickSummary: sermonSummaries.quickSummary,
    })
    .from(sermons)
    .leftJoin(sermonThumbnails, eq(sermonThumbnails.sermonId, sermons.id))
    .leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  if (row.bgKeywords?.trim()) return row.bgKeywords

  const keywords = await geminiBgKeywords({ summary: row.summary, quickSummary: row.quickSummary })
  await db
    .insert(sermonThumbnails)
    .values({ sermonId: id, thumbnailBgKeywords: keywords })
    .onConflictDoUpdate({ target: sermonThumbnails.sermonId, set: { thumbnailBgKeywords: keywords } })
  return keywords
}
```

- [ ] **Step 4: `composeAndApplyThumbnailAction` — backgrounds 조회 출처 변경**

`backgrounds` select를 `sermonThumbnails`에서 가져오도록 변경(이후 로직 동일). `customThumbnailUrl` 적용은 **그대로 `db.update(sermons)`** 유지(표시용 최종값):

```ts
const [row] = await db
  .select({ backgrounds: sermonThumbnails.thumbnailBackgrounds })
  .from(sermonThumbnails)
  .where(eq(sermonThumbnails.sermonId, id))
  .limit(1)
if (!row) throw new Error('sermon not found')
```

> `resetThumbnailAction`은 `customThumbnailUrl`만 건드리므로 `sermons` 그대로 유지(변경 없음).

- [ ] **Step 5: 기존 썸네일 테스트 통과 확인**

Run: `pnpm test src/lib/actions/thumbnails.test.ts`
Expected: PASS (또는 DB 목 의존이면 변경 영향 없는지 확인 후 필요한 목 경로만 갱신).

- [ ] **Step 6: 타입체크/린트**

Run: `pnpm build` 그리고 `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/thumbnails/store.ts src/lib/actions/thumbnails.ts
git commit -m "refactor: 썸네일 작업 데이터를 sermon_thumbnails로, summary 조회를 sermon_summaries로 전환"
```

---

## Phase E — 생성 경로 + 잔여 조회 지점

### Task 6: 설교 생성 시 위성 기본 행 함께 생성

**Files:**
- Modify: `src/lib/sermons/ingest.ts`, `src/lib/seed/sermons.ts`, `scripts/seed-from-rapidapi.ts`

- [ ] **Step 1: `insertSermon`에서 위성 기본 행 INSERT**

`src/lib/sermons/ingest.ts`의 import에 위성 테이블 추가하고, 신규 삽입(`row?.id` 존재) 시 3개 위성 기본 행을 만든다. `summaryStatus: 'none'`은 이제 `sermonSummaries` 기본값이 처리하므로 sermons insert의 `summaryStatus: 'none'`은 **남겨둔다(Phase A 공존)** — Phase F에서 제거:

```ts
import { sermons, sermonSummaries, sermonTranscripts, sermonThumbnails } from '@/lib/db/schema'
// ... insert 후:
const id = row?.id ?? ''
if (id) {
  await db.insert(sermonSummaries).values({ sermonId: id }).onConflictDoNothing()
  await db.insert(sermonTranscripts).values({ sermonId: id }).onConflictDoNothing()
  await db.insert(sermonThumbnails).values({ sermonId: id }).onConflictDoNothing()
}
return id
```

- [ ] **Step 2: seed 경로에도 동일 적용**

`src/lib/seed/sermons.ts`와 `scripts/seed-from-rapidapi.ts`에서 설교 INSERT 직후, 생성된 각 sermon id에 대해 동일하게 3개 위성 기본 행을 `onConflictDoNothing()`으로 만든다. (해당 파일의 기존 삽입 루프/배열 구조를 따라 id를 수집해 일괄 insert해도 무방.)

> seed가 요약/자막/썸네일 값을 직접 채우던 부분이 있으면, 그 값을 sermons가 아니라 해당 위성 행에 넣도록 옮긴다. (Phase A 공존 기간엔 sermons에 넣어도 백필로 흡수되지만, 신규 코드는 위성을 SoT로 쓴다.)

- [ ] **Step 3: 타입체크/린트 + 기존 sync 테스트**

Run: `pnpm test src/lib/sermons/sync.test.ts` 그리고 `pnpm build` 그리고 `pnpm lint`
Expected: 모두 PASS/에러 없음 (`planSermonInserts`는 순수 함수라 불변).

- [ ] **Step 4: 커밋**

```bash
git add src/lib/sermons/ingest.ts src/lib/seed/sermons.ts scripts/seed-from-rapidapi.ts
git commit -m "feat: 설교 생성 경로에서 위성 기본 행 함께 생성"
```

---

### Task 7: admin-dashboard / actions/sermons / summarize 스크립트 조회 전환

**Files:**
- Modify: `src/lib/data/admin-dashboard.ts`, `src/lib/actions/sermons.ts`, `scripts/summarize-sermons.ts`

- [ ] **Step 1: `admin-dashboard.ts` — summaryStatus 집계를 sermon_summaries로**

import에 `sermonSummaries` 추가. `summaryRows` 집계(`groupBy(sermons.summaryStatus)`)를 `sermonSummaries.summaryStatus` 기준으로 바꾼다. 단순 상태 카운트는 `sermons` 없이 `sermon_summaries`만으로 충분:

```ts
.select({ status: sermonSummaries.summaryStatus, c: count() })
.from(sermonSummaries)
.groupBy(sermonSummaries.summaryStatus)
```

`summaryFailed` 알림이 `autoSummaryWhere`(worshipType, sermons 컬럼)와 함께 쓰이는 쿼리는 `sermons innerJoin sermonSummaries`로 바꾸고 `where`를 `eq(sermonSummaries.summaryStatus, 'failed')` + 기존 autoSummary 조건으로 구성한다. (해당 쿼리의 기존 `and(eq(sermons.summaryStatus,'failed'), autoSummaryWhere)`를 조인+위성 컬럼으로 치환.)

- [ ] **Step 2: `actions/sermons.ts` line 42 — summaryStatus 출처 변경**

해당 select가 `sermons.summaryStatus`를 읽는 부분을 `sermonSummaries.summaryStatus`로 바꾸고 `leftJoin(sermonSummaries, eq(sermonSummaries.sermonId, sermons.id))`를 추가한다. (이 함수가 반환/사용하는 status 매핑은 null 시 'none' 기본 처리 확인.)

- [ ] **Step 3: `scripts/summarize-sermons.ts` — 위성 기준 동작 확인**

이 스크립트가 `summarize.ts`의 export(claim/summarize/select)만 호출한다면 Task 4 전환으로 자동 반영된다. `sermons.summaryStatus`/`transcriptText`를 **직접** 쿼리하는 부분이 있으면 위성 조인으로 바꾼다.

- [ ] **Step 4: 타입체크/린트**

Run: `pnpm build` 그리고 `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 5: 전체 테스트**

Run: `pnpm test`
Expected: 전체 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/data/admin-dashboard.ts src/lib/actions/sermons.ts scripts/summarize-sermons.ts
git commit -m "refactor: 대시보드/관리액션/배치스크립트의 summaryStatus 조회를 sermon_summaries로 전환"
```

---

### Task 8: Phase B~E 통합 검증 (사용자 게이트)

- [ ] **Step 1: 전체 빌드/린트/테스트**

Run: `pnpm test && pnpm build && pnpm lint`
Expected: 전부 통과.

- [ ] **Step 2: 잔여 직접 참조 스캔**

`sermons` 테이블에서 이관 대상 컬럼을 **직접 읽거나 쓰는** 지점이 남았는지 확인한다(아래는 grep 후보, 결과를 사람이 검토):
- `sermons.summary` / `summaryStatus` / `summaryAttempts` / `quickSummary` / `chapters` / `transcriptText` / `thumbnailCandidates` / `thumbnailBackgrounds` / `thumbnailBgKeywords`
- 남은 지점이 의도된 공존(Phase F에서 정리)인지, 누락 전환인지 분류.

- [ ] **Step 3: 사용자 수동 검증 게이트**

사용자가 dev/branch Neon DB에 마이그레이션 A 적용 후, 관리자 요약/자막/썸네일 생성·공개 목록/상세 표시가 정상인지 확인. **여기까지가 안정화 게이트.** 통과해야 Phase F 진행.

---

## Phase F — 원본 컬럼 DROP (별도 PR, 안정화 후)

> 이 Phase는 **배포·안정화 확인 후 별도 PR**로 진행한다. spec의 "마이그레이션 B".

### Task 9: sermons 원본 컬럼 제거 + 멱등 재백필

**Files:**
- Modify: `src/lib/db/schema.ts`, `src/lib/db/schema.test.ts`, `src/lib/sermons/ingest.ts`(잔여 `summaryStatus:'none'` 제거)
- Create: `drizzle/<NNNN>_*.sql` (DROP)

- [ ] **Step 1: schema.test에 "sermons에서 제거됨" 검증 추가(실패 테스트)**

`src/lib/db/schema.test.ts`에 추가:

```ts
it('sermons no longer holds moved columns', () => {
  const cols = Object.keys(getTableColumns(sermons))
  for (const c of [
    'summary', 'quickSummary', 'chapters', 'summaryStatus', 'summaryAttempts',
    'summaryNextRetryAt', 'summaryGeneratedAt', 'summaryModel',
    'transcriptText', 'transcriptFetchedAt',
    'thumbnailCandidates', 'thumbnailBgKeywords', 'thumbnailBackgrounds',
  ]) expect(cols).not.toContain(c)
})
```

기존 `'has the youtube/summary columns'` 테스트에서 위성으로 옮겨간 컬럼(quickSummary/chapters/summary*)은 sermons 대상 검증에서 제거하고, `youtubeVideoId`/`durationSeconds`만 남긴다.

Run: `pnpm test src/lib/db/schema.test.ts` → Expected: FAIL.

- [ ] **Step 2: schema.ts에서 sermons의 13개 컬럼 제거**

`src/lib/db/schema.ts`의 `sermons` 정의에서 `thumbnailCandidates`, `thumbnailBgKeywords`, `thumbnailBackgrounds`, `summary`, `transcriptText`, `transcriptFetchedAt`, `quickSummary`, `chapters`, `summaryStatus`, `summaryAttempts`, `summaryNextRetryAt`, `summaryGeneratedAt`, `summaryModel` 줄을 삭제한다. (`thumbnailUrl`, `customThumbnailUrl`, `youtubeVideoId`, `durationSeconds`는 유지.)

`ingest.ts`의 sermons insert에서 `summaryStatus: 'none'` 줄을 제거한다.

Run: `pnpm test src/lib/db/schema.test.ts` → Expected: PASS.

- [ ] **Step 3: 마이그레이션 생성 + 멱등 재백필 선행**

Run: `pnpm db:generate` → sermons DROP COLUMN 마이그레이션 생성됨.

생성된 `.sql`의 **DROP 문들 앞**에 Task 2와 동일한 3개 `INSERT ... ON CONFLICT DO NOTHING` 백필을 다시 넣어, A 이후 구버전이 sermons에 쓴 누락분을 위성으로 흡수한 뒤 DROP되게 한다. (멱등: 이미 있는 위성 행은 DO NOTHING이라 덮어쓰지 않음. 누락분만 채움.)

> 더 엄밀히 갱신까지 원하면 `ON CONFLICT (sermon_id) DO UPDATE SET ... WHERE sermon_summaries.summary IS NULL` 형태로 "위성이 빈 경우만" 갱신한다.

Run: `pnpm db:check` → Expected: 정합.

- [ ] **Step 4: 타입체크/린트/테스트**

Run: `pnpm test && pnpm build && pnpm lint`
Expected: 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/db/schema.ts src/lib/db/schema.test.ts src/lib/sermons/ingest.ts drizzle/
git commit -m "feat: 마이그레이션 B — sermons 원본 13개 컬럼 DROP(멱등 재백필 선행)"
```

> DROP 적용(`pnpm db:migrate`)은 사용자가 안정화 확인 후 수행. 이 시점부터 위성이 단일 SoT.

---

## Self-Review (작성자 점검)

- **Spec 커버리지**: 위성 3테이블(Task1), 백필+created_at 보존(Task2), 읽기 조인(Task3), claim CTE+행보장(Task4), 자막 upsert(Task4-5), 요약 set 전환(Task4-6), 썸네일 전환(Task5), 인덱스(Task1 `sermon_summaries_status_retry_idx`), 생성경로 위성행(Task6), 누락지점 admin-dashboard/actions-sermons/summarize-script(Task7), 전환창 멱등 재백필(Task9-3), DROP(Task9) — spec 항목 모두 매핑됨.
- **결합도 한계(spec #6)**: 워크플로 결합은 범위 밖 — 플랜도 읽기 조인만 하고 워크플로 통합은 안 건드림(일관).
- **타입 일관성**: `SermonSummaryRow`/`SermonTranscriptRow`/`SermonThumbnailRow`(Task1) → Task3에서 `SermonListRow`에 사용. `sermonSummaries.sermonId`/`sermonThumbnails.sermonId` join 키 명칭 전 Task 일관.
- **테스트 두 층**: 순수 표면은 목 단위 테스트(Task1, toSermon/planSermonInserts 회귀). 목킹 불가 위험 쿼리(claim 원자성·행보장·stale 재클레임·retry 조인·transcript upsert)는 PGlite 통합 테스트로 진짜 RED→GREEN(Task2.5 하니스 + Task4). 일반 조인 쿼리는 build+lint+수동 마이그레이션. 통합은 위험 쿼리 한정(전면 도입 안 함).
- **공존 주의**: Phase A~E는 sermons 컬럼 잔류 상태로 동작(expand), Phase F에서 contract. `ingest.ts`의 `summaryStatus:'none'`은 F에서 제거하도록 명시.
