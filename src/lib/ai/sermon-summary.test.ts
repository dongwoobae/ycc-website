import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSummaryPrompt, generateSermonSummary, parseSermonSummary } from './sermon-summary'

const { generateContentWithFallback } = vi.hoisted(() => ({ generateContentWithFallback: vi.fn() }))
vi.mock('./gemini', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./gemini')>()),
  generateContentWithFallback,
}))

describe('buildSummaryPrompt', () => {
  it('길이가 있으면 전체 길이·기대 챕터 수·900초 제한을 명시한다', () => {
    const prompt = buildSummaryPrompt(4140)
    expect(prompt).toContain('4140초')
    expect(prompt).toContain('약 69분')
    expect(prompt).toContain('총 7개 안팎')
    expect(prompt).toContain('900초를 초과해서는 안 됩니다')
  })

  it('짧은 영상도 최소 1개 이상의 기대 챕터 수를 명시한다', () => {
    const prompt = buildSummaryPrompt(200)
    expect(prompt).toContain('총 1개 안팎')
  })

  it('길이를 모르면(null) 강제 챕터 수 지시를 생략한다', () => {
    const prompt = buildSummaryPrompt(null)
    expect(prompt).not.toContain('900초를 초과해서는 안 됩니다')
    expect(prompt).not.toContain('안팎이어야 합니다')
  })
})

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

describe('generateSermonSummary', () => {
  const openAIBody = (payload: unknown) => ({
    model: 'gpt-5.6-sol',
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(payload) }] },
    ],
  })
  const geminiResponse = { text: JSON.stringify(valid), modelVersion: 'gemini-3.5-flash' }

  function stubKeys({ openai = true } = {}) {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key')
    vi.stubEnv('OPENAI_API_KEY', openai ? 'openai-test-key' : '')
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    generateContentWithFallback.mockReset()
  })

  it('summarizes with GPT-5.6 Sol first', async () => {
    stubKeys()
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(openAIBody(valid)))
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateSermonSummary('[00:00] 말씀', 600)

    expect(result).toEqual({ ...valid, model: 'gpt-5.6-sol' })
    expect(generateContentWithFallback).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.openai.com/v1/responses')
    const body = JSON.parse(String(init?.body))
    expect(body.model).toBe('gpt-5.6-sol')
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true })
    expect(body.input).toContain('[00:00] 말씀')
  })

  it('falls back to Gemini when OpenAI returns an error', async () => {
    stubKeys()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ error: { message: 'overloaded' } }, { status: 500 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    generateContentWithFallback.mockResolvedValue(geminiResponse)

    const result = await generateSermonSummary('[00:00] 말씀', 600)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result).toEqual({ ...valid, model: 'gemini-3.5-flash' })
  })

  it('falls back to Gemini when the OpenAI summary fails validation', async () => {
    stubKeys()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const reversed = { ...valid, chapters: [valid.chapters[1], valid.chapters[0]] }
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(openAIBody(reversed)))
    vi.stubGlobal('fetch', fetchMock)
    generateContentWithFallback.mockResolvedValue(geminiResponse)

    const result = await generateSermonSummary('[00:00] 말씀', 600)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result).toEqual({ ...valid, model: 'gemini-3.5-flash' })
  })

  it('goes straight to Gemini when OPENAI_API_KEY is not set', async () => {
    stubKeys({ openai: false })
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    generateContentWithFallback.mockResolvedValue(geminiResponse)

    const result = await generateSermonSummary('[00:00] 말씀', 600)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.model).toBe('gemini-3.5-flash')
  })
})
