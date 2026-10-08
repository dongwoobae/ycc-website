import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertCoversFullAudio,
  AUDIO_ONLY_FPS,
  AUDIO_TRANSCRIPT_MODELS,
  MIN_TRANSCRIPT_COVERAGE,
  parseTimestampedTranscript,
  readAudioTranscription,
  startAudioTranscription,
  transcribeFromAudio,
} from './audio-transcript'

const { create, get } = vi.hoisted(() => ({ create: vi.fn(), get: vi.fn() }))
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    interactions = { create, get }
  },
}))

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  create.mockReset()
  get.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

/** 실측한 완료 응답의 단계 구성. 입력 단계의 프롬프트 예시 줄이 결과에 섞이면 안 된다. */
const completed = (text: string) => ({
  status: 'completed',
  steps: [
    { type: 'user_input', content: [{ type: 'text', text: '[00:02] 첫 문장 내용' }] },
    { type: 'thought', signature: 'sig' },
    { type: 'model_output', content: [{ type: 'text', text }] },
  ],
})

describe('parseTimestampedTranscript', () => {
  it('parses [MM:SS] lines', () => {
    const raw = '[00:02] 안녕하세요\n[00:06] 오늘 말씀은'
    expect(parseTimestampedTranscript(raw)).toEqual([
      { startSeconds: 2, text: '안녕하세요' },
      { startSeconds: 6, text: '오늘 말씀은' },
    ])
  })

  it('parses [H:MM:SS] lines (1시간 넘는 영상에서 모델이 바꿔 쓰는 형식)', () => {
    const raw = '[01:06:27] 마지막 문장입니다'
    expect(parseTimestampedTranscript(raw)).toEqual([{ startSeconds: 3987, text: '마지막 문장입니다' }])
  })

  it('skips blank lines and lines without a timestamp', () => {
    const raw = '[00:02] 첫 줄\n\n설명 없는 줄\n[00:10] 다음 줄'
    expect(parseTimestampedTranscript(raw)).toEqual([
      { startSeconds: 2, text: '첫 줄' },
      { startSeconds: 10, text: '다음 줄' },
    ])
  })

  it('skips a timestamp line with no text after it', () => {
    const raw = '[00:02] \n[00:05] 실제 내용'
    expect(parseTimestampedTranscript(raw)).toEqual([{ startSeconds: 5, text: '실제 내용' }])
  })

  it('returns an empty array for empty input', () => {
    expect(parseTimestampedTranscript('')).toEqual([])
  })
})

describe('assertCoversFullAudio', () => {
  // thinkingBudget을 낮추면 모델이 앞부분만 받아쓰고 finishReason=STOP으로 정상 종료하는 것을 실측으로 확인했다.
  // Interactions 응답에는 finishReason이 없어 이 검사가 조용한 절단을 막는 유일한 장치다.
  it('throws when the transcript stops far short of the audio length', () => {
    const segments = [{ startSeconds: 457, text: '귀한 찬양 감사합니다.' }]
    expect(() => assertCoversFullAudio(segments, 3465)).toThrow(/stopped early/)
  })

  it('accepts a transcript that runs to the end of the audio', () => {
    const segments = [{ startSeconds: 3454, text: '아멘.' }]
    expect(() => assertCoversFullAudio(segments, 3465)).not.toThrow()
  })

  it('accepts a transcript sitting exactly on the coverage floor', () => {
    const segments = [{ startSeconds: Math.ceil(3465 * MIN_TRANSCRIPT_COVERAGE), text: '끝' }]
    expect(() => assertCoversFullAudio(segments, 3465)).not.toThrow()
  })

  // duration을 모르는 설교는 비교 기준이 없다 — 검사를 건너뛴다(문서화된 구멍).
  it('skips the check when the sermon has no duration', () => {
    const segments = [{ startSeconds: 5, text: '짧다' }]
    expect(() => assertCoversFullAudio(segments, null)).not.toThrow()
  })

  it('throws when there is nothing to measure', () => {
    expect(() => assertCoversFullAudio([], 3465)).toThrow(/stopped early/)
  })
})

describe('startAudioTranscription', () => {
  it('프레임을 뺀 background 작업을 첫 모델로 만든다', async () => {
    create.mockResolvedValue({ id: 'int-1', status: 'in_progress' })

    const out = await startAudioTranscription('vid')

    expect(out).toEqual({ interactionId: 'int-1', model: AUDIO_TRANSCRIPT_MODELS[0] })
    const params = create.mock.calls[0][0]
    expect(params.model).toBe(AUDIO_TRANSCRIPT_MODELS[0])
    expect(params.background).toBe(true)
    expect(params.input[1]).toEqual({
      type: 'video',
      uri: 'https://www.youtube.com/watch?v=vid',
      processing: { type: 'static', fps: AUDIO_ONLY_FPS },
    })
  })

  it('생성 단계의 404·503은 다음 모델로 넘긴다', async () => {
    create
      .mockRejectedValueOnce({ status: 404 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ id: 'int-3' })

    const out = await startAudioTranscription('vid', ['a', 'b', 'c'])

    expect(out).toEqual({ interactionId: 'int-3', model: 'c' })
  })

  it('그 밖의 오류는 바로 던진다', async () => {
    create.mockRejectedValue({ status: 400 })

    await expect(startAudioTranscription('vid', ['a', 'b'])).rejects.toMatchObject({ status: 400 })
    expect(create).toHaveBeenCalledTimes(1)
  })
})

describe('readAudioTranscription', () => {
  it('진행 중이면 running', async () => {
    get.mockResolvedValue({ status: 'in_progress' })

    expect(await readAudioTranscription('int', 100)).toEqual({ state: 'running' })
  })

  it('끝까지 받아쓴 결과는 model_output만 파싱한다', async () => {
    get.mockResolvedValue(completed('[00:00] 시작\n[01:35] 끝'))

    expect(await readAudioTranscription('int', 100)).toEqual({
      state: 'done',
      segments: [
        { startSeconds: 0, text: '시작' },
        { startSeconds: 95, text: '끝' },
      ],
    })
  })

  it('앞부분만 받아쓴 결과는 실패로 본다', async () => {
    get.mockResolvedValue(completed('[00:00] 시작\n[00:10] 중단'))

    expect(await readAudioTranscription('int', 100)).toMatchObject({
      state: 'failed',
      error: expect.stringContaining('stopped early'),
    })
  })

  it('작업이 failed면 실패로 본다', async () => {
    get.mockResolvedValue({ status: 'failed', error: { message: 'boom' } })

    expect(await readAudioTranscription('int', 100)).toMatchObject({
      state: 'failed',
      error: expect.stringContaining('boom'),
    })
  })
})

describe('transcribeFromAudio', () => {
  it('끝날 때까지 조회해 세그먼트를 돌려준다', async () => {
    create.mockResolvedValue({ id: 'int' })
    get.mockResolvedValueOnce({ status: 'in_progress' }).mockResolvedValueOnce(completed('[00:00] 시작\n[01:35] 끝'))

    const segments = await transcribeFromAudio('vid', 100, { pollMs: 0 })

    expect(segments).toHaveLength(2)
    expect(get).toHaveBeenCalledTimes(2)
  })
})
