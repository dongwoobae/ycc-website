import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from '@google/genai'

/** 기본(우선) 모델. GEMINI_MODEL 환경변수로 덮어쓸 수 있다. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
/** 우선 모델이 일시 과부하(503)일 때 자동 우회할 안정 모델. */
export const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash'

export function resolveGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
}

/** 503(UNAVAILABLE)·429·high demand 등 재시도하면 풀릴 수 있는 일시 오류인지 판별. */
export function isTransientGeminiError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  if (status === 503 || status === 500 || status === 429) return true
  const message = error instanceof Error ? error.message : String(error)
  return /UNAVAILABLE|high demand|overloaded|try again later/i.test(message)
}

/**
 * primaryModel로 generateContent를 호출하고, 일시 오류(503 등)면 FALLBACK_GEMINI_MODEL로 1회 재시도한다.
 * 비일시 오류(400 등)는 즉시 throw한다. 우선 모델이 이미 폴백 모델이면 재시도하지 않는다.
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI,
  request: Omit<GenerateContentParameters, 'model'>,
  primaryModel: string = resolveGeminiModel()
): Promise<GenerateContentResponse> {
  const models =
    primaryModel === FALLBACK_GEMINI_MODEL ? [primaryModel] : [primaryModel, FALLBACK_GEMINI_MODEL]

  let lastError: unknown
  for (const model of models) {
    try {
      return await ai.models.generateContent({ model, ...request })
    } catch (error) {
      lastError = error
      if (!isTransientGeminiError(error)) throw error
    }
  }
  throw lastError
}
