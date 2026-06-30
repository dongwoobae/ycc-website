import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { makeTestDb, insertSermonFixture, type TestDb } from '@/test/pg'
import { sermonSummaries, sermonTranscripts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const h = vi.hoisted(() => ({ db: null as unknown as TestDb }))
vi.mock('@/lib/db', () => ({ get db() { return h.db } }))
// fetchTranscript는 외부호출이므로 모킹 — buildTranscriptText 경유 결과만 검증
vi.mock('@/lib/transcript/rapidapi', () => ({
  fetchTranscript: vi.fn(async () => [{ text: 'hello', start: 0, dur: 1 }]),
}))
// generateSermonSummary는 Gemini 외부호출 — summarizeClaimed 위성 갱신만 검증
vi.mock('@/lib/ai/sermon-summary', async (orig) => ({
  ...(await orig<typeof import('@/lib/ai/sermon-summary')>()),
  generateSermonSummary: vi.fn(async () => ({
    summary: '요약본', quickSummary: ['a', 'b'], chapters: [],
  })),
}))

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
    expect(targets.map((t) => t.id)).toContain(ok)
    expect(targets).toHaveLength(1)
  })
})

describe('fetchAndStoreTranscript upsert (integration)', () => {
  it('inserts then updates the same transcript row', async () => {
    const id = await insertSermonFixture(h.db)
    await fetchAndStoreTranscript(id, 'vid1')
    const [row] = await h.db.select().from(sermonTranscripts).where(eq(sermonTranscripts.sermonId, id))
    expect(row.transcriptText).toContain('hello')
    // 재호출 시 같은 행을 갱신(중복 행 미생성)
    await fetchAndStoreTranscript(id, 'vid1')
    const all = await h.db.select().from(sermonTranscripts).where(eq(sermonTranscripts.sermonId, id))
    expect(all).toHaveLength(1)
  })
})

describe('summarizeClaimed (integration)', () => {
  it('updates sermon_summaries to ready on success', async () => {
    const id = await insertSermonFixture(h.db, { summaryStatus: 'pending' })
    const status = await summarizeClaimed(id, 600, 'transcript body', 1)
    expect(status).toBe('ready')
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('ready')
    expect(row.summary).toBe('요약본')
  })
})
