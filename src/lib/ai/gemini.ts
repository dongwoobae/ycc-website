import type { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from '@google/genai'

/** 기본(우선) 모델. GEMINI_MODEL 환경변수로 덮어쓸 수 있다. */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'
/** 우선 모델이 일시 과부하(503)일 때 자동 우회할 안정 모델. */
export const FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash'
/** 오디오(유튜브 URL) 받아쓰기 1차 모델. */
export const AUDIO_TRANSCRIPT_MODEL = 'gemini-3.1-pro-preview'
/** AUDIO_TRANSCRIPT_MODEL의 preview 태그가 떨어지고 정식 출시되면 쓸 이름. preview가 단종(404)되면 자동으로 이쪽으로 전환된다. */
export const AUDIO_TRANSCRIPT_MODEL_GA = 'gemini-3.1-pro'

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

/** 모델 자체가 단종/이름 변경된 경우(예: gemini-2.5-pro가 신규 사용자 대상 404로 종료된 사례). 이 모델로는 영원히 안 되지만 다음 모델은 될 수 있으므로 폴백 대상이다. */
export function isModelUnavailableError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status
  if (status === 404) return true
  const message = error instanceof Error ? error.message : String(error)
  return /NOT_FOUND|no longer available/i.test(message)
}

/**
 * models를 순서대로 시도한다. 일시 오류(503 등) 또는 모델 단종(404)이면 다음 모델로 넘어가고,
 * 그 외 오류(예: 400 잘못된 요청)는 즉시 throw한다.
 * models 생략 시 [resolveGeminiModel(), FALLBACK_GEMINI_MODEL] 2단 체인을 쓴다. 중복 모델은 한 번만 시도한다.
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI,
  request: Omit<GenerateContentParameters, 'model'>,
  models: readonly string[] = [resolveGeminiModel(), FALLBACK_GEMINI_MODEL],
): Promise<GenerateContentResponse> {
  const uniqueModels = [...new Set(models)]

  let lastError: unknown
  for (const model of uniqueModels) {
    try {
      return await ai.models.generateContent({ model, ...request })
    } catch (error) {
      lastError = error
      if (!isTransientGeminiError(error) && !isModelUnavailableError(error)) throw error
    }
  }
  throw lastError
}
