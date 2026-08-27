import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { makeTestDb, insertSermonFixture, type TestDb } from '@/test/pg'
import { sermonSummaries, sermonTranscripts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const h = vi.hoisted(() => ({ db: null as unknown as TestDb }))
vi.mock('@/lib/db', () => ({
  get db() {
    return h.db
  },
}))
vi.mock('@/lib/qstash', () => ({ publishJob: vi.fn(async () => undefined) }))
// fetchTranscript는 외부호출이므로 모킹 — buildTranscriptText 경유 결과만 검증
vi.mock('@/lib/transcript/rapidapi', () => ({
  fetchTranscript: vi.fn(async () => [{ text: 'hello', start: 0, dur: 1 }]),
}))
vi.mock('@/lib/ai/audio-transcript', () => ({
  transcribeFromAudio: vi.fn(async () => [{ startSeconds: 0, text: 'audio fallback text' }]),
}))
// generateSermonSummary는 Gemini 외부호출 — summarizeClaimed 위성 갱신만 검증
vi.mock('@/lib/ai/sermon-summary', async (orig) => ({
  ...(await orig<typeof import('@/lib/ai/sermon-summary')>()),
  generateSermonSummary: vi.fn(async () => ({
    summary: '요약본',
    quickSummary: ['a', 'b'],
    chapters: [],
  })),
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

// 모듈은 mock 설정 이후 import (동적 import로 보장)
const {
  claimSermonById,
  selectRetryTargets,
  fetchAndStoreTranscript,
  summarizeClaimed,
  publishSummarizeOrMarkFailed,
  requestSummaryRegeneration,
  MAX_TRANSCRIPT_RETRY,
} = await import('./summarize')

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

  it('does not touch audio transcription unless the caller opts in', async () => {
    const { fetchTranscript } = await import('@/lib/transcript/rapidapi')
    const { transcribeFromAudio } = await import('@/lib/ai/audio-transcript')
    vi.mocked(fetchTranscript).mockResolvedValueOnce([])
    vi.mocked(transcribeFromAudio).mockClear()
    const id = await insertSermonFixture(h.db)
    await expect(fetchAndStoreTranscript(id, 'vid-no-captions-default')).rejects.toThrow('자막 미준비')
    expect(transcribeFromAudio).not.toHaveBeenCalled()
  })

  it('falls back to audio transcription when RapidAPI returns no segments', async () => {
    const { fetchTranscript } = await import('@/lib/transcript/rapidapi')
    vi.mocked(fetchTranscript).mockResolvedValueOnce([])
    const id = await insertSermonFixture(h.db)
    const text = await fetchAndStoreTranscript(id, 'vid-no-captions', { audioFallback: { durationSeconds: 600 } })
    expect(text).toContain('audio fallback text')
  })

  it('throws when both RapidAPI and audio transcription come back empty', async () => {
    const { fetchTranscript } = await import('@/lib/transcript/rapidapi')
    const { transcribeFromAudio } = await import('@/lib/ai/audio-transcript')
    vi.mocked(fetchTranscript).mockResolvedValueOnce([])
    vi.mocked(transcribeFromAudio).mockResolvedValueOnce([])
    const id = await insertSermonFixture(h.db)
    await expect(
      fetchAndStoreTranscript(id, 'vid-no-captions-anywhere', { audioFallback: { durationSeconds: 600 } }),
    ).rejects.toThrow('자막 미준비')
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

describe('requestSummaryRegeneration (integration)', () => {
  it('publishes a summarize job when the transcript is already cached', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockClear()
    const id = await insertSermonFixture(h.db, { youtubeVideoId: 'vid1', transcriptText: '[00:00] hi' })

    await requestSummaryRegeneration(id)

    expect(publishJob).toHaveBeenCalledWith('summarize', { sermonId: id })
  })

  // attempt를 상한으로 채워 발행하면 fetch-transcript가 RapidAPI를 한 번만 보고 오디오 폴백으로 넘어간다.
  // 관리자가 누른 즉시 처리돼야 하므로 30분 간격 재시도 게이트를 태우지 않는다.
  it('publishes fetch-transcript at the retry cap when no transcript is cached', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockClear()
    const id = await insertSermonFixture(h.db, { youtubeVideoId: 'vid2' })

    await requestSummaryRegeneration(id)

    expect(publishJob).toHaveBeenCalledWith('fetch-transcript', {
      sermonId: id,
      videoId: 'vid2',
      attempt: MAX_TRANSCRIPT_RETRY,
    })
  })

  it('resets a terminal no_transcript row with spent attempts so the job can claim it', async () => {
    const id = await insertSermonFixture(h.db, {
      youtubeVideoId: 'vid3',
      summaryStatus: 'no_transcript',
      summaryAttempts: 3,
      summaryNextRetryAt: new Date('2099-01-01'),
    })

    await requestSummaryRegeneration(id)

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('none')
    expect(row.summaryAttempts).toBe(0)
    expect(row.summaryNextRetryAt).toBeNull()
    expect(await claimSermonById(id)).not.toBeNull()
  })

  it('throws when the sermon has no YouTube video id', async () => {
    const id = await insertSermonFixture(h.db)
    await expect(requestSummaryRegeneration(id)).rejects.toThrow()
  })
})
