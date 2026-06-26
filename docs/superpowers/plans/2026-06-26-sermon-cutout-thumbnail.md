# 인물컷형(누끼) 썸네일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 썸네일 모달의 인물컷형 탭이, AI 배경 위에 유튜브 썸네일에서 remove.bg로 따낸 인물 누끼를 합성해 정통형/후킹형과 동일하게 end-to-end로 동작하게 한다.

**Architecture:** 기존 "①배경 생성(유료) → ②CSS 라이브 프리뷰 → ③적용 시 PNG 합성" 흐름을 그대로 따른다. 인물 누끼는 유튜브 썸네일 파생이라 1회 추출해 R2+`sermon_thumbnails.thumbnail_cutout_url`에 캐시하고 재사용한다. `render.tsx`는 이미 `cutoutDataUrl`을 지원하므로 합성 코어는 수정하지 않고, 누끼 추출·저장·UI 배선·프리뷰 미러링만 추가한다.

**Tech Stack:** Next.js 16(App Router, Server Actions), TypeScript, Drizzle ORM(Neon `neon-http`), remove.bg REST, Cloudflare R2(`@aws-sdk/client-s3`), next/og ImageResponse(기존), vitest, npm.

**참고 스펙:** `docs/superpowers/specs/2026-06-26-sermon-cutout-thumbnail-design.md`

---

## File Structure

**신규 파일**
- `src/lib/thumbnails/remove-background.ts` — remove.bg 누끼 추상화(`removeBackground(imageUrl): Promise<Buffer>`)
- `src/lib/thumbnails/remove-background.test.ts` — fetch 모킹 단위 테스트
- `scripts/apply-thumbnail-cutout-column.ts` — `thumbnail_cutout_url` 컬럼 직접 적용(ycc는 drizzle-kit migrate 불가)

**수정 파일**
- `.env.example` — `REMOVE_BG_API_KEY`
- `src/lib/db/schema.ts` — `sermon_thumbnails.thumbnailCutoutUrl` 컬럼
- `src/lib/thumbnails/store.ts` — `storeCutout(sermonId, png)`
- `src/lib/actions/thumbnails.ts` — cutout 차단 제거, 누끼 생성/적용 분기
- `src/lib/actions/sermons.ts` — `getSermonForAdmin` select에 `thumbnailCutoutUrl`
- `src/app/admin/sermons/[id]/edit/page.tsx` — `cutoutUrl` prop 전달
- `src/components/admin/ThumbnailModal.tsx` — `cutoutUrl` prop + 설명문
- `src/components/admin/ThumbnailStyleTab.tsx` — `cutout` state/prop
- `src/components/admin/ThumbnailPreview.tsx` — 인물 전경 `<img>` 미러링

---

## Task 1: 누끼 모듈 + .env.example

**Files:**
- Create: `src/lib/thumbnails/remove-background.ts`
- Create: `src/lib/thumbnails/remove-background.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/thumbnails/remove-background.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { removeBackground } from './remove-background'

describe('removeBackground', () => {
  beforeEach(() => {
    process.env.REMOVE_BG_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete process.env.REMOVE_BG_API_KEY
  })

  it('REMOVE_BG_API_KEY 없으면 에러', async () => {
    delete process.env.REMOVE_BG_API_KEY
    await expect(removeBackground('https://x/y.jpg')).rejects.toThrow('REMOVE_BG_API_KEY')
  })

  it('200 응답을 Buffer로 반환한다', async () => {
    const bytes = new TextEncoder().encode('PNGDATA')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => bytes.buffer,
      })
    )
    const buf = await removeBackground('https://x/y.jpg')
    expect(buf.toString()).toBe('PNGDATA')
  })

  it('API 실패 시 에러를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => 'insufficient credits',
      })
    )
    await expect(removeBackground('https://x/y.jpg')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/thumbnails/remove-background.test.ts`
Expected: FAIL — `removeBackground` 미정의(모듈 없음).

- [ ] **Step 3: 최소 구현**

`src/lib/thumbnails/remove-background.ts`:

```ts
import 'server-only'

const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg'

/**
 * 이미지 URL(여기서는 유튜브 썸네일)에서 배경을 제거해 투명 PNG Buffer를 반환한다.
 * remove.bg REST API 사용. 구현체 교체 가능하도록 인터페이스를 단순 유지한다.
 */
export async function removeBackground(imageUrl: string): Promise<Buffer> {
  const apiKey = process.env.REMOVE_BG_API_KEY
  if (!apiKey) throw new Error('REMOVE_BG_API_KEY is not set')

  const form = new FormData()
  form.append('image_url', imageUrl)
  form.append('size', 'auto')
  form.append('format', 'png')

  const res = await fetch(REMOVE_BG_URL, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: form,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`remove.bg request failed: ${res.status} ${detail}`)
  }
  return Buffer.from(await res.arrayBuffer())
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/thumbnails/remove-background.test.ts`
Expected: PASS (3 케이스).

- [ ] **Step 5: `.env.example`에 키 추가**

`.env.example`의 OpenAI 블록 근처에 추가:

```
# remove.bg — 인물컷형 썸네일 누끼(배경 제거)
REMOVE_BG_API_KEY=your_remove_bg_api_key
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/thumbnails/remove-background.ts src/lib/thumbnails/remove-background.test.ts .env.example
git commit -m "feat: remove.bg 누끼(배경제거) 모듈 추가"
```

---

## Task 2: 스키마 — 누끼 캐시 컬럼

**Files:**
- Modify: `src/lib/db/schema.ts:90-95` (sermonThumbnails 테이블)
- Create: `scripts/apply-thumbnail-cutout-column.ts`
- Migration: `drizzle/` (자동 생성)

> ⚠ ycc는 `drizzle-kit migrate`가 journal↔DB 불일치로 작동하지 않는다. 마이그레이션 SQL은 이력 기록용으로 생성하되, 실제 컬럼 적용은 neon 클라이언트로 직접(idempotent `ADD COLUMN IF NOT EXISTS`) 수행한다.

- [ ] **Step 1: 스키마에 컬럼 추가**

`src/lib/db/schema.ts`의 `sermonThumbnails` 테이블(94줄 `thumbnailBackgrounds` 다음)에 추가:

```ts
  thumbnailBackgrounds: jsonb('thumbnail_backgrounds').$type<Partial<Record<ThumbnailStyle, string>>>(),
  thumbnailCutoutUrl: text('thumbnail_cutout_url'),
```

(`text`는 이미 schema.ts에서 import되어 있음)

- [ ] **Step 2: 마이그레이션 SQL 생성(이력 기록용)**

Run: `npm run db:generate`
Expected: `drizzle/` 아래 새 `.sql`(`ALTER TABLE "sermon_thumbnails" ADD COLUMN "thumbnail_cutout_url" text;` 포함) 생성, 콘솔에 새 마이그레이션명 출력.

- [ ] **Step 3: 컬럼 직접 적용 스크립트 작성**

`scripts/apply-thumbnail-cutout-column.ts`:

```ts
import { config } from 'dotenv'

config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'

// drizzle-kit migrate 우회: 누끼 캐시 컬럼을 idempotent하게 직접 추가한다.
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL 가 .env.local 에 없음')
  const sql = neon(url)
  await sql`ALTER TABLE sermon_thumbnails ADD COLUMN IF NOT EXISTS thumbnail_cutout_url text`
  console.log('thumbnail_cutout_url 컬럼 적용 완료')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
```

- [ ] **Step 4: 컬럼 적용 실행**

Run: `npx tsx scripts/apply-thumbnail-cutout-column.ts`
Expected: `thumbnail_cutout_url 컬럼 적용 완료` 출력, 에러 없음.

- [ ] **Step 5: 타입 점검**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/ scripts/apply-thumbnail-cutout-column.ts
git commit -m "feat: sermon_thumbnails에 누끼 캐시 컬럼 추가"
```

---

## Task 3: 누끼 R2 저장 헬퍼

**Files:**
- Modify: `src/lib/thumbnails/store.ts`

- [ ] **Step 1: storeCutout 구현**

`src/lib/thumbnails/store.ts` 상단 `backgroundKey` 함수 아래에 키 헬퍼 추가:

```ts
function cutoutKey(sermonId: string): string {
  return `thumbnails/cutouts/${sermonId}-${Date.now()}.png`
}
```

파일 끝에 `storeCutout` 추가:

```ts
/**
 * 누끼(투명 PNG)를 R2에 올리고 sermon_thumbnails.thumbnailCutoutUrl에 저장한다.
 * 유튜브 썸네일 파생이라 변하지 않으므로 1회 추출 후 재사용 캐시로 쓰인다.
 */
export async function storeCutout(sermonId: string, png: Buffer): Promise<string> {
  const url = await uploadToR2(png, cutoutKey(sermonId), 'image/png')
  const updated = await db
    .insert(sermonThumbnails)
    .values({ sermonId, thumbnailCutoutUrl: url })
    .onConflictDoUpdate({
      target: sermonThumbnails.sermonId,
      set: { thumbnailCutoutUrl: url },
    })
    .returning({ id: sermonThumbnails.sermonId })
  if (updated.length === 0) throw new Error('sermon not found')
  return url
}
```

(`db`, `sermonThumbnails`, `uploadToR2`는 이 파일에 이미 import되어 있음. `sql`는 storeCutout에서 불필요.)

- [ ] **Step 2: 타입 점검**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/lib/thumbnails/store.ts
git commit -m "feat: 누끼 R2 저장 헬퍼(storeCutout) 추가"
```

---

## Task 4: 생성·적용 액션 — cutout 분기

**Files:**
- Modify: `src/lib/actions/thumbnails.ts`

> 기존 두 액션의 `if (style === 'cutout') throw ...` 두 줄을 제거하고, 누끼 해석·합성을 끼운다. `sermons`는 이미 import되어 있고 누끼 소스(`sermons.thumbnailUrl`) 조회에 쓴다.

- [ ] **Step 1: import에 removeBackground·storeCutout 추가**

`src/lib/actions/thumbnails.ts` 상단 import 수정:

```ts
import { renderThumbnail, toDataUrl } from '@/lib/thumbnails/render'
import { removeBackground } from '@/lib/thumbnails/remove-background'
import { storeBackground, storeCandidate, storeCutout } from '@/lib/thumbnails/store'
```

- [ ] **Step 2: 누끼 해석 헬퍼 추가**

`resolveBgKeywords` 함수 아래에 추가:

```ts
/**
 * 인물 누끼 URL을 반환한다. 캐시(thumbnailCutoutUrl)가 있으면 재사용하고,
 * 없으면 유튜브 썸네일(sermons.thumbnailUrl)로 remove.bg를 1회 호출해 R2에 저장한다.
 * 썸네일이 없는 설교는 누끼 없이 진행(undefined).
 */
async function resolveCutout(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({
      cutoutUrl: sermonThumbnails.thumbnailCutoutUrl,
      thumbnailUrl: sermons.thumbnailUrl,
    })
    .from(sermons)
    .leftJoin(sermonThumbnails, eq(sermonThumbnails.sermonId, sermons.id))
    .where(eq(sermons.id, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  if (row.cutoutUrl?.trim()) return row.cutoutUrl
  if (!row.thumbnailUrl) return undefined
  const png = await removeBackground(row.thumbnailUrl)
  return storeCutout(id, png)
}
```

- [ ] **Step 3: GenerateThumbnailResult 확장 + generate 분기**

`GenerateThumbnailResult` 인터페이스 수정:

```ts
export interface GenerateThumbnailResult {
  backgroundUrl: string
  cutoutUrl?: string
}
```

`generateThumbnailAction` 본문에서 cutout 차단(`if (style === 'cutout') throw ...`) 제거하고 누끼 해석 추가. 함수 전체를 아래로 교체:

```ts
export async function generateThumbnailAction(
  id: string,
  style: ThumbnailStyle
): Promise<GenerateThumbnailResult> {
  const session = await requireAdmin()

  const keywords = await resolveBgKeywords(id)
  const background = await generateBackground(style, keywords)
  const backgroundUrl = await storeBackground(id, style, background)

  let cutoutUrl: string | undefined
  if (style === 'cutout') cutoutUrl = await resolveCutout(id)

  await log('create', 'sermon', id, `thumbnail:bg:${style}`, session.user.id)
  return { backgroundUrl, cutoutUrl }
}
```

- [ ] **Step 4: composeAndApply 분기**

`composeAndApplyThumbnailAction`에서 cutout 차단 제거하고, 배경 조회 select에 누끼 URL을 함께 가져와 합성에 전달. 함수 본문을 아래로 교체:

```ts
export async function composeAndApplyThumbnailAction(
  id: string,
  style: ThumbnailStyle,
  text: ThumbnailText,
  options: ThumbnailRenderOptions
): Promise<void> {
  const session = await requireAdmin()

  const [row] = await db
    .select({
      backgrounds: sermonThumbnails.thumbnailBackgrounds,
      cutoutUrl: sermonThumbnails.thumbnailCutoutUrl,
    })
    .from(sermonThumbnails)
    .where(eq(sermonThumbnails.sermonId, id))
    .limit(1)
  if (!row) throw new Error('sermon not found')
  const backgroundUrl = row.backgrounds?.[style]
  if (!backgroundUrl) throw new Error('적용할 배경이 없습니다. 먼저 썸네일을 생성하세요.')

  const res = await fetch(backgroundUrl)
  if (!res.ok) throw new Error(`배경 이미지를 불러오지 못했습니다: ${res.status}`)
  const background = Buffer.from(await res.arrayBuffer())

  let cutoutDataUrl: string | undefined
  if (style === 'cutout' && row.cutoutUrl) {
    const cutoutRes = await fetch(row.cutoutUrl)
    if (cutoutRes.ok) cutoutDataUrl = toDataUrl(Buffer.from(await cutoutRes.arrayBuffer()))
  }

  const png = await renderThumbnail({
    headline: text.headline,
    scripture: text.scripture,
    backgroundDataUrl: toDataUrl(background),
    cutoutDataUrl,
    position: coercePosition(options.position),
    colors: coerceColors(options.colors),
  })

  const candidate = await storeCandidate(id, style, png)
  await db.update(sermons).set({ customThumbnailUrl: candidate.url }).where(eq(sermons.id, id))
  await log('update', 'sermon', id, `thumbnail:apply:${style}`, session.user.id)
  revalidate(id)
}
```

- [ ] **Step 5: 타입 점검**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 6: 기존 액션 테스트 회귀 확인**

Run: `npx vitest run`
Expected: 전체 PASS(기존 + 신규 remove-background).

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/thumbnails.ts
git commit -m "feat: 인물컷형 썸네일 생성·적용 액션 구현"
```

---

## Task 5: 데이터 조회 + UI 배선 + 프리뷰 미러링

**Files:**
- Modify: `src/lib/actions/sermons.ts:53-63` (getSermonForAdmin select)
- Modify: `src/app/admin/sermons/[id]/edit/page.tsx:15-28`
- Modify: `src/components/admin/ThumbnailModal.tsx`
- Modify: `src/components/admin/ThumbnailStyleTab.tsx`
- Modify: `src/components/admin/ThumbnailPreview.tsx`

- [ ] **Step 1: getSermonForAdmin select에 누끼 URL 추가**

`src/lib/actions/sermons.ts`의 `getSermonForAdmin` select 객체에서 `thumbnailBackgrounds` 다음 줄에 추가:

```ts
      thumbnailBackgrounds: sermonThumbnails.thumbnailBackgrounds,
      thumbnailCutoutUrl: sermonThumbnails.thumbnailCutoutUrl,
```

- [ ] **Step 2: edit page → SermonEditForm → ThumbnailModal로 cutoutUrl 통과**

`src/app/admin/sermons/[id]/edit/page.tsx`의 `<SermonEditForm ... />`에서 `backgrounds` prop 다음에 추가:

```tsx
        backgrounds={row.thumbnailBackgrounds ?? {}}
        cutoutUrl={row.thumbnailCutoutUrl ?? undefined}
```

`src/components/admin/SermonEditForm.tsx`는 `backgrounds`를 그대로 모달에 포워딩하므로 동일 경로로 `cutoutUrl`을 추가한다.

Props 인터페이스(18줄 `backgrounds:` 다음)에 추가:

```ts
  backgrounds: Partial<Record<ThumbnailStyle, string>>
  cutoutUrl?: string
```

함수 시그니처 구조분해(21줄)에 `cutoutUrl` 추가:

```ts
export default function SermonEditForm({ id, initial, summaryStatus, quickSummary, chapters, backgrounds, cutoutUrl }: Props) {
```

모달 마운트(159줄)에 prop 전달:

```tsx
        <ThumbnailModal sermonId={id} backgrounds={backgrounds} cutoutUrl={cutoutUrl} onClose={() => setThumbOpen(false)} />
```

- [ ] **Step 3: ThumbnailModal에 cutoutUrl prop 추가 + 설명문 갱신**

`src/components/admin/ThumbnailModal.tsx`:

`DESCRIPTIONS.cutout`에서 "(준비 중)" 제거:

```ts
  cutout: '제목·구절에 더해 유튜브 썸네일에서 인물을 따내 합성합니다.',
```

Props 인터페이스에 추가:

```ts
interface Props {
  sermonId: string
  backgrounds: Partial<Record<ThumbnailStyle, string>>
  cutoutUrl?: string
  onClose: () => void
}
```

함수 시그니처 구조분해에 `cutoutUrl` 추가:

```ts
export default function ThumbnailModal({ sermonId, backgrounds, cutoutUrl, onClose }: Props) {
```

`<ThumbnailStyleTab .../>`에 prop 전달(`background={backgrounds[tab]}` 다음):

```tsx
          background={backgrounds[tab]}
          cutout={cutoutUrl}
```

- [ ] **Step 4: ThumbnailStyleTab에 cutout state/prop 추가**

`src/components/admin/ThumbnailStyleTab.tsx`:

Props 인터페이스에 `cutout?: string` 추가:

```ts
interface Props {
  sermonId: string;
  style: ThumbnailStyle;
  description: string;
  background?: string;
  cutout?: string;
  onApply: (text: ThumbnailText, options: ThumbnailRenderOptions) => void;
  applying: boolean;
}
```

함수 시그니처 + state 추가:

```ts
export default function ThumbnailStyleTab({ sermonId, style, description, background: initialBackground, cutout: initialCutout, onApply, applying }: Props) {
  const [text, setText] = useState<ThumbnailText>({ headline: "", scripture: "" });
  const [background, setBackground] = useState<string | undefined>(initialBackground);
  const [cutout, setCutout] = useState<string | undefined>(initialCutout);
```

`generate()` 본문에서 결과의 `cutoutUrl`을 반영:

```ts
        const { backgroundUrl, cutoutUrl } = await generateThumbnailAction(sermonId, style);
        setBackground(backgroundUrl);
        if (cutoutUrl) setCutout(cutoutUrl);
```

`<ThumbnailPreview ... />`에 cutout 전달(cutout 스타일에서만 노출):

```tsx
      <ThumbnailPreview background={background} cutout={style === "cutout" ? cutout : undefined} text={text} position={position} colors={colors} />
```

- [ ] **Step 5: ThumbnailPreview에 인물 전경 미러링**

`src/components/admin/ThumbnailPreview.tsx`:

Props 인터페이스에 `cutout?: string` 추가:

```ts
interface Props {
  background?: string;
  cutout?: string;
  text: ThumbnailText;
  position: ThumbnailPosition;
  colors: ThumbnailColors;
}
```

함수 시그니처:

```ts
export default function ThumbnailPreview({ background, cutout, text, position, colors }: Props) {
```

그라디언트 `<div>` 다음(문구 블록 앞)에 인물 전경 추가(render.tsx의 `right:24/bottom:0/height:720/object-contain`을 cqw로 미러링, 24/1280=1.875cqw):

```tsx
      <div className="absolute inset-0" style={{ background: GRADIENT }} />
      {cutout ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cutout}
          alt=""
          className="absolute"
          style={{ right: "1.875cqw", bottom: 0, height: "100%", objectFit: "contain" }}
        />
      ) : null}
```

- [ ] **Step 6: 타입/린트 점검**

Run: `npx tsc --noEmit && npm run lint`
Expected: 통과.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/sermons.ts "src/app/admin/sermons/[id]/edit/page.tsx" src/components/admin/ThumbnailModal.tsx src/components/admin/ThumbnailStyleTab.tsx src/components/admin/ThumbnailPreview.tsx
git commit -m "feat: 인물컷형 썸네일 UI 배선·프리뷰 미러링 추가"
```

---

## 최종 통합 점검

- [ ] **전체 테스트**

Run: `npm run test`
Expected: 신규 `remove-background` 포함 전체 PASS.

- [ ] **빌드**

Run: `npm run build`
Expected: 성공.

- [ ] **수동 통합 확인(로컬, REMOVE_BG_API_KEY·OPENAI_API_KEY 필요)**

Run: `npm run dev` → 관리자 로그인 → 설교 편집 → "썸네일 생성" → **인물컷형** 탭 → "문구 생성" → "썸네일 생성"(배경 AI + 누끼 추출) → 프리뷰에 배경+인물+문구 즉시 표시 확인 → 위치·색상 조정 → "이 썸네일로 적용" → `/sermons` 목록에서 교체 확인.
Expected: 인물컷형 end-to-end 동작. "배경 재생성" 시 누끼 재호출 없이 캐시 재사용(remove.bg 크레딧 미소모) 확인.
```
