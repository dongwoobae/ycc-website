import { describe, expect, it, vi } from 'vitest'
import {
  AUDIO_TRANSCRIPT_MODEL,
  AUDIO_TRANSCRIPT_MODEL_GA,
  FALLBACK_GEMINI_MODEL,
  generateContentWithFallback,
  isModelUnavailableError,
  isTransientGeminiError,
} from './gemini'

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

describe('isModelUnavailableError', () => {
  it('404/NOT_FOUND/"no longer available"는 모델 단종으로 판별', () => {
    expect(isModelUnavailableError({ status: 404 })).toBe(true)
    expect(
      isModelUnavailableError(
        new Error(
          '{"error":{"code":404,"message":"This model models/gemini-2.5-pro is no longer available to new users.","status":"NOT_FOUND"}}',
        ),
      ),
    ).toBe(true)
  })

  it('그 외 오류는 false', () => {
    expect(isModelUnavailableError({ status: 400 })).toBe(false)
    expect(isModelUnavailableError({ status: 503 })).toBe(false)
    expect(isModelUnavailableError(new Error('invalid argument'))).toBe(false)
  })
})

describe('generateContentWithFallback', () => {
  it('primary 성공 시 나머지 모델 미호출', async () => {
    const fn = vi.fn().mockResolvedValue({ text: 'ok' })
    const res = await generateContentWithFallback(makeAi(fn), req, ['gemini-3.5-flash', FALLBACK_GEMINI_MODEL])
    expect(res).toEqual({ text: 'ok' })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ model: 'gemini-3.5-flash', ...req })
  })

  it('primary 503이면 다음 모델로 순서대로 재시도', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ text: 'from-fallback' })
    const res = await generateContentWithFallback(makeAi(fn), req, ['gemini-3.5-flash', FALLBACK_GEMINI_MODEL])
    expect(res).toEqual({ text: 'from-fallback' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith({ model: FALLBACK_GEMINI_MODEL, ...req })
  })

  it('3단 체인에서 앞의 둘이 503이면 세 번째로 재시도', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ text: 'third' })
    const res = await generateContentWithFallback(makeAi(fn), req, [
      AUDIO_TRANSCRIPT_MODEL,
      'gemini-3.5-flash',
      FALLBACK_GEMINI_MODEL,
    ])
    expect(res).toEqual({ text: 'third' })
    expect(fn).toHaveBeenCalledTimes(3)
    expect(fn).toHaveBeenLastCalledWith({ model: FALLBACK_GEMINI_MODEL, ...req })
  })

  it('비일시오류는 즉시 throw, 나머지 모델 미호출', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400 })
    await expect(
      generateContentWithFallback(makeAi(fn), req, ['gemini-3.5-flash', FALLBACK_GEMINI_MODEL]),
    ).rejects.toMatchObject({ status: 400 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('1차 모델이 단종(404)되면 정식 출시 모델로 자동 전환', async () => {
    const fn = vi.fn().mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({ text: 'from-ga' })
    const res = await generateContentWithFallback(makeAi(fn), req, [AUDIO_TRANSCRIPT_MODEL, AUDIO_TRANSCRIPT_MODEL_GA])
    expect(res).toEqual({ text: 'from-ga' })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith({ model: AUDIO_TRANSCRIPT_MODEL_GA, ...req })
  })

  it('배열에 같은 모델이 중복되면 한 번만 시도', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 })
    await expect(
      generateContentWithFallback(makeAi(fn), req, [FALLBACK_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]),
    ).rejects.toMatchObject({ status: 503 })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('models 생략 시 기본값(resolveGeminiModel → FALLBACK_GEMINI_MODEL) 사용', async () => {
    const fn = vi.fn().mockResolvedValue({ text: 'ok' })
    await generateContentWithFallback(makeAi(fn), req)
    expect(fn).toHaveBeenCalledWith({ model: 'gemini-3.5-flash', ...req })
  })
})
