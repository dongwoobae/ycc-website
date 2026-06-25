import { GoogleGenAI } from '@google/genai'
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/sermon-summary'

export interface BgKeywordsInput {
  summary?: string | null
  quickSummary?: string[] | null
}

const PROMPT = `You turn a Korean sermon summary into a short ENGLISH visual mood prompt for an AI image generator that will create a thumbnail BACKGROUND (no text).
Rules:
- Output ONLY a comma-separated list of 4-7 English visual keywords/phrases (mood, lighting, color, abstract motifs).
- Describe atmosphere, NOT literal religious scenes. Keep it tasteful, reverent, hopeful.
- No people, no faces, no text/letters. No quotes, no explanation.
Example output: warm dawn light, soft golden gradient, gentle hope, open sky, subtle cross bokeh
Sermon summary:
`

/** summary+quickSummary를 gpt-image용 영어 무드 키워드로 변환. 결과는 호출부에서 DB 캐시. */
export async function geminiBgKeywords(input: BgKeywordsInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
  const ai = new GoogleGenAI({ apiKey })
  const body = [input.summary, ...(input.quickSummary ?? [])].filter(Boolean).join('\n')
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: PROMPT + body }] }],
    config: { temperature: 0.6 },
  })
  const text = res.text?.trim()
  if (!text) throw new Error('gemini returned empty bg keywords')
  return text.split('\n')[0].slice(0, 200)
}
