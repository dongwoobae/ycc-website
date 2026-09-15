import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'
import type { SermonChapter } from '@/lib/types'
import { generateContentWithFallback, resolveGeminiModel } from './gemini'

// summarize.ts의 summaryModel 기록과 일치시키기 위해 재노출한다.
export { DEFAULT_GEMINI_MODEL } from './gemini'

/** 요약 1차 모델. 실패하면 Gemini 체인으로 넘어간다 — 선택 근거는 2026-06-23-youtube-websub-pipeline-design.md "AI 요약" 항목. */
export const SUMMARY_OPENAI_MODEL = 'gpt-5.6-sol'
// summarize 라우트의 maxDuration 안에서 Gemini 폴백이 돌 시간을 남기려고 OpenAI 호출을 먼저 끊는다.
const OPENAI_TIMEOUT_MS = 150_000

export interface SermonSummaryResult {
  summary: string
  quickSummary: string[]
  chapters: SermonChapter[]
  /** 실제 응답을 생성한 모델(폴백 발생 시 폴백 모델). 기록(provenance)용. */
  model?: string
}

const schema = z.object({
  summary: z.string().min(1).max(500),
  quickSummary: z.array(z.string().min(1)).min(1).max(20),
  chapters: z
    .array(
      z.object({
        startSeconds: z.number().int().nonnegative(),
        title: z.string().min(1),
        summary: z.string().min(1),
      }),
    )
    .min(1),
})

export function parseSermonSummary(raw: unknown, durationSeconds: number | null): SermonSummaryResult {
  const parsed = schema.parse(raw)
  let prev = -1
  for (const c of parsed.chapters) {
    if (c.startSeconds <= prev) throw new Error('chapters must be strictly ascending')
    if (durationSeconds != null && c.startSeconds > durationSeconds) throw new Error('chapter beyond duration')
    prev = c.startSeconds
  }
  return parsed
}

export function buildSummaryPrompt(durationSeconds: number | null): string {
  const durationLine =
    durationSeconds != null
      ? `이 영상의 전체 길이는 ${durationSeconds}초(약 ${Math.round(durationSeconds / 60)}분)입니다.`
      : ''
  const chapterCountLine =
    durationSeconds != null
      ? `- 반드시 지킬 것: 전체 길이가 ${durationSeconds}초이므로 챕터는 총 ${Math.max(1, Math.round(durationSeconds / 600))}개 안팎이어야 합니다. 어떤 챕터도 900초를 초과해서는 안 됩니다. 만약 한 구간이 900초를 넘어갈 것 같으면, 그 구간 안에서 소주제 전환점을 다시 찾아 반드시 둘 이상으로 쪼개세요.`
      : ''

  return `당신은 한국어 설교 영상을 요약하는 도우미입니다.
아래의 "[MM:SS] 발화" 형식 설교 자막 원고를 읽고 한국어로 작성하세요. 모든 문장은 '~합니다'체로 씁니다.
${durationLine}
1) summary: 한 줄 소개 (한 문장, 핵심이 되는 성경구절의 위치 (예시: 마태복음 5:3) 30자 내외로 작성)
2) quickSummary: 핵심 요점 8~12개 (각 한 문장)
3) chapters: 설교를 내용 흐름에 따라 나눈 구간 객체 배열(시작 시각 startSeconds, 제목 title, 요약 summary).
- 구간 분할 기준: 설교에서 다루는 주제(말씀 내용)가 바뀌는 지점에서 나눈다. 같은 주제가 이어지면 길게, 주제가 바뀌면 더 짧게 나눈다. 대략 8~10분 간격을 기준으로 삼되, 한 구간은 최소 약 6분(360초) 이상, 최대 약 15분(900초)을 넘지 않도록 한다.
${chapterCountLine}
- title: 해당 구간을 대표하는 짧은 제목
- summary: 해당 구간 설교 내용을 6~10문장으로 구체적으로 풀어 쓴 상세 요약. 핵심 메시지, 인용된 성경 구절, 설교자가 제시한 적용을 포함한다.
- 각 챕터의 title과 summary는 그 챕터의 startSeconds부터 다음 챕터 startSeconds 직전까지의 원고만 근거로 쓴다. 다른 구간에서 나온 예화·성경 구절·적용을 가져오지 말고, 원고에 없는 내용을 덧붙이지 않는다.
startSeconds는 원고에 표기된 [MM:SS] 타임스탬프를 초로 환산해 사용하고, 0부터 오름차순이어야 합니다.
원고는 유튜브 자동자막이라 잘못 받아쓴 단어가 섞여 있습니다. 기독교 설교라는 맥락(성경 책 이름·인명·신앙 용어 등)과 앞뒤 문장을 보고, 문맥에 맞지 않는 단어는 원래 의도된 단어로 바로잡아 쓰세요. 무엇이 맞는지 확신할 수 없으면 그 단어를 추측해 바꾸지 말고 요약에서 뺍니다.

[자막 원고]
`
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    quickSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSeconds: { type: Type.INTEGER },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['startSeconds', 'title', 'summary'],
      },
    },
  },
  required: ['summary', 'quickSummary', 'chapters'],
}

// strict 모드는 모든 객체에 additionalProperties:false와 전 필드 required를 요구한다.
const openAISchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'quickSummary', 'chapters'],
  properties: {
    summary: { type: 'string' },
    quickSummary: { type: 'array', items: { type: 'string' } },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['startSeconds', 'title', 'summary'],
        properties: {
          startSeconds: { type: 'integer' },
          title: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
  },
}

interface OpenAIResponsesBody {
  model?: string
  output?: { content?: { type?: string; text?: string }[] }[]
}

async function summarizeWithOpenAI(
  apiKey: string,
  prompt: string,
  durationSeconds: number | null,
): Promise<SermonSummaryResult> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: SUMMARY_OPENAI_MODEL,
      input: prompt,
      // 단발 요약이므로 응답을 저장하거나 암묵적 prompt cache를 쓰지 않는다.
      store: false,
      prompt_cache_options: { mode: 'explicit' },
      text: { format: { type: 'json_schema', name: 'sermon_summary', schema: openAISchema, strict: true } },
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const body = (await res.json()) as OpenAIResponsesBody
  const text = body.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text
  if (!text) throw new Error('openai returned no output_text')
  const parsed = parseSermonSummary(JSON.parse(text), durationSeconds)
  return { ...parsed, model: body.model || SUMMARY_OPENAI_MODEL }
}

async function summarizeWithGemini(prompt: string, durationSeconds: number | null): Promise<SermonSummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const ai = new GoogleGenAI({ apiKey })
  const res = await generateContentWithFallback(ai, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema,
    },
  })

  const text = res.text
  if (!text) throw new Error('gemini returned empty response')
  const parsed = parseSermonSummary(JSON.parse(text), durationSeconds)
  return { ...parsed, model: res.modelVersion || resolveGeminiModel() }
}

export async function generateSermonSummary(
  transcriptText: string,
  durationSeconds: number | null,
): Promise<SermonSummaryResult> {
  if (!transcriptText.trim()) throw new Error('empty transcript')
  const prompt = buildSummaryPrompt(durationSeconds) + transcriptText

  const openAIKey = process.env.OPENAI_API_KEY
  if (openAIKey) {
    try {
      return await summarizeWithOpenAI(openAIKey, prompt, durationSeconds)
    } catch (e) {
      console.error('[sermon-summary] OpenAI 요약 실패 — Gemini로 폴백', e)
    }
  }
  return summarizeWithGemini(prompt, durationSeconds)
}
