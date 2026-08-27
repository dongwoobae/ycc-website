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
  forceClaimSermonById,
  AUDIO_TRANSCRIPT_STALE_MS,
  STALE_PENDING_MS,
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
  it('selects sermons that have a transcript but no summary yet, respecting the attempts cap', async () => {
    const failed = await insertSermonFixture(h.db, { summaryStatus: 'failed', transcriptText: 'abc' })
    // 자막을 저장한 직후 summarize 발행 전에 끊기면 none에 남는다 — 이것도 주울 잔류다.
    const stranded = await insertSermonFixture(h.db, { summaryStatus: 'none', transcriptText: 'abc' })
    const noTranscript = await insertSermonFixture(h.db, { summaryStatus: 'failed' })
    const capped = await insertSermonFixture(h.db, {
      summaryStatus: 'failed',
      transcriptText: 'abc',
      summaryAttempts: MAX_SUMMARY_ATTEMPTS,
    })

    const ids = (await selectRetryTargets(10)).map((t) => t.id)

    expect(ids).toContain(failed)
    expect(ids).toContain(stranded)
    expect(ids).not.toContain(noTranscript)
    expect(ids).not.toContain(capped)
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

  // 자막 저장 직후 표시를 풀기 전에 끊기면 pending·만료·자막 있음이 남는다. 오디오 변환은 이미
  // 끝났으므로 다시 태우지 않고, 표시만 풀어 요약 재시도 경로가 줍게 넘긴다.
  it('hands a stale row that already has a transcript over to the summary retry path', async () => {
    const { publishJob } = await import('@/lib/qstash')
    vi.mocked(publishJob).mockClear()
    const now = new Date('2026-08-27T05:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryNextRetryAt: stale(now),
      transcriptText: 'already here',
      youtubeVideoId: 'vid-has-text',
    })

    const result = await reclaimStaleAudioTranscripts(10, now)

    expect(result.handedOff).toEqual([id])
    expect(result.republished).not.toContain(id)
    expect(publishJob).not.toHaveBeenCalled()
    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('none')
    expect(row.summaryNextRetryAt).toBeNull()
    expect((await selectRetryTargets(10)).map((t) => t.id)).toContain(id)
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

// QStash가 오디오 job을 재전달하면 이미 요약이 끝난 설교 위에서 두 번째 판이 돈다.
// 공개 페이지는 ready일 때만 요약을 그리므로, 여기서 상태를 덮으면 공개된 요약이 사라진다.
describe('중복 전달 방어 (integration)', () => {
  it('markAudioTranscriptInFlight leaves a row that already has a transcript alone', async () => {
    const id = await insertSermonFixture(h.db, { summaryStatus: 'ready', transcriptText: 'done' })

    await markAudioTranscriptInFlight(id, new Date())

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('ready')
    expect(row.summaryNextRetryAt).toBeNull()
  })

  it('retryAudioTranscriptOrGiveUp does not bury a summary that already succeeded', async () => {
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'ready',
      transcriptText: 'done',
      youtubeVideoId: 'vid-dupe',
    })

    await retryAudioTranscriptOrGiveUp(id, 'vid-dupe', MAX_AUDIO_TRANSCRIPT_RETRY)

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryStatus).toBe('ready')
  })
})

describe('requestSummaryRegeneration — 이전 생성 시각 (integration)', () => {
  // summary_generated_at이 남아 있으면 claimSermonById의 stale pending 분기가
  // (summary_generated_at IS NULL을 요구해) 이 행을 회수 대상에서 빼 버린다.
  it('clears the previous generation timestamp so a dead worker can be reclaimed', async () => {
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'ready',
      summaryGeneratedAt: new Date('2026-08-01T00:00:00Z'),
      transcriptText: 'abc',
      youtubeVideoId: 'vid-regen',
    })

    await requestSummaryRegeneration(id)

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryGeneratedAt).toBeNull()
  })
})

// pending은 두 가지를 뜻한다 — summarize 워커의 선점(summary_claimed_at 있음)과 오디오 변환
// 진행 표시(summary_claimed_at 없음). 이 구분이 무너지면 서로의 선점을 가로챈다.
describe('summary_claimed_at 리스 (integration)', () => {
  const long_ago = (now: Date) => new Date(now.getTime() - STALE_PENDING_MS - 1000)

  it('records the claim time so a lease can expire', async () => {
    const now = new Date('2026-08-27T06:00:00Z')
    const id = await insertSermonFixture(h.db, { summaryStatus: 'none' })

    await claimSermonById(id, now)

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryClaimedAt?.getTime()).toBe(now.getTime())
  })

  // 재생성을 거친 행은 위성 행이 오래됐고 next_retry_at·generated_at이 비어 있다. created_at을
  // 기준으로 삼으면 갓 선점한 행을 죽은 워커로 오인해 중복 요약이 열린다.
  it('blocks a second claim on an old row whose lease is still fresh', async () => {
    const now = new Date('2026-08-27T06:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'none',
      createdAt: new Date('2026-08-01T00:00:00Z'),
    })

    expect(await claimSermonById(id, now)).not.toBeNull()
    expect(await claimSermonById(id, new Date(now.getTime() + 1000))).toBeNull()
  })

  // 요약이 실패하면 next_retry_at에 백오프가 남고, 재선점해도 지워지지 않는다. 그 값을
  // NULL로 요구하면 죽은 워커 회수 분기가 재시도 경로에서 통째로 꺼진다.
  it('reclaims an expired lease even when a backoff time is still recorded', async () => {
    const now = new Date('2026-08-27T06:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryClaimedAt: long_ago(now),
      summaryNextRetryAt: new Date(now.getTime() - 60_000),
    })

    expect(await claimSermonById(id, now)).not.toBeNull()
  })

  it('never claims an audio in-flight marker, expired or not', async () => {
    const now = new Date('2026-08-27T06:00:00Z')
    const fresh = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryNextRetryAt: new Date(now.getTime() + 60_000),
    })
    const expired = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryNextRetryAt: new Date(now.getTime() - 60_000),
    })

    expect(await claimSermonById(fresh, now)).toBeNull()
    expect(await claimSermonById(expired, now)).toBeNull()
  })

  it('forceClaimSermonById records the claim time too', async () => {
    const id = await insertSermonFixture(h.db, { summaryStatus: 'ready' })

    await forceClaimSermonById(id)

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryClaimedAt).not.toBeNull()
  })

  it('markAudioTranscriptInFlight clears a stale claim so the marker stays distinguishable', async () => {
    const now = new Date('2026-08-27T06:00:00Z')
    const id = await insertSermonFixture(h.db, { summaryStatus: 'failed', summaryClaimedAt: long_ago(now) })

    await markAudioTranscriptInFlight(id, now)

    const [row] = await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id))
    expect(row.summaryClaimedAt).toBeNull()
  })

  // 재선점된 행(pending + 지난 백오프)은 오디오 표시와 컬럼 값이 겹친다. claimed_at이 갈라 준다.
  it('reclaimStaleAudioTranscripts leaves a row that summarize is holding alone', async () => {
    const now = new Date('2026-08-27T06:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryClaimedAt: now,
      summaryNextRetryAt: new Date(now.getTime() - 60_000),
      transcriptText: 'being summarized',
      youtubeVideoId: 'vid-busy',
    })

    const result = await reclaimStaleAudioTranscripts(10, now)

    expect(result.republished).not.toContain(id)
    expect(result.gaveUp).not.toContain(id)
    expect(result.handedOff).not.toContain(id)
  })

  it('selectRetryTargets picks up a summarize claim whose lease expired', async () => {
    const now = new Date('2026-08-27T06:00:00Z')
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryClaimedAt: long_ago(now),
      transcriptText: 'abc',
    })

    const ids = (await selectRetryTargets(20, now)).map((t) => t.id)

    expect(ids).toContain(id)
  })
})
