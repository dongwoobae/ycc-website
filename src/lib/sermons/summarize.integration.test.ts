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
  MAX_AUDIO_TRANSCRIPT_RETRY,
  publishAudioTranscript,
  retryAudioTranscriptOrGiveUp,
  markAudioTranscriptInFlight,
  reclaimStaleAudioTranscripts,
  AUDIO_TRANSCRIPT_STALE_MS,
  MAX_SUMMARY_ATTEMPTS,
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

describe('retryAudioTranscriptOrGiveUp (integration)', () => {
  // 같은 영상이 한 판은 MAX_TOKENS로 잘리고 다음 판은 끝까지 가는 것을 실측으로 확인했다.
  // 모델 실패는 판마다 흔들리므로 한 번은 자동으로 다시 태운다.
  it('republishes the audio job with an incremented attempt while retries remain', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockClear()
    const id = await insertSermonFixture(h.db, { youtubeVideoId: 'vid-a' })

    const outcome = await retryAudioTranscriptOrGiveUp(id, 'vid-a', 0)

    expect(outcome).toBe('retry')
    expect(publishJob).toHaveBeenCalledWith(
      'fetch-audio-transcript',
      { sermonId: id, videoId: 'vid-a', attempt: 1 },
      0,
      expect.objectContaining({ retries: expect.any(Number) }),
    )
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).not.toBe('no_transcript')
  })

  it('marks the sermon no_transcript once the audio retries are spent', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockClear()
    const id = await insertSermonFixture(h.db, { youtubeVideoId: 'vid-b' })

    const outcome = await retryAudioTranscriptOrGiveUp(id, 'vid-b', MAX_AUDIO_TRANSCRIPT_RETRY)

    expect(outcome).toBe('gaveUp')
    expect(publishJob).not.toHaveBeenCalled()
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('no_transcript')
  })

  // 재발행이 실패하면 아무 job도 이어받지 않는다 — 그 자리에서 종결해 상태가 none에 매달리는 것을 막는다.
  it('marks the sermon no_transcript when republishing throws', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockRejectedValueOnce(new Error('qstash down'))
    const id = await insertSermonFixture(h.db, { youtubeVideoId: 'vid-c' })

    const outcome = await retryAudioTranscriptOrGiveUp(id, 'vid-c', 0)

    expect(outcome).toBe('gaveUp')
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('no_transcript')
  })
})

describe('publishAudioTranscript (integration)', () => {
  it('publishes with the retry and timeout options the audio job needs', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockClear()

    await publishAudioTranscript('sid', 'vid-d', 0)

    expect(publishJob).toHaveBeenCalledWith(
      'fetch-audio-transcript',
      { sermonId: 'sid', videoId: 'vid-d', attempt: 0 },
      0,
      { retries: 1, timeoutSeconds: 300 },
    )
  })
})

// 오디오 변환은 Vercel 함수 예산(300초)에 걸려 강제 종료될 수 있다. 그러면 라우트의
// catch가 실행되지 않아 어떤 종결 처리도 일어나지 않는다 — 진입 시 남긴 표시가
// 그 잔류를 스위퍼에게 보이게 하는 유일한 흔적이다.
describe('markAudioTranscriptInFlight (integration)', () => {
  it('marks the row pending with an expiry so a killed run leaves a trace', async () => {
    const id = await insertSermonFixture(h.db, { summaryStatus: 'none' })
    const now = new Date('2026-08-27T04:00:00Z')

    await markAudioTranscriptInFlight(id, now)

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('pending')
    expect(row.summaryNextRetryAt?.getTime()).toBe(now.getTime() + AUDIO_TRANSCRIPT_STALE_MS)
    expect(row.summaryAttempts).toBe(0)
  })
})

describe('publishSummarizeOrMarkFailed — 진행 표시 해제 (integration)', () => {
  // 표시를 남겨 두면 claimSermonById의 두 분기가 모두 막혀 summarize가 조용히 아무 일도 안 한다.
  it('clears the audio in-flight marker so summarize can claim the row', async () => {
    const id = await insertSermonFixture(h.db, { youtubeVideoId: 'vid-flight' })
    await markAudioTranscriptInFlight(id, new Date())

    await publishSummarizeOrMarkFailed(id, [{ startSeconds: 0, text: 'hi' }], 'vid-flight')

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('none')
    expect(row.summaryNextRetryAt).toBeNull()
    expect(await claimSermonById(id)).not.toBeNull()
  })

  // claimSermonById가 찍는 pending은 next_retry_at이 비어 있다 — 그쪽 선점은 건드리지 않는다.
  it('leaves a summarize claim (pending without expiry) untouched', async () => {
    const id = await insertSermonFixture(h.db, { summaryStatus: 'pending', youtubeVideoId: 'vid-claimed' })

    await publishSummarizeOrMarkFailed(id, [{ startSeconds: 0, text: 'hi' }], 'vid-claimed')

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('pending')
  })
})

describe('reclaimStaleAudioTranscripts (integration)', () => {
  const stale = (now: Date) => new Date(now.getTime() - 1000)

  it('republishes the audio job and consumes an attempt for an expired marker', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockClear()
    const now = new Date('2026-08-27T05:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryNextRetryAt: stale(now),
      youtubeVideoId: 'vid-stale',
    })

    const result = await reclaimStaleAudioTranscripts(10, now)

    expect(result.republished).toEqual([id])
    expect(publishJob).toHaveBeenCalledWith(
      'fetch-audio-transcript',
      { sermonId: id, videoId: 'vid-stale', attempt: 0 },
      0,
      expect.objectContaining({ retries: expect.any(Number) }),
    )
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryAttempts).toBe(1)
    expect(row.summaryNextRetryAt?.getTime()).toBe(now.getTime() + AUDIO_TRANSCRIPT_STALE_MS)
  })

  it('leaves a marker that has not expired alone', async () => {
    const now = new Date('2026-08-27T05:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryNextRetryAt: new Date(now.getTime() + 60_000),
      youtubeVideoId: 'vid-fresh',
    })

    const result = await reclaimStaleAudioTranscripts(10, now)

    expect(result.republished).not.toContain(id)
    expect(result.gaveUp).not.toContain(id)
  })

  it('leaves a summarize claim (pending without expiry) alone', async () => {
    const now = new Date('2026-08-27T05:00:00Z')
    const id = await insertSermonFixture(h.db, { summaryStatus: 'pending', youtubeVideoId: 'vid-summarizing' })

    const result = await reclaimStaleAudioTranscripts(10, now)

    expect(result.republished).not.toContain(id)
    expect(result.gaveUp).not.toContain(id)
  })

  // 자막이 이미 있으면 오디오 변환은 끝난 것이다 — 그 뒤는 요약 재시도 경로 소관이다.
  it('skips rows that already have a transcript', async () => {
    const now = new Date('2026-08-27T05:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryNextRetryAt: stale(now),
      transcriptText: 'already here',
      youtubeVideoId: 'vid-has-text',
    })

    const result = await reclaimStaleAudioTranscripts(10, now)

    expect(result.republished).not.toContain(id)
  })

  it('skips worship types that are not auto-summarized', async () => {
    const now = new Date('2026-08-27T05:00:00Z')
    const id = await insertSermonFixture(h.db, {
      worshipType: '시온찬양대',
      summaryStatus: 'pending',
      summaryNextRetryAt: stale(now),
      youtubeVideoId: 'vid-choir',
    })

    const result = await reclaimStaleAudioTranscripts(10, now)

    expect(result.republished).not.toContain(id)
  })

  // 강제 종료가 반복되면 회수 → 또 종료 → 또 회수로 끝없이 돈다. 횟수를 DB에 세야 끊긴다.
  it('gives up once the attempts are spent, clearing the marker', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockClear()
    const now = new Date('2026-08-27T05:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryNextRetryAt: stale(now),
      summaryAttempts: MAX_SUMMARY_ATTEMPTS,
      youtubeVideoId: 'vid-spent',
    })

    const result = await reclaimStaleAudioTranscripts(10, now)

    expect(result.gaveUp).toEqual([id])
    expect(publishJob).not.toHaveBeenCalled()
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('no_transcript')
    expect(row.summaryNextRetryAt).toBeNull()
  })
})
