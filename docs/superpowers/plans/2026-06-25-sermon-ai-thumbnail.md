# 설교 AI 썸네일 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 설교 편집 페이지에서 3가지 스타일(정통형/후킹형/인물컷형)의 디자인된 썸네일을 AI로 생성·미리보고 선택해 적용한다.

**Architecture:** 하이브리드 방식. OpenAI `gpt-image-2`가 글자 없는 배경을 생성하고, `next/og`의 `ImageResponse`(Satori)가 한글 폰트로 제목·성경구절을 정밀하게 오버레이한다. 후보는 R2에 누적 저장하고 `sermons.thumbnailCandidates`(jsonb)로 이력을 관리한다. 확정본은 `sermons.customThumbnailUrl`에 기록하며, 공개 화면은 `customThumbnailUrl ?? thumbnailUrl ?? 유튜브폴백` 순으로 표시한다.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Drizzle ORM(Neon Postgres), `next/og` ImageResponse, OpenAI Images REST(`gpt-image-2`), Gemini(`@google/genai`, 기존), `@imgly/background-removal-node`(누끼), Cloudflare R2(`@aws-sdk/client-s3`, 기존), Pretendard 폰트(기존 의존성), vitest, npm.

**참고 스펙:** `docs/superpowers/specs/2026-06-25-sermon-ai-thumbnail-design.md`

**구현 순서 원칙:** Task 1~4 + 9(정통형 한정) + 10으로 **① 정통형이 end-to-end로 동작**하게 먼저 완성한 뒤, Task 5(배경 AI), Task 6(누끼), 후킹형 Gemini를 붙인다. 각 Task는 독립 커밋.

**환경변수 (구현 중 추가):**
- `OPENAI_API_KEY` — gpt-image-2 호출용. `.env.example`에 주석과 함께 추가.

> ⚠ **지식 컷오프 주의:** `gpt-image-2`(2026-04-21 릴리스)는 작성자 지식 컷오프 이후 모델이다. Task 5 구현 시 OpenAI 공식 문서에서 **정확한 모델 ID·요청 파라미터·응답 형식(b64_json vs url)**을 반드시 확인하고 코드의 해당 부분을 맞춘다. 본 계획의 요청 바디는 현행 Images API 기준 추정값이다.

---

## File Structure

**신규 파일**
- `src/lib/thumbnails/types.ts` — `ThumbnailStyle`, `ThumbnailCandidate`, `ThumbnailText` 타입
- `src/lib/thumbnails/scripture.ts` — `summary`에서 성경구절 추출(순수 함수)
- `src/lib/thumbnails/scripture.test.ts`
- `src/lib/thumbnails/compose-text.ts` — 스타일별 문구 자동 채움(정통형 추출 / 후킹형 Gemini)
- `src/lib/thumbnails/compose-text.test.ts`
- `src/lib/thumbnails/headline.ts` — 후킹형 Gemini 헤드라인 생성
- `src/lib/thumbnails/generate-background.ts` — gpt-image-2 배경 생성
- `src/lib/thumbnails/generate-background.test.ts`
- `src/lib/thumbnails/remove-background.ts` — 누끼 추상화
- `src/lib/thumbnails/render.tsx` — ImageResponse 오버레이 → PNG Buffer
- `src/lib/thumbnails/store.ts` — 후보 R2 업로드 + 원자적 jsonb append
- `src/lib/actions/thumbnails.ts` — Server Actions(생성/적용/되돌리기/조회)
- `src/lib/actions/thumbnails.test.ts` — applyThumbnailAction 임의 URL 차단 테스트
- `src/components/admin/ThumbnailModal.tsx` — 모달 컨테이너
- `src/components/admin/ThumbnailStyleTab.tsx` — 탭 1개(문구편집 + 미리보기 + 생성)

**수정 파일**
- `src/lib/db/schema.ts` — `customThumbnailUrl`, `thumbnailCandidates` 컬럼
- `src/lib/types.ts` — `Sermon`에 `customThumbnailUrl` 등 반영(필요 시)
- `src/lib/data/sermons.ts` — `toSermon` 폴백에 customThumbnailUrl 우선
- `src/components/admin/SermonEditForm.tsx` — "썸네일 생성" 버튼 + 모달 연결
- `src/app/admin/sermons/[id]/edit/page.tsx` — 신규 props 전달
- `src/lib/r2.ts` — `allowedKeyPrefixes`에 `thumbnails/` 추가
- `.env.example` — `OPENAI_API_KEY` (누끼 hosted API 채택 시 `REMOVE_BG_API_KEY`)

---

## Task 1: 스키마 — 커스텀 썸네일 컬럼 + 후보 이력

**Files:**
- Modify: `src/lib/db/schema.ts:36-63` (sermons 테이블)
- Create: `src/lib/thumbnails/types.ts`
- Migration: `drizzle/` (자동 생성)

- [ ] **Step 1: 썸네일 타입 정의**

`src/lib/thumbnails/types.ts` 생성:

```ts
export type ThumbnailStyle = 'classic' | 'hook' | 'cutout'

export const THUMBNAIL_STYLES: ThumbnailStyle[] = ['classic', 'hook', 'cutout']

export const THUMBNAIL_STYLE_LABELS: Record<ThumbnailStyle, string> = {
  classic: '정통형',
  hook: '후킹형',
  cutout: '인물컷형',
}

export interface ThumbnailCandidate {
  style: ThumbnailStyle
  url: string
  createdAt: string
}

export interface ThumbnailText {
  headline: string
  scripture: string
}
```

- [ ] **Step 2: 스키마에 컬럼 추가**

`src/lib/db/schema.ts`의 sermons 테이블에서 `thumbnailUrl` 줄(47) 다음에 추가. 파일 상단에 `ThumbnailCandidate` import 필요:

```ts
// 파일 상단 import 블록에 추가
import type { ThumbnailCandidate } from '@/lib/thumbnails/types'
```

```ts
  // sermons 테이블 thumbnailUrl 아래에 추가
  customThumbnailUrl: text('custom_thumbnail_url'),
  thumbnailCandidates: jsonb('thumbnail_candidates').$type<ThumbnailCandidate[]>(),
```

(`jsonb`는 이미 schema.ts에서 import되어 있음 — chapters/quickSummary에서 사용 중)

- [ ] **Step 3: 마이그레이션 생성**

Run: `npm run db:generate`
Expected: `drizzle/` 아래 새 `.sql` 파일 생성, `custom_thumbnail_url`/`thumbnail_candidates` ADD COLUMN 포함. 콘솔에 새 마이그레이션명 출력.

- [ ] **Step 4: 마이그레이션 적용**

Run: `npm run db:migrate`
Expected: 적용 성공 로그. 에러 없음.

- [ ] **Step 5: 타입 점검**

Run: `npx tsc --noEmit`
Expected: 통과(신규 import 경로 정상).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/thumbnails/types.ts drizzle/
git commit -m "feat: 설교 커스텀 썸네일·후보 이력 컬럼 추가"
```

---

## Task 2: 공개 폴백 — customThumbnailUrl 우선 표시

**Files:**
- Modify: `src/lib/data/sermons.ts:6-23` (SermonListRow), `:25-41` (sermonColumns), `:54-75` (toSermon)
- Test: `src/lib/data/sermons.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/data/sermons.test.ts`에 추가(기존 테스트 패턴 따름). 먼저 파일 상단의 `toSermon`/`SermonListRow` import 확인 후 케이스 추가:

```ts
import { toSermon, type SermonListRow } from './sermons'

function baseRow(overrides: Partial<SermonListRow> = {}): SermonListRow {
  return {
    id: 'id-1', title: '제목', displayTitle: null, preacher: '김선찬 담임목사',
    worshipType: '주일예배', sermonDate: '2026-06-21',
    videoUrl: 'https://youtu.be/abc123', thumbnailUrl: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
    customThumbnailUrl: null, summary: null, isPublished: true,
    youtubeVideoId: 'abc123', durationSeconds: null, quickSummary: null,
    chapters: null, summaryStatus: 'ready',
    ...overrides,
  }
}

it('customThumbnailUrl이 있으면 우선 사용한다', () => {
  const s = toSermon(baseRow({ customThumbnailUrl: 'https://r2.example/thumbnails/x.png' }))
  expect(s.thumbnailUrl).toBe('https://r2.example/thumbnails/x.png')
})

it('customThumbnailUrl이 없으면 기존 thumbnailUrl을 사용한다', () => {
  const s = toSermon(baseRow({ customThumbnailUrl: null }))
  expect(s.thumbnailUrl).toBe('https://img.youtube.com/vi/abc123/hqdefault.jpg')
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/data/sermons.test.ts`
Expected: FAIL — `customThumbnailUrl` 속성이 `SermonListRow`에 없어 타입/런타임 에러.

- [ ] **Step 3: 최소 구현**

`src/lib/data/sermons.ts` 3곳 수정.

`SermonListRow`(Pick 목록)에 `'customThumbnailUrl'` 추가:

```ts
export type SermonListRow = Pick<
  SermonRow,
  | 'id' | 'title' | 'displayTitle' | 'preacher' | 'worshipType' | 'sermonDate'
  | 'videoUrl' | 'thumbnailUrl' | 'customThumbnailUrl' | 'summary' | 'isPublished'
  | 'youtubeVideoId' | 'durationSeconds' | 'quickSummary' | 'chapters' | 'summaryStatus'
>
```

`sermonColumns`에 추가:

```ts
  thumbnailUrl: sermonsTable.thumbnailUrl,
  customThumbnailUrl: sermonsTable.customThumbnailUrl,
```

`toSermon` thumbnailUrl 계산 수정(67-68줄):

```ts
    thumbnailUrl:
      row.customThumbnailUrl ??
      row.thumbnailUrl ??
      (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : undefined),
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/data/sermons.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/sermons.ts src/lib/data/sermons.test.ts
git commit -m "feat: 공개 썸네일에 customThumbnailUrl 우선 적용"
```

---

## Task 3: 성경구절 추출(순수 함수)

**Files:**
- Create: `src/lib/thumbnails/scripture.ts`, `src/lib/thumbnails/scripture.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/thumbnails/scripture.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractScripture } from './scripture'

describe('extractScripture', () => {
  it('한글 책이름 + 장:절을 추출한다', () => {
    expect(extractScripture('고난 중에도 감사하라 (마태복음 5:3)')).toBe('마태복음 5:3')
  })
  it('절 범위(5:3-5)도 추출한다', () => {
    expect(extractScripture('요한복음 3:16-17 핵심 메시지')).toBe('요한복음 3:16-17')
  })
  it('숫자 들어간 책이름(고린도전서)도 추출한다', () => {
    expect(extractScripture('사랑장 고린도전서 13:4 묵상')).toBe('고린도전서 13:4')
  })
  it('구절이 없으면 빈 문자열을 반환한다', () => {
    expect(extractScripture('오늘의 은혜로운 말씀')).toBe('')
  })
  it('null/undefined는 빈 문자열', () => {
    expect(extractScripture(null)).toBe('')
    expect(extractScripture(undefined)).toBe('')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/thumbnails/scripture.test.ts`
Expected: FAIL — `extractScripture` 미정의.

- [ ] **Step 3: 최소 구현**

`src/lib/thumbnails/scripture.ts`:

```ts
// 한국어 성경 책이름(접두 숫자 포함) + "장:절" 또는 "장:절-절" 패턴.
// 예: 마태복음 5:3, 고린도전서 13:4, 요한복음 3:16-17
const SCRIPTURE_RE = /([1-3]?[가-힣]{1,6})\s*(\d{1,3}:\d{1,3}(?:-\d{1,3})?)/

export function extractScripture(summary: string | null | undefined): string {
  if (!summary) return ''
  const m = summary.match(SCRIPTURE_RE)
  return m ? `${m[1]} ${m[2]}` : ''
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/thumbnails/scripture.test.ts`
Expected: PASS (5 케이스).

- [ ] **Step 5: Commit**

```bash
git add src/lib/thumbnails/scripture.ts src/lib/thumbnails/scripture.test.ts
git commit -m "feat: summary에서 성경구절 추출 유틸 추가"
```

---

## Task 4: 스타일별 문구 자동 채움(정통형/인물컷형 우선)

**Files:**
- Create: `src/lib/thumbnails/compose-text.ts`, `src/lib/thumbnails/compose-text.test.ts`
- Create: `src/lib/thumbnails/headline.ts` (후킹형 Gemini — Task 4에서 인터페이스만, 호출은 Step 3 주입)

**설계:** `composeThumbnailText`는 `headlineFn`(후킹형 헤드라인 생성기)을 **주입**받아 테스트에서 모킹한다. 정통형/인물컷형은 `displayTitle ?? title`을 헤드라인으로, summary 구절을 scripture로 채운다. 후킹형만 `headlineFn` 호출.

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/thumbnails/compose-text.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { composeThumbnailText } from './compose-text'

const sermon = {
  title: '원제목',
  displayTitle: '새 사람의 DNA',
  summary: '변화된 삶 (고린도후서 5:17)',
  quickSummary: ['포인트1', '포인트2'],
}

describe('composeThumbnailText', () => {
  it('정통형: displayTitle + 추출 구절', async () => {
    const r = await composeThumbnailText('classic', sermon, vi.fn())
    expect(r).toEqual({ headline: '새 사람의 DNA', scripture: '고린도후서 5:17' })
  })

  it('인물컷형: 정통형과 동일하게 채운다', async () => {
    const r = await composeThumbnailText('cutout', sermon, vi.fn())
    expect(r).toEqual({ headline: '새 사람의 DNA', scripture: '고린도후서 5:17' })
  })

  it('displayTitle 없으면 title 사용', async () => {
    const r = await composeThumbnailText('classic', { ...sermon, displayTitle: null }, vi.fn())
    expect(r.headline).toBe('원제목')
  })

  it('후킹형: headlineFn 결과를 headline으로 사용', async () => {
    const headlineFn = vi.fn().mockResolvedValue('이게 진짜 복입니다')
    const r = await composeThumbnailText('hook', sermon, headlineFn)
    expect(headlineFn).toHaveBeenCalledWith(sermon)
    expect(r).toEqual({ headline: '이게 진짜 복입니다', scripture: '고린도후서 5:17' })
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/thumbnails/compose-text.test.ts`
Expected: FAIL — `composeThumbnailText` 미정의.

- [ ] **Step 3: 최소 구현**

`src/lib/thumbnails/compose-text.ts`:

```ts
import { extractScripture } from './scripture'
import type { ThumbnailStyle, ThumbnailText } from './types'

export interface ComposeSermonInput {
  title: string
  displayTitle?: string | null
  summary?: string | null
  quickSummary?: string[] | null
}

export type HeadlineFn = (sermon: ComposeSermonInput) => Promise<string>

export async function composeThumbnailText(
  style: ThumbnailStyle,
  sermon: ComposeSermonInput,
  headlineFn: HeadlineFn,
): Promise<ThumbnailText> {
  const scripture = extractScripture(sermon.summary)
  if (style === 'hook') {
    const headline = await headlineFn(sermon)
    return { headline, scripture }
  }
  return { headline: sermon.displayTitle?.trim() || sermon.title, scripture }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/thumbnails/compose-text.test.ts`
Expected: PASS (4 케이스).

- [ ] **Step 5: 후킹형 Gemini 헤드라인 구현(통합)**

`src/lib/thumbnails/headline.ts` — 기존 `@google/genai` 패턴(`src/lib/ai/sermon-summary.ts` 참고)으로 작성. 자체 테스트는 모킹 비용 대비 가치 낮아 생략, 수동 통합 확인:

```ts
import { GoogleGenAI } from '@google/genai'
import { DEFAULT_GEMINI_MODEL } from '@/lib/ai/sermon-summary'
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
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL
  const ai = new GoogleGenAI({ apiKey })
  const body = [sermon.summary, ...(sermon.quickSummary ?? [])].filter(Boolean).join('\n')
  const res = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: PROMPT + body }] }],
    config: { temperature: 0.7 },
  })
  const text = res.text?.trim()
  if (!text) throw new Error('gemini returned empty headline')
  return text.split('\n')[0].slice(0, 24)
}
```

- [ ] **Step 6: 타입 점검**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 7: Commit**

```bash
git add src/lib/thumbnails/compose-text.ts src/lib/thumbnails/compose-text.test.ts src/lib/thumbnails/headline.ts
git commit -m "feat: 스타일별 썸네일 문구 구성(정통/인물컷 추출, 후킹 Gemini)"
```

---

## Task 5: 배경 이미지 생성(gpt-image-2)

**Files:**
- Create: `src/lib/thumbnails/generate-background.ts`, `src/lib/thumbnails/generate-background.test.ts`
- Modify: `.env.example`

> ⚠ 구현 전 OpenAI 공식 문서로 `gpt-image-2` 모델 ID·엔드포인트·`size`·응답 키(`b64_json`/`url`) 확인. 아래는 현행 Images API 추정값.

- [ ] **Step 1: `.env.example`에 키 추가**

`.env.example`의 Gemini 블록 위/아래에:

```
# OpenAI — 썸네일 배경 이미지 생성(gpt-image-2)
OPENAI_API_KEY=your_openai_api_key
```

- [ ] **Step 2: 실패 테스트 작성(fetch 모킹)**

`src/lib/thumbnails/generate-background.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateBackground } from './generate-background'

describe('generateBackground', () => {
  beforeEach(() => { process.env.OPENAI_API_KEY = 'test-key' })
  afterEach(() => { vi.restoreAllMocks(); delete process.env.OPENAI_API_KEY })

  it('OPENAI_API_KEY 없으면 에러', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(generateBackground('classic')).rejects.toThrow('OPENAI_API_KEY')
  })

  it('b64 응답을 Buffer로 디코드한다', async () => {
    const b64 = Buffer.from('PNGDATA').toString('base64')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: b64 }] }),
    }))
    const buf = await generateBackground('classic')
    expect(buf.toString()).toBe('PNGDATA')
  })

  it('API 실패 시 에러를 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => 'server error',
    }))
    await expect(generateBackground('classic')).rejects.toThrow()
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/lib/thumbnails/generate-background.test.ts`
Expected: FAIL — `generateBackground` 미정의.

- [ ] **Step 4: 최소 구현**

`src/lib/thumbnails/generate-background.ts`:

```ts
import 'server-only'
import type { ThumbnailStyle } from './types'

// 스타일별 배경 분위기 프롬프트. 글자/텍스트는 절대 넣지 않도록 명시.
const BACKGROUND_PROMPT: Record<ThumbnailStyle, string> = {
  classic:
    'A serene, reverent church worship background. Soft warm light, subtle cross or stained-glass bokeh, muted gradient. Cinematic, uncluttered, leaves empty space for text. Absolutely no text, no letters, no words.',
  hook:
    'A modern, vibrant Christian YouTube thumbnail background. Dramatic light rays, bold but tasteful gradient, depth of field. Energetic yet reverent. Leaves empty space for text. Absolutely no text, no letters, no words.',
  cutout:
    'A clean studio-style gradient backdrop for a portrait, warm spotlight, soft vignette, church mood. Plain on one side for a person cutout and text. Absolutely no text, no letters, no words.',
}

export async function generateBackground(style: ThumbnailStyle): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  // ⚠ 모델 ID·파라미터는 OpenAI 문서로 확인 후 확정할 것.
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt: BACKGROUND_PROMPT[style],
      size: '1536x1024', // 16:9에 가까운 지원 사이즈로 생성 후 render 단계에서 1280x720로 맞춤
      n: 1,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`gpt-image-2 request failed: ${res.status} ${detail}`)
  }
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] }
  const first = json.data?.[0]
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64')
  if (first?.url) {
    const img = await fetch(first.url)
    if (!img.ok) throw new Error(`gpt-image-2 image download failed: ${img.status}`)
    return Buffer.from(await img.arrayBuffer())
  }
  throw new Error('gpt-image-2 returned no image data')
}
```

> **(codex 반영, [M])** 응답이 `url`/`b64_json` 어느 쪽이든 처리한다. 또한 생성 사이즈(예: 1536×1024, 3:2)와 최종 1280×720(16:9)의 종횡비가 달라 render 단계의 `object-fit: cover`가 상하를 자른다 — 배경 용도라 허용하되, gpt-image-2가 16:9에 가까운 size를 지원하면 그 값을 우선 사용하도록 모델 문서 확인 시 함께 정한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/lib/thumbnails/generate-background.test.ts`
Expected: PASS (3 케이스).

- [ ] **Step 6: Commit**

```bash
git add src/lib/thumbnails/generate-background.ts src/lib/thumbnails/generate-background.test.ts .env.example
git commit -m "feat: gpt-image-2 배경 생성 모듈 추가"
```

---

## Task 6: 누끼(배경제거) 추상화

**Files:**
- Create: `src/lib/thumbnails/remove-background.ts`
- Modify: `package.json` (의존성 추가)

> ⚠ **(codex 반영, [H]) 런타임 실현성 먼저 검증.** `@imgly/background-removal-node`는 ONNX 모델(수백 MB)을 받아 Vercel 서버리스 함수의 **번들 크기·콜드스타트·메모리·실행시간(기본 10~60s) 한계**에 걸릴 수 있다. 품질뿐 아니라 **Vercel에서 실행 자체가 가능한지**가 리스크다. 따라서 Task 6은 **Step 0 스파이크로 시작**하고, 통과 못 하면 hosted API(remove.bg 등)로 전환한다. 어느 경우든 `removeBackground(imageUrl): Promise<Buffer>` 인터페이스는 동일하게 유지(구현체 교체 가능). 자체 단위테스트는 모델 의존성 때문에 생략, 수동 통합 확인.

- [ ] **Step 0: 실현성 스파이크 (게이트)**

로컬에서 `removeBackground` 임시 스크립트로 유튜브 썸네일 1장을 처리해 (1) 동작 여부 (2) 인물 분리 품질 (3) 소요시간/메모리를 측정. 그리고 이 액션이 도는 라우트/액션에 `export const maxDuration = 60`(또는 적정값) 설정 가능 여부 확인.
- 동작·품질 OK → Step 1(로컬 라이브러리)로 진행.
- 실패/품질 불충분 → hosted API 경로 채택: `REMOVE_BG_API_KEY`를 `.env.example`에 추가하고 Step 2 구현체를 remove.bg fetch 호출로 대체(인터페이스 동일).

- [ ] **Step 1: 의존성 설치 (로컬 라이브러리 경로 선택 시)**

Run: `npm install @imgly/background-removal-node`
Expected: package.json dependencies에 추가, 설치 성공.

- [ ] **Step 2: 구현**

`src/lib/thumbnails/remove-background.ts` (로컬 라이브러리 경로):

```ts
import 'server-only'

/**
 * 이미지 URL(여기서는 유튜브 썸네일)에서 배경을 제거해 투명 PNG Buffer를 반환한다.
 * 구현체는 교체 가능 — 현재는 @imgly/background-removal-node 사용.
 * Vercel 한계로 부적합하면 hosted API(remove.bg) fetch 구현으로 교체.
 */
export async function removeBackground(imageUrl: string): Promise<Buffer> {
  const { removeBackground: imglyRemove } = await import('@imgly/background-removal-node')
  const blob = await imglyRemove(imageUrl, { output: { format: 'image/png' } })
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
```

- [ ] **Step 3: 타입 점검**

Run: `npx tsc --noEmit`
Expected: 통과. (타입 미제공 시 `// @ts-expect-error` 또는 `src/types/`에 모듈 선언 추가.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/thumbnails/remove-background.ts package.json package-lock.json
git commit -m "feat: 누끼(배경제거) 추상화 모듈 추가"
```

---

## Task 7: 오버레이 렌더(next/og ImageResponse → PNG)

**Files:**
- Create: `src/lib/thumbnails/render.tsx`

> `next/og`의 `ImageResponse`는 Satori 기반으로 한글을 렌더하려면 폰트 데이터(ArrayBuffer)를 명시 전달해야 한다. 기존 의존성 `pretendard`의 ttf를 `fs`로 읽는다.
>
> **(codex 반영, [H]) 검증된 실제 경로:** ttf는 `node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf`에 있다(루트 `static/`엔 `.otf`만). 아래 코드는 이 경로로 확정한다.
>
> **runtime 주의:** 이 모듈은 `fs` 사용 + server action 호출이므로 **Node.js 런타임에서만** 동작한다(Edge 금지). 호출 라우트/액션이 Edge로 추론되지 않도록 하고, ImageResponse의 폰트는 우리가 직접 주입하므로 Edge 번들 500KB 제한과 무관하다. Step 2에서 실제 PNG를 디스크로 떨궈 한글 렌더를 눈으로 확인한다.

- [ ] **Step 1: 구현**

`src/lib/thumbnails/render.tsx`:

```tsx
import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'
import type { ThumbnailText } from './types'

const WIDTH = 1280
const HEIGHT = 720

let fontCache: { bold: ArrayBuffer } | null = null

async function loadFonts() {
  if (fontCache) return fontCache
  // 검증된 실제 ttf 경로 (codex 반영)
  const boldPath = path.join(
    process.cwd(),
    'node_modules/pretendard/dist/public/static/alternative/Pretendard-Bold.ttf',
  )
  const bold = await readFile(boldPath)
  fontCache = { bold: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength) }
  return fontCache
}

export interface RenderInput extends ThumbnailText {
  backgroundDataUrl: string // data:image/png;base64,... 또는 공개 URL
  cutoutDataUrl?: string // 인물컷형 전경(투명 PNG) data URL
}

export async function renderThumbnail(input: RenderInput): Promise<Buffer> {
  const { bold } = await loadFonts()
  const response = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', position: 'relative', fontFamily: 'Pretendard',
        }}
      >
        <img
          src={input.backgroundDataUrl}
          width={WIDTH} height={HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute', top: 0, left: 0, width: WIDTH, height: HEIGHT,
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 100%)',
          }}
        />
        {input.cutoutDataUrl ? (
          <img
            src={input.cutoutDataUrl}
            height={HEIGHT}
            style={{ position: 'absolute', right: 24, bottom: 0, objectFit: 'contain' }}
          />
        ) : null}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: 56, gap: 16 }}>
          {input.scripture ? (
            <span style={{ fontSize: 38, color: '#ffd966', fontWeight: 700 }}>{input.scripture}</span>
          ) : null}
          <span style={{ fontSize: 76, color: '#ffffff', fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>
            {input.headline}
          </span>
        </div>
      </div>
    ),
    {
      width: WIDTH, height: HEIGHT,
      fonts: [{ name: 'Pretendard', data: bold, weight: 700, style: 'normal' }],
    },
  )
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export function toDataUrl(buffer: Buffer, mime = 'image/png'): string {
  return `data:${mime};base64,${buffer.toString('base64')}`
}
```

- [ ] **Step 2: 타입/빌드 점검**

Run: `npx tsc --noEmit`
Expected: 통과. (`next/og` 타입 인식 확인.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/thumbnails/render.tsx
git commit -m "feat: ImageResponse 기반 썸네일 오버레이 렌더 추가"
```

---

## Task 8: 후보 저장(R2) + 원자적 이력 갱신

**Files:**
- Create: `src/lib/thumbnails/store.ts`
- Modify: `src/lib/r2.ts:11` (allowedKeyPrefixes)

> **(codex 반영, [H]) 동시성:** read-modify-write 대신 단일 UPDATE의 jsonb `||` concat으로 **원자적 append**한다 → 동시 생성 시 후보 유실 race 제거. 이 때문에 별도 순수 `appendCandidate` 헬퍼는 두지 않는다(DB가 직접 concat).
>
> **(codex 반영, [M]) prefix 정합성:** R2 키를 `thumbnails/`로 쓰므로 `keyFromUrl()`의 `allowedKeyPrefixes`에 `'thumbnails/'`를 추가해 향후 URL→key 역변환/정리 작업이 가능하게 한다.

- [ ] **Step 1: keyFromUrl 허용 prefix 확장**

`src/lib/r2.ts:11` 수정:

```ts
const allowedKeyPrefixes = ['bulletins/', 'gallery/', 'thumbnails/'] as const
```

- [ ] **Step 2: store 구현(R2 업로드 + 원자적 DB concat)**

`src/lib/thumbnails/store.ts`:

```ts
import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { uploadToR2 } from '@/lib/r2'
import type { ThumbnailCandidate, ThumbnailStyle } from './types'

function candidateKey(sermonId: string, style: ThumbnailStyle): string {
  return `thumbnails/candidates/${sermonId}/${style}-${Date.now()}.png`
}

/** 후보 PNG를 R2에 올리고 thumbnailCandidates에 원자적으로 append. 저장된 candidate 반환. */
export async function storeCandidate(
  sermonId: string,
  style: ThumbnailStyle,
  png: Buffer,
): Promise<ThumbnailCandidate> {
  const url = await uploadToR2(png, candidateKey(sermonId, style), 'image/png')
  const candidate: ThumbnailCandidate = { style, url, createdAt: new Date().toISOString() }

  // 원자적 append: 단일 UPDATE의 jsonb concat → read-modify-write race 없음.
  const updated = await db
    .update(sermons)
    .set({
      thumbnailCandidates: sql`coalesce(${sermons.thumbnailCandidates}, '[]'::jsonb) || ${JSON.stringify([candidate])}::jsonb`,
    })
    .where(eq(sermons.id, sermonId))
    .returning({ id: sermons.id })
  if (updated.length === 0) throw new Error('sermon not found')
  return candidate
}
```

- [ ] **Step 3: 타입 점검**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 4: Commit**

```bash
git add src/lib/thumbnails/store.ts src/lib/r2.ts
git commit -m "feat: 썸네일 후보 R2 저장·원자적 이력 누적 추가"
```

---

## Task 9: Server Actions(생성/적용/되돌리기/조회)

**Files:**
- Create: `src/lib/actions/thumbnails.ts`

- [ ] **Step 1: 구현**

`src/lib/actions/thumbnails.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { sermons } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import { composeThumbnailText } from '@/lib/thumbnails/compose-text'
import { geminiHeadline } from '@/lib/thumbnails/headline'
import { generateBackground } from '@/lib/thumbnails/generate-background'
import { removeBackground } from '@/lib/thumbnails/remove-background'
import { renderThumbnail, toDataUrl } from '@/lib/thumbnails/render'
import { storeCandidate } from '@/lib/thumbnails/store'
import type { ThumbnailCandidate, ThumbnailStyle, ThumbnailText } from '@/lib/thumbnails/types'

function revalidate(id: string) {
  revalidatePath('/')
  revalidatePath('/sermons')
  revalidatePath(`/sermons/${id}`)
  revalidatePath('/admin/sermons')
  revalidatePath(`/admin/sermons/${id}/edit`)
}

/** 탭 열 때 문구 자동 채움용. AI 헤드라인은 후킹형일 때만 호출. */
export async function suggestThumbnailTextAction(id: string, style: ThumbnailStyle): Promise<ThumbnailText> {
  await requireAdmin()
  const [row] = await db
    .select({ title: sermons.title, displayTitle: sermons.displayTitle, summary: sermons.summary, quickSummary: sermons.quickSummary })
    .from(sermons).where(eq(sermons.id, id)).limit(1)
  if (!row) throw new Error('sermon not found')
  return composeThumbnailText(style, row, geminiHeadline)
}

export interface GenerateThumbnailResult {
  candidate: ThumbnailCandidate
}

/** 관리자가 편집한 문구(text)로 배경+오버레이 생성 후 후보 저장. */
export async function generateThumbnailAction(
  id: string,
  style: ThumbnailStyle,
  text: ThumbnailText,
): Promise<GenerateThumbnailResult> {
  const session = await requireAdmin()

  const background = await generateBackground(style)
  let cutoutDataUrl: string | undefined
  if (style === 'cutout') {
    const [row] = await db.select({ thumbnailUrl: sermons.thumbnailUrl }).from(sermons).where(eq(sermons.id, id)).limit(1)
    if (row?.thumbnailUrl) {
      const cutout = await removeBackground(row.thumbnailUrl)
      cutoutDataUrl = toDataUrl(cutout)
    }
  }

  const png = await renderThumbnail({
    headline: text.headline,
    scripture: text.scripture,
    backgroundDataUrl: toDataUrl(background),
    cutoutDataUrl,
  })

  const candidate = await storeCandidate(id, style, png)
  await log('create', 'sermon', id, `thumbnail:${style}`, session.user.id)
  revalidate(id)
  return { candidate }
}

export async function applyThumbnailAction(id: string, url: string): Promise<void> {
  const session = await requireAdmin()

  // (codex 반영, [H]) 임의 URL 차단: 반드시 이 설교의 thumbnailCandidates에 존재하는 URL만 확정 가능.
  const [row] = await db
    .select({ candidates: sermons.thumbnailCandidates })
    .from(sermons).where(eq(sermons.id, id)).limit(1)
  if (!row) throw new Error('sermon not found')
  const allowed = (row.candidates ?? []).some((c) => c.url === url)
  if (!allowed) throw new Error('이 설교의 생성된 후보 URL만 적용할 수 있습니다')

  await db.update(sermons).set({ customThumbnailUrl: url }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, 'thumbnail:apply', session.user.id)
  revalidate(id)
}

export async function resetThumbnailAction(id: string): Promise<void> {
  const session = await requireAdmin()
  await db.update(sermons).set({ customThumbnailUrl: null }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, 'thumbnail:reset', session.user.id)
  revalidate(id)
}
```

> `log(...)`의 인자 형식은 기존 `src/lib/actions/sermons.ts`의 `log('update','sermon',id,detail,userId)` 사용처와 일치시킨다. 시그니처가 다르면 그쪽 호출에 맞춰 수정.
>
> **(codex 반영, [H]) authz 범위:** 모든 액션은 기존 컨벤션대로 `requireAdmin()` chokepoint를 통과한다. 단 `requireAdmin`은 현재 role 검사 없이 세션만 확인한다(`src/lib/dal.ts:16` — profiles.role 미연결, **의도된 기존 제약**). 이는 본 기능이 만든 결함이 아니며 프로젝트 전역 admin 액션과 동일하다. 향후 role 연결은 별도 작업으로 분리(스코프 밖). 신규 액션은 이 제약을 **악화시키지 않고** 동일 chokepoint를 재사용한다.

- [ ] **Step 2: applyThumbnailAction 임의 URL 차단 테스트**

`src/lib/actions/thumbnails.test.ts` — `requireAdmin`/`db`/`log`를 모킹하고, 후보 목록에 없는 URL을 넘기면 throw, 있는 URL이면 update 호출됨을 검증한다. (vitest `vi.mock('@/lib/dal')`, `vi.mock('@/lib/db')` 패턴. db는 select가 candidates를 반환하도록 모킹.)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/dal', () => ({ requireAdmin: vi.fn().mockResolvedValue({ user: { id: 'admin-1' } }) }))
vi.mock('@/lib/logger', () => ({ log: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const selectLimit = vi.fn()
const updateWhere = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
    update: () => ({ set: () => ({ where: updateWhere }) }),
  },
}))

import { applyThumbnailAction } from './thumbnails'

beforeEach(() => { vi.clearAllMocks() })

it('후보에 없는 URL이면 거부한다', async () => {
  selectLimit.mockResolvedValue([{ candidates: [{ style: 'classic', url: 'good', createdAt: 'x' }] }])
  await expect(applyThumbnailAction('s1', 'evil://x')).rejects.toThrow('후보 URL만')
  expect(updateWhere).not.toHaveBeenCalled()
})

it('후보에 있는 URL이면 customThumbnailUrl을 업데이트한다', async () => {
  selectLimit.mockResolvedValue([{ candidates: [{ style: 'classic', url: 'good', createdAt: 'x' }] }])
  await applyThumbnailAction('s1', 'good')
  expect(updateWhere).toHaveBeenCalled()
})
```

> 에러 메시지 매칭(`'후보 URL만'`)이 구현 문구와 맞도록 한다. db 모킹 체인이 실제 drizzle 호출 순서와 어긋나면 구현에 맞춰 모킹 형태를 조정.

- [ ] **Step 3: 테스트 실행**

Run: `npx vitest run src/lib/actions/thumbnails.test.ts`
Expected: 2 케이스 PASS.

- [ ] **Step 4: 타입 점검**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/thumbnails.ts src/lib/actions/thumbnails.test.ts
git commit -m "feat: 썸네일 생성·적용·초기화 server action 추가"
```

---

## Task 10: 관리자 UI — 버튼 + 모달 + 탭

**Files:**
- Create: `src/components/admin/ThumbnailStyleTab.tsx`, `src/components/admin/ThumbnailModal.tsx`
- Modify: `src/components/admin/SermonEditForm.tsx:10-27` (props + 버튼), `src/app/admin/sermons/[id]/edit/page.tsx:15-27` (props 전달)

> React 함수 50줄 규칙 준수(분리). 모달 상태는 SermonEditForm가 보유하고, 탭 컴포넌트는 단일 스타일을 담당.

- [ ] **Step 1: 탭 컴포넌트 구현**

`src/components/admin/ThumbnailStyleTab.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import {
  generateThumbnailAction, suggestThumbnailTextAction,
} from '@/lib/actions/thumbnails'
import type { ThumbnailCandidate, ThumbnailStyle, ThumbnailText } from '@/lib/thumbnails/types'

interface Props {
  sermonId: string
  style: ThumbnailStyle
  description: string
  existing?: ThumbnailCandidate
  onApply: (url: string) => void
  applying: boolean
}

export default function ThumbnailStyleTab({ sermonId, style, description, existing, onApply, applying }: Props) {
  const [text, setText] = useState<ThumbnailText>({ headline: '', scripture: '' })
  const [preview, setPreview] = useState<string | undefined>(existing?.url)
  const [loaded, setLoaded] = useState(false)
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()

  function autofill() {
    start(async () => {
      try { setText(await suggestThumbnailTextAction(sermonId, style)); setLoaded(true) }
      catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
    })
  }

  function generate() {
    setMsg('')
    start(async () => {
      try {
        const { candidate } = await generateThumbnailAction(sermonId, style, text)
        setPreview(candidate.url)
      } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{description}</p>
      {!loaded && !existing ? (
        <button type="button" onClick={autofill} disabled={pending}
          className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-50">
          문구 불러오기
        </button>
      ) : (
        <div className="grid gap-2">
          <input className="rounded-md border border-line px-3 py-2 text-sm" placeholder="헤드라인"
            value={text.headline} onChange={(e) => setText((t) => ({ ...t, headline: e.target.value }))} />
          <input className="rounded-md border border-line px-3 py-2 text-sm" placeholder="성경구절"
            value={text.scripture} onChange={(e) => setText((t) => ({ ...t, scripture: e.target.value }))} />
        </div>
      )}
      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="썸네일 미리보기" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-faint">아직 생성되지 않음</span>
        )}
      </div>
      <p className="text-xs text-amber-600">⚠ 생성 시 OpenAI 이미지 비용이 발생합니다.</p>
      <div className="flex gap-2">
        <button type="button" onClick={generate} disabled={pending}
          className="rounded-md bg-accent-deep px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          {preview ? '재생성' : '썸네일 생성'}
        </button>
        {preview && (
          <button type="button" onClick={() => onApply(preview)} disabled={applying}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
            이 썸네일로 적용
          </button>
        )}
        {msg && <span className="self-center text-sm text-red-600">{msg}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 모달 컴포넌트 구현**

`src/components/admin/ThumbnailModal.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { applyThumbnailAction, resetThumbnailAction } from '@/lib/actions/thumbnails'
import { THUMBNAIL_STYLES, THUMBNAIL_STYLE_LABELS, type ThumbnailCandidate, type ThumbnailStyle } from '@/lib/thumbnails/types'
import ThumbnailStyleTab from './ThumbnailStyleTab'

const DESCRIPTIONS: Record<ThumbnailStyle, string> = {
  classic: '설교 제목 + 성경구절을 단정하게 배치합니다.',
  hook: 'AI가 만든 짧은 헤드라인 + 성경구절로 클릭을 유도합니다.',
  cutout: '제목·구절에 더해 유튜브 썸네일에서 인물을 따내 합성합니다.',
}

interface Props {
  sermonId: string
  candidates: ThumbnailCandidate[]
  onClose: () => void
}

function latest(candidates: ThumbnailCandidate[], style: ThumbnailStyle) {
  return [...candidates].reverse().find((c) => c.style === style)
}

export default function ThumbnailModal({ sermonId, candidates, onClose }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<ThumbnailStyle>('classic')
  const [pending, start] = useTransition()

  function apply(url: string) {
    start(async () => { await applyThumbnailAction(sermonId, url); router.refresh(); onClose() })
  }
  function reset() {
    start(async () => { await resetThumbnailAction(sermonId); router.refresh(); onClose() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-paper p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">썸네일 생성</h2>
          <button type="button" onClick={onClose} className="text-ink-muted">✕</button>
        </div>
        <div className="mb-4 flex gap-2 border-b border-line">
          {THUMBNAIL_STYLES.map((s) => (
            <button key={s} type="button" onClick={() => setTab(s)}
              className={`px-3 py-2 text-sm font-semibold ${tab === s ? 'border-b-2 border-accent text-accent-deep' : 'text-ink-muted'}`}>
              {THUMBNAIL_STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        <ThumbnailStyleTab key={tab} sermonId={sermonId} style={tab} description={DESCRIPTIONS[tab]}
          existing={latest(candidates, tab)} onApply={apply} applying={pending} />
        <div className="mt-6 border-t border-line pt-4">
          <button type="button" onClick={reset} disabled={pending}
            className="text-sm text-ink-muted underline disabled:opacity-50">
            유튜브 썸네일로 되돌리기
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: SermonEditForm에 버튼·모달 연결**

`src/components/admin/SermonEditForm.tsx` 수정:
- Props에 `candidates: ThumbnailCandidate[]` 추가(8-16줄 인터페이스).
- import 추가: `import ThumbnailModal from './ThumbnailModal'`, `import type { ThumbnailCandidate } from '@/lib/thumbnails/types'`.
- 모달 표시 상태 `const [thumbOpen, setThumbOpen] = useState(false)` 추가.
- "요약 재생성" 버튼 옆(119줄 이후)에 버튼 추가:

```tsx
        <button
          type="button"
          onClick={() => setThumbOpen(true)}
          className="rounded-md border border-line px-4 py-2 text-sm font-semibold"
        >
          썸네일 생성
        </button>
```

- 컴포넌트 return 최상위 `</div>` 직전에 모달 마운트:

```tsx
      {thumbOpen && (
        <ThumbnailModal sermonId={id} candidates={candidates} onClose={() => setThumbOpen(false)} />
      )}
```

- [ ] **Step 4: edit 페이지에서 candidates 전달**

`src/app/admin/sermons/[id]/edit/page.tsx`의 `<SermonEditForm ... />`에 prop 추가:

```tsx
        candidates={row.thumbnailCandidates ?? []}
```

> `getSermonForAdmin`(`src/lib/data/sermons.ts`)이 반환하는 `Sermon`에는 현재 `thumbnailCandidates`가 없다. 이 페이지는 `getSermonForAdmin`을 `@/lib/actions/sermons`에서 import한다 — 해당 함수(또는 admin 전용 조회)가 `thumbnailCandidates`를 포함하도록 select에 추가하고, 폼에 넘길 값을 마련한다. 가장 단순하게는 edit 페이지에서 `db`로 `thumbnailCandidates`만 별도 조회해 전달한다.

- [ ] **Step 5: 빌드/타입 점검**

Run: `npx tsc --noEmit && npm run lint`
Expected: 통과.

- [ ] **Step 6: 수동 통합 확인(로컬)**

Run: `npm run dev` → 관리자 로그인 → 설교 편집 → "썸네일 생성" → 정통형 탭에서 "문구 불러오기" → "썸네일 생성" → 미리보기 확인 → "이 썸네일로 적용" → `/sermons` 목록에서 교체 확인.
Expected: 정통형 end-to-end 동작. 후킹형/인물컷형도 각 탭에서 생성 확인.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/ThumbnailModal.tsx src/components/admin/ThumbnailStyleTab.tsx src/components/admin/SermonEditForm.tsx "src/app/admin/sermons/[id]/edit/page.tsx"
git commit -m "feat: 관리자 썸네일 생성 모달·탭 UI 추가"
```

---

## 최종 통합 점검

- [ ] **전체 테스트**

Run: `npm run test`
Expected: 신규 단위 테스트(scripture/compose-text/generate-background/thumbnails(action)/sermons) 포함 전체 PASS.

- [ ] **빌드**

Run: `npm run build`
Expected: 성공.
