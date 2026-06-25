import { describe, expect, it, vi } from 'vitest'
import { FALLBACK_GEMINI_MODEL, generateContentWithFallback, isTransientGeminiError } from './gemini'

type Ai = Parameters<typeof generateContentWithFallback>[0]
function makeAi(fn: ReturnType<typeof vi.fn>): Ai {
  return { models: { generateContent: fn } } as unknown as Ai
}

const req = { contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }

describe('isTransientGeminiError', () => {
  it('503/UNAVAILABLE/high demand는 일시오류', () => {
    expect(isTransientGeminiError({ status: 503 })).toBe(true)
    expect(isTransientGeminiError({ status: 429 })).toBe(true)
    expect(isTransientGeminiError(new Error('"status":"UNAVAILABLE"'))).toBe(true)
    expect(isTransientGeminiError(new Error('This model is currently experiencing high demand'))).toBe(true)
  })

  it('비일시오류는 false', () => {
    expect(isTransientGeminiError({ status: 400 })).toBe(false)
    expect(isTransientGeminiError(new Error('invalid argument'))).toBe(false)
  })
})

describe('generateContentWithFallback', () => {
  it('primary 성공 시 fallback 미호출', async () => {
    const fn = vi.fn().mockResolvedValue({ text: 'ok' })
    const res = await generateContentWithFallback(makeAi(fn), req, 'gemini-3.5-flash')
    expect(res).toEqual({ text: 'ok' })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ model: 'gemini-3.5-flash', ...req })
  })

  it('primary 503이면 fallback 모델로 1회 재시도', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ text: 'from-fallback' })
    const res = await generateContentWithFallback(makeAi(fn), req, 'gemini-3.5-flash')
    expect(res).toEqual({ text: 'from-fallback' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith({ model: FALLBACK_GEMINI_MODEL, ...req })
  })

  it('비일시오류는 즉시 throw, fallback 미호출', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400 })
    await expect(generateContentWithFallback(makeAi(fn), req, 'gemini-3.5-flash')).rejects.toMatchObject({
      status: 400,
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('primary가 이미 fallback 모델이면 재시도하지 않음', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 })
    await expect(generateContentWithFallback(makeAi(fn), req, FALLBACK_GEMINI_MODEL)).rejects.toMatchObject({
      status: 503,
    })
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
