import type { TranscriptSegment } from '@/lib/transcript/prompt'
import { Agent, setGlobalDispatcher } from 'undici'
import { GoogleGenAI } from '@google/genai'
import {
  AUDIO_TRANSCRIPT_MODEL,
  AUDIO_TRANSCRIPT_MODEL_GA,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  generateContentWithFallback,
} from './gemini'

const TIMESTAMP_LINE = /^\[(\d{1,3}(?::\d{2}){1,2})\]\s*(.*)$/

/** 1시간을 넘는 설교에서 Gemini가 타임스탬프를 [MM:SS] 대신 [H:MM:SS]로 바꿔 쓰는 경우가 실측으로 확인됐다. */
export function parseTimestampedTranscript(raw: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = []
  for (const line of raw.split('\n')) {
    const match = TIMESTAMP_LINE.exec(line.trim())
    if (!match) continue
    const [, timestamp, text] = match
    const trimmedText = text.trim()
    if (!trimmedText) continue
    const parts = timestamp.split(':').map(Number)
    const startSeconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
    segments.push({ startSeconds, text: trimmedText })
  }
  return segments
}

const AUDIO_TRANSCRIPT_PROMPT = `이 오디오는 한국어 교회 설교 영상입니다. 처음부터 끝까지 발화된 내용을 그대로(요약하거나 생략하지 말고) 한국어로 받아쓰기 하세요.
출력 형식은 반드시 아래와 같이, 각 줄마다 [MM:SS] 타임스탬프로 시작해야 합니다. 타임스탬프는 실제 오디오 재생 시각과 최대한 정확히 일치해야 합니다.

[00:02] 첫 문장 내용
[00:06] 다음 문장 내용
...

다른 설명 없이 이 형식의 받아쓰기 텍스트만 출력하세요.`

let longRequestDispatcherConfigured = false

/** Node 기본 undici headersTimeout(5분)이 4~5분 걸리는 오디오 처리와 충돌해 간헐적 fetch failed를 일으키는 것을 실측으로 확인 — 10분으로 올린다. */
function ensureLongRequestDispatcher(): void {
  if (longRequestDispatcherConfigured) return
  setGlobalDispatcher(new Agent({ headersTimeout: 600_000, bodyTimeout: 600_000 }))
  longRequestDispatcherConfigured = true
}

/** 유튜브 워치 URL을 Gemini에 직접 넘겨 오디오를 받아쓴다. 오디오 추출/다운로드는 하지 않는다(구글 서버가 처리). */
export async function transcribeFromAudio(videoId: string): Promise<TranscriptSegment[]> {
  ensureLongRequestDispatcher()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const ai = new GoogleGenAI({ apiKey })
  const res = await generateContentWithFallback(
    ai,
    {
      contents: [
        {
          role: 'user',
          parts: [
            { text: AUDIO_TRANSCRIPT_PROMPT },
            { fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` } },
          ],
        },
      ],
    },
    [AUDIO_TRANSCRIPT_MODEL, AUDIO_TRANSCRIPT_MODEL_GA, DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL],
  )

  const text = res.text
  if (!text) throw new Error('gemini returned empty audio transcript')
  return parseTimestampedTranscript(text)
}
