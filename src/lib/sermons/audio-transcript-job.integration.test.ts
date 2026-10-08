import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { makeTestDb, insertSermonFixture, type TestDb } from '@/test/pg'
import { appLogs, sermonSummaries, sermonTranscripts } from '@/lib/db/schema'

const h = vi.hoisted(() => ({ db: null as unknown as TestDb }))
vi.mock('@/lib/db', () => ({
  get db() {
    return h.db
  },
}))
const { publishJob } = vi.hoisted(() => ({ publishJob: vi.fn(async () => undefined) }))
vi.mock('@/lib/qstash', () => ({ publishJob }))
const { startAudioTranscription, readAudioTranscription } = vi.hoisted(() => ({
  startAudioTranscription: vi.fn(),
  readAudioTranscription: vi.fn(),
}))
vi.mock('@/lib/ai/audio-transcript', () => ({
  startAudioTranscription,
  readAudioTranscription,
  transcribeFromAudio: vi.fn(),
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
beforeEach(() => {
  publishJob.mockClear()
  startAudioTranscription.mockReset()
  readAudioTranscription.mockReset()
})

const { runAudioTranscriptStart, runAudioTranscriptPoll, AUDIO_POLL_INTERVAL_SECONDS, MAX_AUDIO_POLLS } =
  await import('./audio-transcript-job')
const { AUDIO_TRANSCRIPT_STALE_MS } = await import('./summarize')

const summaryRow = async (id: string) =>
  (await h.db.select().from(sermonSummaries).where(eq(sermonSummaries.sermonId, id)))[0]
const messages = async (id: string) =>
  (await h.db.select().from(appLogs).where(eq(appLogs.entityId, id))).map((l) => l.message ?? '')
const inFlight = (id?: string) =>
  insertSermonFixture(h.db, {
    summaryStatus: 'pending',
    summaryNextRetryAt: new Date(Date.now() + 1000),
    youtubeVideoId: id,
  })
const poll = (sermonId: string, over: Partial<Parameters<typeof runAudioTranscriptPoll>[0]> = {}) => ({
  sermonId,
  videoId: 'vid',
  attempt: 0,
  interactionId: 'int-1',
  model: 'gemini-3.1-pro-preview',
  startedAt: Date.now() - 150_000,
  polls: 0,
  ...over,
})

describe('runAudioTranscriptStart (integration)', () => {
  it('자막이 이미 있으면 작업을 만들지 않는다', async () => {
    const id = await insertSermonFixture(h.db, { transcriptText: '[00:00] x' })

    expect(await runAudioTranscriptStart({ sermonId: id, videoId: 'vid' })).toBe('skipped')
    expect(startAudioTranscription).not.toHaveBeenCalled()
  })

  it('진행 표시를 남기고 작업을 만든 뒤 30초 뒤 조회를 발행한다', async () => {
    const id = await insertSermonFixture(h.db)
    startAudioTranscription.mockResolvedValue({ interactionId: 'int-1', model: 'gemini-3.1-pro-preview' })

    expect(await runAudioTranscriptStart({ sermonId: id, videoId: 'vid' })).toBe('started')

    expect((await summaryRow(id)).summaryStatus).toBe('pending')
    expect(publishJob).toHaveBeenCalledWith(
      'poll-audio-transcript',
      expect.objectContaining({
        sermonId: id,
        videoId: 'vid',
        attempt: 0,
        interactionId: 'int-1',
        model: 'gemini-3.1-pro-preview',
        polls: 0,
      }),
      AUDIO_POLL_INTERVAL_SECONDS,
      { retries: 1 },
    )
    expect(await messages(id)).toContain('오디오 변환 시작 (시도 1회 · gemini-3.1-pro-preview)')
  })

  it('작업 생성이 실패하면 실패 로그를 남기고 재시도로 넘긴다', async () => {
    const id = await insertSermonFixture(h.db)
    startAudioTranscription.mockRejectedValue(new Error('400 bad request'))

    expect(await runAudioTranscriptStart({ sermonId: id, videoId: 'vid', attempt: 0 })).toBe('retry')

    expect(publishJob).toHaveBeenCalledWith('fetch-audio-transcript', expect.objectContaining({ attempt: 1 }), 0, {
      retries: 0,
    })
    expect((await messages(id)).some((m) => m.startsWith('오디오 변환 실패(시도 1회'))).toBe(true)
  })
})

describe('runAudioTranscriptPoll (integration)', () => {
  it('진행 중이면 진행 표시를 늘리고 다음 조회를 발행한다', async () => {
    const id = await inFlight()
    readAudioTranscription.mockResolvedValue({ state: 'running' })
    const now = new Date()

    expect(await runAudioTranscriptPoll(poll(id, { polls: 3 }), now)).toBe('running')

    expect((await summaryRow(id)).summaryNextRetryAt?.getTime()).toBe(now.getTime() + AUDIO_TRANSCRIPT_STALE_MS)
    expect(publishJob).toHaveBeenCalledWith(
      'poll-audio-transcript',
      expect.objectContaining({ interactionId: 'int-1', polls: 4 }),
      AUDIO_POLL_INTERVAL_SECONDS,
      { retries: 1 },
    )
  })

  it('조회 요청이 실패해도 진행 중으로 보고 다시 조회한다', async () => {
    const id = await inFlight()
    readAudioTranscription.mockRejectedValue(new Error('fetch failed'))

    expect(await runAudioTranscriptPoll(poll(id))).toBe('running')
    expect(publishJob).toHaveBeenCalledWith(
      'poll-audio-transcript',
      expect.objectContaining({ polls: 1 }),
      AUDIO_POLL_INTERVAL_SECONDS,
      { retries: 1 },
    )
  })

  it('상한까지 끝나지 않으면 실패로 넘긴다', async () => {
    const id = await inFlight()
    readAudioTranscription.mockResolvedValue({ state: 'running' })

    expect(await runAudioTranscriptPoll(poll(id, { polls: MAX_AUDIO_POLLS - 1 }))).toBe('retry')
    expect(publishJob).toHaveBeenCalledWith('fetch-audio-transcript', expect.objectContaining({ attempt: 1 }), 0, {
      retries: 0,
    })
  })

  it('완료되면 자막을 저장하고 요약을 발행하며 소요 시간을 남긴다', async () => {
    const id = await insertSermonFixture(h.db, {
      summaryStatus: 'pending',
      summaryAttempts: 3,
      summaryNextRetryAt: new Date(Date.now() + 1000),
    })
    readAudioTranscription.mockResolvedValue({ state: 'done', segments: [{ startSeconds: 0, text: '말씀' }] })
    const now = new Date()

    expect(await runAudioTranscriptPoll(poll(id, { startedAt: now.getTime() - 152_000 }), now)).toBe('done')

    const [t] = await h.db.select().from(sermonTranscripts).where(eq(sermonTranscripts.sermonId, id))
    expect(t.transcriptText).toContain('말씀')
    const row = await summaryRow(id)
    expect([row.summaryStatus, row.summaryAttempts]).toEqual(['none', 0])
    expect(publishJob).toHaveBeenCalledWith('summarize', { sermonId: id })
    expect(await messages(id)).toContain('오디오 변환 완료 (152초 · gemini-3.1-pro-preview · 1줄)')
  })

  it('결과가 실패면 마지막 시도에서 자막 없음으로 끝낸다', async () => {
    const id = await inFlight()
    readAudioTranscription.mockResolvedValue({ state: 'failed', error: 'stopped early' })

    expect(await runAudioTranscriptPoll(poll(id, { attempt: 1 }))).toBe('gaveUp')

    expect((await summaryRow(id)).summaryStatus).toBe('no_transcript')
    expect((await messages(id)).some((m) => m.startsWith('오디오 변환 실패(시도 2회'))).toBe(true)
  })

  it('자막이 이미 있으면 조회하지 않는다', async () => {
    const id = await insertSermonFixture(h.db, { transcriptText: '[00:00] x' })

    expect(await runAudioTranscriptPoll(poll(id))).toBe('skipped')
    expect(readAudioTranscription).not.toHaveBeenCalled()
  })
})
