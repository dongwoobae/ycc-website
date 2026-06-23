import { GoogleGenAI, Type } from '@google/genai'
import { z } from 'zod'
import type { SermonChapter } from '@/lib/types'

export interface SermonSummaryResult {
  summary: string
  quickSummary: string[]
  chapters: SermonChapter[]
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
      })
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

const PROMPT = `당신은 한국어 설교 영상을 요약하는 도우미입니다.
아래의 "[MM:SS] 발화" 형식 설교 자막 원고를 읽고 한국어로 작성하세요.
1) summary: 한 줄 소개 (한 문장)
2) quickSummary: 핵심 요점 8~12개 (각 한 문장)
3) chapters: 영상 흐름을 시간 구간으로 나눈 각 구간의 시작 시각(초, startSeconds), 제목(title), 요약(summary).
startSeconds는 원고에 표기된 [MM:SS] 타임스탬프를 초로 환산해 사용하고, 0부터 오름차순이어야 합니다.

[자막 원고]
`

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

export async function generateSermonSummary(
  transcriptText: string,
  durationSeconds: number | null
): Promise<SermonSummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  if (!transcriptText.trim()) throw new Error('empty transcript')
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash'

  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text: PROMPT + transcriptText }],
      },
    ],
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema,
    },
  })

  const text = res.text
  if (!text) throw new Error('gemini returned empty response')
  return parseSermonSummary(JSON.parse(text), durationSeconds)
}
