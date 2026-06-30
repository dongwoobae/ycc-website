import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { SermonChapter } from "@/lib/types";
import { generateContentWithFallback, resolveGeminiModel } from "./gemini";

// summarize.ts의 summaryModel 기록과 일치시키기 위해 재노출한다.
export { DEFAULT_GEMINI_MODEL } from "./gemini";

export interface SermonSummaryResult {
  summary: string;
  quickSummary: string[];
  chapters: SermonChapter[];
  /** 실제 응답을 생성한 모델(폴백 발생 시 폴백 모델). 기록(provenance)용. */
  model?: string;
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
});

export function parseSermonSummary(raw: unknown, durationSeconds: number | null): SermonSummaryResult {
  const parsed = schema.parse(raw);
  let prev = -1;
  for (const c of parsed.chapters) {
    if (c.startSeconds <= prev) throw new Error("chapters must be strictly ascending");
    if (durationSeconds != null && c.startSeconds > durationSeconds) throw new Error("chapter beyond duration");
    prev = c.startSeconds;
  }
  return parsed;
}

const PROMPT = `당신은 한국어 설교 영상을 요약하는 도우미입니다.
아래의 "[MM:SS] 발화" 형식 설교 자막 원고를 읽고 한국어로 작성하세요.
1) summary: 한 줄 소개 (한 문장, 핵심이 되는 성경구절의 위치 (예시: 마태복음 5:3) 30자 내외로 작성)
2) quickSummary: 핵심 요점 8~12개 (각 한 문장)
3) chapters: 설교를 내용 흐름에 따라 나눈 구간 객체 배열(시작 시각 startSeconds, 제목 title, 요약 summary).
- 구간 분할 기준: 설교에서 다루는 주제(말씀 내용)가 바뀌는 지점에서 나눈다. 같은 주제가 이어지면 길게, 주제가 바뀌면 더 짧게 나눈다. 대략 8~10분 간격을 기준으로 삼되, 한 구간은 최소 약 6분(360초) 이상, 최대 약 15분(900초)을 넘지 않도록 한다.
- title: 해당 구간을 대표하는 짧은 제목
- summary: 해당 구간 설교 내용을 6~10문장으로 구체적으로 풀어 쓴 상세 요약. 핵심 메시지, 인용된 성경 구절, 청중을 향한 적용을 포함한다.
startSeconds는 원고에 표기된 [MM:SS] 타임스탬프를 초로 환산해 사용하고, 0부터 오름차순이어야 합니다.

[자막 원고]
`;

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
        required: ["startSeconds", "title", "summary"],
      },
    },
  },
  required: ["summary", "quickSummary", "chapters"],
};

export async function generateSermonSummary(
  transcriptText: string,
  durationSeconds: number | null,
): Promise<SermonSummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  if (!transcriptText.trim()) throw new Error("empty transcript");

  const ai = new GoogleGenAI({ apiKey });
  const res = await generateContentWithFallback(ai, {
    contents: [
      {
        role: "user",
        parts: [{ text: PROMPT + transcriptText }],
      },
    ],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const text = res.text;
  if (!text) throw new Error("gemini returned empty response");
  const parsed = parseSermonSummary(JSON.parse(text), durationSeconds);
  return { ...parsed, model: res.modelVersion || resolveGeminiModel() };
}
