import { GoogleGenAI } from '@google/genai'
import { generateContentWithFallback } from '@/lib/ai/gemini'
import type { ComposeSermonInput, HeadlineFn } from './compose-text'

const PROMPT = `당신은 한국 교회 설교 영상의 유튜브 썸네일 카피라이터입니다.
아래 설교 요약을 보고, 클릭을 부르되 과장·낚시가 아닌 단정하고 은혜로운 한 줄 헤드라인을 작성하세요.
- 18자 이내, 한 줄, 따옴표/이모지 없이.
- 설교 핵심 메시지를 담되 자극적 표현·물음표 남발 금지.
요약:
`

export const geminiHeadline: HeadlineFn = async (sermon: ComposeSermonInput) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const ai = new GoogleGenAI({ apiKey })
  const body = [sermon.summary, ...(sermon.quickSummary ?? [])].filter(Boolean).join('\n')
  const res = await generateContentWithFallback(ai, {
    contents: [{ role: 'user', parts: [{ text: PROMPT + body }] }],
    config: { temperature: 0.7 },
  })
  const text = res.text?.trim()
  if (!text) throw new Error('gemini returned empty headline')
  return text.split('\n')[0].slice(0, 24)
}
