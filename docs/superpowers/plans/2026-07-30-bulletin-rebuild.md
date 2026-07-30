# 주보 재건축 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HWP 바이너리 파싱을 폐기하고, 관리자가 올린 PDF를 브라우저에서 면별 이미지로 변환해 원본 그대로 게시하며, 모바일 가독성은 관리자가 직접 입력하는 「이번 주 한눈에」 카드로 확보한다.

**Architecture:** 판정 로직은 전부 `src/lib/bulletin-*.ts` 순수 함수로 분리해 node 환경 vitest로 검증하고, React 컴포넌트에는 상태 보관과 렌더링만 남긴다. PDF → WebP 변환은 관리자 브라우저에서 수행해 서버 네이티브 의존성을 0으로 유지하고, R2에는 업로드 id 단위로 스테이징해 공개 중인 이미지가 부분 교체되지 않게 한다.

**Tech Stack:** Next.js 16.2.7 (App Router) · React 19 · Drizzle ORM + Neon Postgres · Cloudflare R2 (S3 호환) · Tailwind v4 · pdfjs-dist · vitest (node 환경) · Playwright

**설계 근거:** `docs/superpowers/specs/2026-07-30-bulletin-rebuild-design.md`

---

## 사전 확인

- [ ] **작업 브랜치를 만든다**

```bash
git checkout -b feature/bulletin-rebuild
git status
```

Expected: `On branch feature/bulletin-rebuild`, `nothing to commit, working tree clean`

- [ ] **기준 테스트가 통과하는 상태인지 확인한다**

```bash
npm run test
npm run typecheck
```

Expected: 둘 다 성공. 실패하면 이 계획을 시작하기 전에 원인을 보고할 것.

---

## 파일 구조

**신규 — 순수 함수 (node 환경에서 테스트 가능, DOM 의존 없음)**

| 파일 | 책임 |
|---|---|
| `src/lib/bulletin-scale.ts` | 긴 변 축소 클램프 계산. 세 크기(2000/1000/320) 상수 |
| `src/lib/bulletin-spread.ts` | 라이트박스 스프레드 인덱스 계산 (폭별 면 수, 이동, 폭 변경 재정렬, 표기) |
| `src/lib/bulletin-zoom.ts` | 줌 단계 전이, 배율 계산, 드래그 오프셋 클램프 |

**신규 — 브라우저 전용**

| 파일 | 책임 |
|---|---|
| `src/lib/bulletin-pdf.ts` | PDF/이미지 → 면당 세 크기 Blob. pdfjs-dist 동적 import |
| `scripts/copy-pdf-worker.mjs` | `pdfjs-dist`의 워커를 `public/`으로 복사 (predev/prebuild) |

**신규 — 공개 컴포넌트**

| 파일 | 책임 |
|---|---|
| `src/components/bulletins/BulletinGlance.tsx` | 「이번 주 한눈에」 딥네이비 카드 |
| `src/components/bulletins/BulletinWorshipTimes.tsx` | 예배 시간 (worship.ts 정적 데이터) |
| `src/components/bulletins/BulletinNotices.tsx` | 일정·공지 통합 리스트 |
| `src/components/bulletins/BulletinPageViewer.tsx` | 인라인 뷰어 (썸네일 스트립 + 큰 이미지 + 버튼) |
| `src/components/bulletins/BulletinLightbox.tsx` | 전체화면 스프레드 오버레이 |
| `src/components/home/HomeBulletinCard.tsx` | 홈 축약 카드 |

**신규 — 관리자 컴포넌트**

| 파일 | 책임 |
|---|---|
| `src/components/admin/BulletinGlanceFields.tsx` | 한눈에 카드 스칼라 필드 |
| `src/components/admin/BulletinNoticesEditor.tsx` | 공지 배열 편집 |
| `src/components/admin/BulletinOriginUpload.tsx` | 원본 업로드 + 변환 + presigned PUT |

**재작성**: `src/lib/types.ts`(Bulletin 계열) · `src/lib/bulletin-editor.ts` · `src/lib/actions/bulletins.ts` · `src/lib/data/bulletins.ts` · `src/lib/db/schema.ts`(bulletins) · `src/lib/upload-sniff.ts` · `src/lib/r2.ts`(주보 키) · `src/components/admin/BulletinForm.tsx` · `src/components/bulletins/BulletinView.tsx` · `src/app/bulletins/page.tsx` · `src/app/bulletins/[id]/page.tsx` · `src/app/admin/bulletins/page.tsx` · `src/app/admin/bulletins/[id]/edit/page.tsx` · `src/app/page.tsx`

**삭제**: `src/lib/hwp/`(디렉터리 전체) · `src/components/admin/BulletinHwpUpload.tsx` · `BulletinSectionEditor.tsx` · `BulletinSectionText.tsx` · `BulletinRowsEditor.tsx` · `BulletinTablesEditor.tsx` · `BulletinOfferingsEditor.tsx` · `cfb` 의존성

---

## Task 1: 크기 클램프 계산 — `bulletin-scale.ts`

**Files:**
- Create: `src/lib/bulletin-scale.ts`
- Test: `src/lib/bulletin-scale.test.ts`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/bulletin-scale.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { bulletinSizes, scaleToLongEdge } from './bulletin-scale'

describe('bulletinSizes', () => {
  it('full·preview·thumb 세 크기를 내림차순으로 정의한다', () => {
    expect(bulletinSizes.full).toBe(2000)
    expect(bulletinSizes.preview).toBe(1000)
    expect(bulletinSizes.thumb).toBe(320)
  })
})

describe('scaleToLongEdge', () => {
  it('A4 세로 페이지의 긴 변을 limit으로 축소한다', () => {
    // 한도보다 큰 세로 이미지 — 높이가 긴 변
    expect(scaleToLongEdge(1414, 2000, 1000)).toEqual({ width: 707, height: 1000, scale: 0.5 })
  })

  it('가로가 긴 이미지는 가로를 기준으로 축소한다', () => {
    expect(scaleToLongEdge(2000, 1000, 1000)).toEqual({ width: 1000, height: 500, scale: 0.5 })
  })

  it('원본이 한도보다 작으면 확대하지 않고 그대로 둔다', () => {
    expect(scaleToLongEdge(800, 600, 2000)).toEqual({ width: 800, height: 600, scale: 1 })
  })

  it('한도와 정확히 같으면 그대로 둔다', () => {
    expect(scaleToLongEdge(1000, 500, 1000)).toEqual({ width: 1000, height: 500, scale: 1 })
  })

  it('축소 결과가 0으로 떨어지지 않도록 최소 1px을 보장한다', () => {
    const result = scaleToLongEdge(4000, 2, 320)
    expect(result.width).toBe(320)
    expect(result.height).toBe(1)
  })

  it('폭이나 높이가 0 이하면 던진다', () => {
    expect(() => scaleToLongEdge(0, 100, 320)).toThrow('invalid dimensions')
    expect(() => scaleToLongEdge(100, -1, 320)).toThrow('invalid dimensions')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/bulletin-scale.test.ts`
Expected: FAIL — `Failed to resolve import "./bulletin-scale"`

- [ ] **Step 3: 최소 구현을 작성한다**

`src/lib/bulletin-scale.ts`:

```ts
/**
 * 주보 면 이미지의 세 크기. 긴 변 기준 픽셀이다.
 * full은 라이트박스, preview는 인라인 큰 이미지·목록 표지·홈 카드, thumb은 인라인 스트립에 쓴다.
 *
 * next.config.ts 가 images.unoptimized:true 라서 next/image 의 sizes 로는 축소본이
 * 생성되지 않는다. 그래서 업로드 시점에 세 크기를 직접 만들어 저장한다.
 */
export const bulletinSizes = { full: 2000, preview: 1000, thumb: 320 } as const

export type BulletinSizeName = keyof typeof bulletinSizes

export const bulletinSizeNames = ['full', 'preview', 'thumb'] as const satisfies readonly BulletinSizeName[]

export interface ScaledSize {
  width: number
  height: number
  scale: number
}

/**
 * 긴 변을 limit 이하로 축소한다. 원본이 limit 이하면 확대하지 않고 그대로 반환한다.
 * 극단적인 종횡비에서도 짧은 변이 0이 되지 않도록 최소 1px을 보장한다.
 */
export function scaleToLongEdge(width: number, height: number, limit: number): ScaledSize {
  if (!(width > 0) || !(height > 0)) throw new Error('invalid dimensions')
  const longEdge = Math.max(width, height)
  if (longEdge <= limit) return { width, height, scale: 1 }
  const scale = limit / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/bulletin-scale.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/bulletin-scale.ts src/lib/bulletin-scale.test.ts
git commit -m "feat: 주보 면 이미지 크기 클램프 계산 추가"
```

---

## Task 2: 스프레드 인덱스 계산 — `bulletin-spread.ts`

**Files:**
- Create: `src/lib/bulletin-spread.ts`
- Test: `src/lib/bulletin-spread.test.ts`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/bulletin-spread.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  clampSpreadStart,
  moveSpread,
  pagesPerSpread,
  realignSpread,
  spreadLabel,
  spreadPageIndexes,
  spreadStartForPage,
} from './bulletin-spread'

describe('pagesPerSpread', () => {
  it('1280px 이상은 3면', () => {
    expect(pagesPerSpread(1280)).toBe(3)
    expect(pagesPerSpread(1920)).toBe(3)
  })

  it('768~1279px는 2면', () => {
    expect(pagesPerSpread(768)).toBe(2)
    expect(pagesPerSpread(1279)).toBe(2)
  })

  it('768px 미만은 1면', () => {
    expect(pagesPerSpread(767)).toBe(1)
    expect(pagesPerSpread(390)).toBe(1)
  })
})

describe('clampSpreadStart', () => {
  it('스프레드 경계로 내림 정렬한다', () => {
    expect(clampSpreadStart(4, 6, 3)).toBe(3)
    expect(clampSpreadStart(2, 6, 3)).toBe(0)
  })

  it('마지막 스프레드를 넘어가면 마지막으로 되돌린다', () => {
    expect(clampSpreadStart(99, 6, 3)).toBe(3)
  })

  it('나누어떨어지지 않는 면 수에서도 앞 면을 중복 노출하지 않는다', () => {
    // 5면 · 3면뷰 → 스프레드 시작은 0과 3. 3에서는 4·5면만 보인다(2면).
    expect(clampSpreadStart(3, 5, 3)).toBe(3)
    expect(clampSpreadStart(99, 5, 3)).toBe(3)
  })

  it('음수를 0으로 올린다', () => {
    expect(clampSpreadStart(-5, 6, 3)).toBe(0)
  })

  it('면이 없으면 0', () => {
    expect(clampSpreadStart(3, 0, 3)).toBe(0)
  })
})

describe('moveSpread', () => {
  it('스프레드 단위로 앞뒤로 이동한다', () => {
    expect(moveSpread(0, 1, 6, 3)).toBe(3)
    expect(moveSpread(3, -1, 6, 3)).toBe(0)
  })

  it('양끝에서 더 나가지 않는다', () => {
    expect(moveSpread(3, 1, 6, 3)).toBe(3)
    expect(moveSpread(0, -1, 6, 3)).toBe(0)
  })
})

describe('realignSpread', () => {
  it('폭이 줄어들면 현재 스프레드의 첫 면을 유지한다', () => {
    // 3면뷰에서 4~6면(start=3)을 보던 중 1면뷰로 전환 → 4면(index 3)
    expect(realignSpread(3, 6, 1)).toBe(3)
  })

  it('폭이 늘어나면 첫 면을 포함하는 스프레드로 정렬한다', () => {
    // 1면뷰에서 4면(index 3)을 보던 중 3면뷰로 전환 → 4~6면(start=3)
    expect(realignSpread(3, 6, 3)).toBe(3)
    // 1면뷰에서 5면(index 4) → 3면뷰에서는 4~6면 스프레드(start=3)
    expect(realignSpread(4, 6, 3)).toBe(3)
  })
})

describe('spreadPageIndexes', () => {
  it('스프레드에 담긴 면 인덱스를 순서대로 준다', () => {
    expect(spreadPageIndexes(0, 6, 3)).toEqual([0, 1, 2])
    expect(spreadPageIndexes(3, 6, 3)).toEqual([3, 4, 5])
  })

  it('마지막 스프레드가 덜 차면 남은 면만 준다', () => {
    expect(spreadPageIndexes(3, 5, 3)).toEqual([3, 4])
  })

  it('면이 없으면 빈 배열', () => {
    expect(spreadPageIndexes(0, 0, 3)).toEqual([])
  })
})

describe('spreadLabel', () => {
  it('여러 면이면 범위로 표기한다', () => {
    expect(spreadLabel(0, 6, 3)).toBe('1 – 3 / 6면')
  })

  it('한 면이면 단일 숫자로 표기한다', () => {
    expect(spreadLabel(3, 6, 1)).toBe('4 / 6면')
  })

  it('면이 없으면 0으로 표기한다', () => {
    expect(spreadLabel(0, 0, 3)).toBe('0 / 0면')
  })
})

describe('spreadStartForPage', () => {
  it('그 면을 포함하는 스프레드 시작을 준다', () => {
    expect(spreadStartForPage(4, 6, 3)).toBe(3)
    expect(spreadStartForPage(1, 6, 3)).toBe(0)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/bulletin-spread.test.ts`
Expected: FAIL — `Failed to resolve import "./bulletin-spread"`

- [ ] **Step 3: 최소 구현을 작성한다**

`src/lib/bulletin-spread.ts`:

```ts
/**
 * 라이트박스 스프레드(동시에 나란히 띄우는 면 묶음) 인덱스 계산.
 *
 * 면 수를 화면 폭으로 결정하는 이유: 레퍼런스(jangji.org)는 3면 고정인데 1900px
 * 폭에서만 성립한다. 모바일에서 3면이면 한 면이 화면 1/3 폭이 되어 확대해도 읽을 수 없다.
 *
 * DOM에 의존하지 않는 순수 함수로 둔다 — vitest가 node 환경이라 컴포넌트 테스트를
 * 돌릴 수 없으므로, 판정 로직은 전부 여기에 있어야 검증된다.
 */

/** 화면 폭으로 동시 표시 면 수를 정한다. */
export function pagesPerSpread(viewportWidth: number): 1 | 2 | 3 {
  if (viewportWidth >= 1280) return 3
  if (viewportWidth >= 768) return 2
  return 1
}

/**
 * 마지막 스프레드의 시작 인덱스.
 * 5면·3면뷰면 0과 3이 스프레드 시작이고, 3번 스프레드는 2면만 담는다.
 * `pageCount - perSpread`로 잡으면 마지막 스프레드가 앞 면을 다시 보여주게 되므로 쓰지 않는다.
 */
export function lastSpreadStart(pageCount: number, perSpread: number): number {
  if (pageCount <= 0) return 0
  return Math.floor((pageCount - 1) / perSpread) * perSpread
}

/** 임의의 시작 인덱스를 스프레드 경계로 내림 정렬하고 유효 범위로 제한한다. */
export function clampSpreadStart(start: number, pageCount: number, perSpread: number): number {
  if (pageCount <= 0) return 0
  const aligned = Math.floor(Math.max(0, start) / perSpread) * perSpread
  return Math.min(aligned, lastSpreadStart(pageCount, perSpread))
}

/** 스프레드 단위로 한 칸 이동한다. 양끝에서는 제자리에 머문다. */
export function moveSpread(start: number, delta: -1 | 1, pageCount: number, perSpread: number): number {
  return clampSpreadStart(start + delta * perSpread, pageCount, perSpread)
}

/**
 * 화면 폭이 바뀌어 perSpread가 변할 때 현재 스프레드의 첫 면을 기준으로 재정렬한다.
 * 3면뷰 4~6면 → 1면뷰면 4면을 보여준다.
 */
export function realignSpread(currentStart: number, pageCount: number, nextPerSpread: number): number {
  return clampSpreadStart(currentStart, pageCount, nextPerSpread)
}

/** 이 스프레드가 담는 면 인덱스(0-based) 목록. */
export function spreadPageIndexes(start: number, pageCount: number, perSpread: number): number[] {
  if (pageCount <= 0) return []
  const first = clampSpreadStart(start, pageCount, perSpread)
  const length = Math.min(perSpread, pageCount - first)
  return Array.from({ length }, (_, offset) => first + offset)
}

/** 툴바 표기. 예: `1 – 3 / 6면`, `4 / 6면`. */
export function spreadLabel(start: number, pageCount: number, perSpread: number): string {
  const indexes = spreadPageIndexes(start, pageCount, perSpread)
  if (indexes.length === 0) return '0 / 0면'
  const first = indexes[0] + 1
  const last = indexes[indexes.length - 1] + 1
  return first === last ? `${first} / ${pageCount}면` : `${first} – ${last} / ${pageCount}면`
}

/** 인라인에서 특정 면을 눌러 라이트박스를 열 때의 스프레드 시작. */
export function spreadStartForPage(pageIndex: number, pageCount: number, perSpread: number): number {
  return clampSpreadStart(pageIndex, pageCount, perSpread)
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/bulletin-spread.test.ts`
Expected: PASS — 18 tests

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/bulletin-spread.ts src/lib/bulletin-spread.test.ts
git commit -m "feat: 라이트박스 스프레드 인덱스 계산 추가"
```

---

## Task 3: 줌·드래그 계산 — `bulletin-zoom.ts`

**Files:**
- Create: `src/lib/bulletin-zoom.ts`
- Test: `src/lib/bulletin-zoom.test.ts`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/bulletin-zoom.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clampOffset, isDraggable, nextZoom, offsetForStep, zoomScale, zoomSteps } from './bulletin-zoom'

const viewport = { width: 1000, height: 800 }
const content = { width: 2000, height: 2800 }

describe('zoomSteps / nextZoom', () => {
  it('맞춤 → 1× → 2× 순서다', () => {
    expect(zoomSteps).toEqual(['fit', '1x', '2x'])
  })

  it('한 단계씩 올린다', () => {
    expect(nextZoom('fit', 1)).toBe('1x')
    expect(nextZoom('1x', 1)).toBe('2x')
  })

  it('한 단계씩 내린다', () => {
    expect(nextZoom('2x', -1)).toBe('1x')
    expect(nextZoom('1x', -1)).toBe('fit')
  })

  it('양끝에서는 제자리에 머문다', () => {
    expect(nextZoom('2x', 1)).toBe('2x')
    expect(nextZoom('fit', -1)).toBe('fit')
  })
})

describe('isDraggable', () => {
  it('맞춤에서는 드래그를 막는다', () => {
    expect(isDraggable('fit')).toBe(false)
  })

  it('확대 단계에서는 드래그를 허용한다', () => {
    expect(isDraggable('1x')).toBe(true)
    expect(isDraggable('2x')).toBe(true)
  })
})

describe('zoomScale', () => {
  it('맞춤은 콘텐츠 전체가 뷰포트에 들어가는 배율이다', () => {
    // 세로가 더 빡빡하다: 800/2800 < 1000/2000
    expect(zoomScale('fit', viewport, content)).toBeCloseTo(800 / 2800)
  })

  it('맞춤은 1을 넘지 않는다 — 작은 이미지를 늘리지 않는다', () => {
    expect(zoomScale('fit', viewport, { width: 100, height: 100 })).toBe(1)
  })

  it('1×는 자연 크기, 2×는 그 두 배다', () => {
    expect(zoomScale('1x', viewport, content)).toBe(1)
    expect(zoomScale('2x', viewport, content)).toBe(2)
  })

  it('콘텐츠 크기가 아직 0이면 1로 폴백한다', () => {
    expect(zoomScale('fit', viewport, { width: 0, height: 0 })).toBe(1)
  })
})

describe('clampOffset', () => {
  it('확대된 콘텐츠가 뷰포트를 벗어난 만큼만 끌린다', () => {
    // scale 1 → 2000x2800. 가로 여유 (2000-1000)/2 = 500, 세로 (2800-800)/2 = 1000
    expect(clampOffset({ x: 900, y: 5000 }, 1, viewport, content)).toEqual({ x: 500, y: 1000 })
    expect(clampOffset({ x: -900, y: -5000 }, 1, viewport, content)).toEqual({ x: -500, y: -1000 })
  })

  it('범위 안의 오프셋은 그대로 둔다', () => {
    expect(clampOffset({ x: 100, y: -200 }, 1, viewport, content)).toEqual({ x: 100, y: -200 })
  })

  it('콘텐츠가 뷰포트보다 작으면 여백이 보이지 않도록 0으로 고정한다', () => {
    expect(clampOffset({ x: 300, y: 300 }, 0.1, viewport, content)).toEqual({ x: 0, y: 0 })
  })
})

describe('offsetForStep', () => {
  it('맞춤으로 돌아가면 오프셋을 0으로 리셋한다', () => {
    expect(offsetForStep('fit', { x: 400, y: 900 }, viewport, content)).toEqual({ x: 0, y: 0 })
  })

  it('확대 단계로 가면 새 배율 기준으로 클램프한다', () => {
    // scale 2 → 4000x5600. 가로 여유 1500, 세로 2400
    expect(offsetForStep('2x', { x: 9999, y: -9999 }, viewport, content)).toEqual({ x: 1500, y: -2400 })
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/bulletin-zoom.test.ts`
Expected: FAIL — `Failed to resolve import "./bulletin-zoom"`

- [ ] **Step 3: 최소 구현을 작성한다**

`src/lib/bulletin-zoom.ts`:

```ts
/**
 * 라이트박스 줌·드래그 계산.
 *
 * 핀치줌을 쓰지 않는 이유: 기기·브라우저마다 동작이 갈리고 viewport 설정과 충돌한다.
 * 3단 버튼 + 드래그면 상태 전이가 결정론적이어서 node 환경에서 검증할 수 있다.
 */

export const zoomSteps = ['fit', '1x', '2x'] as const

export type ZoomStep = (typeof zoomSteps)[number]

export interface Size {
  width: number
  height: number
}

export interface Offset {
  x: number
  y: number
}

/** 줌 단계를 한 칸 옮긴다. 양끝을 넘어가지 않는다. */
export function nextZoom(current: ZoomStep, direction: 1 | -1): ZoomStep {
  const index = zoomSteps.indexOf(current)
  const moved = Math.min(zoomSteps.length - 1, Math.max(0, index + direction))
  return zoomSteps[moved]
}

/** 맞춤 단계에서는 콘텐츠가 이미 다 보이므로 드래그를 막는다. */
export function isDraggable(step: ZoomStep): boolean {
  return step !== 'fit'
}

/**
 * 단계에 해당하는 실제 배율.
 * 맞춤은 콘텐츠 전체가 뷰포트에 들어가는 배율이며, 작은 이미지를 늘리지 않도록 1을 넘지 않는다.
 */
export function zoomScale(step: ZoomStep, viewport: Size, content: Size): number {
  if (step === '1x') return 1
  if (step === '2x') return 2
  if (!(content.width > 0) || !(content.height > 0)) return 1
  return Math.min(1, viewport.width / content.width, viewport.height / content.height)
}

/**
 * 드래그 오프셋을 "확대된 콘텐츠가 뷰포트를 벗어난 만큼"으로 제한한다.
 * 콘텐츠가 뷰포트보다 작은 축은 0으로 고정해 여백이 끌려 들어오지 않게 한다.
 */
export function clampOffset(offset: Offset, scale: number, viewport: Size, content: Size): Offset {
  const scaledWidth = content.width * scale
  const scaledHeight = content.height * scale
  const maxX = Math.max(0, (scaledWidth - viewport.width) / 2)
  const maxY = Math.max(0, (scaledHeight - viewport.height) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

/** 줌 단계를 바꿀 때의 오프셋. 맞춤으로 돌아가면 항상 0이다. */
export function offsetForStep(step: ZoomStep, offset: Offset, viewport: Size, content: Size): Offset {
  if (step === 'fit') return { x: 0, y: 0 }
  return clampOffset(offset, zoomScale(step, viewport, content), viewport, content)
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/bulletin-zoom.test.ts`
Expected: PASS — 14 tests

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/bulletin-zoom.ts src/lib/bulletin-zoom.test.ts
git commit -m "feat: 라이트박스 줌·드래그 계산 추가"
```

---

## Task 4: 업로드 MIME 스니핑 교체 — HWP 제거, PDF 추가

**Files:**
- Modify: `src/lib/upload-sniff.ts`
- Modify: `src/lib/upload-sniff.test.ts`

`sniffHwpMime`과 `'application/x-hwp'`를 지운다. 주보 업로드가 유일한 사용처였고, 이 작업으로 HWP 경로가 없어진다.

- [ ] **Step 1: 테스트를 먼저 바꾼다**

`src/lib/upload-sniff.test.ts`의 전체 내용을 아래로 교체한다:

```ts
import { describe, expect, it } from 'vitest'
import { isAllowedUploadMime, sniffImageMime, sniffPdfMime } from './upload-sniff'

function bytes(...values: number[]) {
  return Buffer.from(values)
}

describe('sniffImageMime', () => {
  it('PNG 매직을 인식한다', () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
  })

  it('JPEG 매직을 인식한다', () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
  })

  it('WebP 매직을 인식한다', () => {
    expect(sniffImageMime(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp')
  })

  it('알 수 없는 바이트는 null', () => {
    expect(sniffImageMime(bytes(0x00, 0x01, 0x02))).toBeNull()
  })
})

describe('sniffPdfMime', () => {
  it('%PDF- 로 시작하면 인식한다', () => {
    expect(sniffPdfMime(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf')
  })

  it('%PDF 뒤 하이픈이 없으면 거부한다', () => {
    expect(sniffPdfMime(Buffer.from('%PDF1.7'))).toBeNull()
  })

  it('앞에 다른 바이트가 붙으면 거부한다 — 오프셋 0만 본다', () => {
    expect(sniffPdfMime(Buffer.from('x%PDF-1.7'))).toBeNull()
  })

  it('구 HWP(CFB/OLE) 매직은 거부한다', () => {
    expect(sniffPdfMime(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBeNull()
  })

  it('너무 짧은 버퍼는 거부한다', () => {
    expect(sniffPdfMime(bytes(0x25, 0x50))).toBeNull()
  })
})

describe('isAllowedUploadMime', () => {
  it('이미지 타입을 허용한다', () => {
    expect(isAllowedUploadMime('image/png')).toBe(true)
    expect(isAllowedUploadMime('image/webp')).toBe(true)
  })

  it('PDF를 허용한다', () => {
    expect(isAllowedUploadMime('application/pdf')).toBe(true)
  })

  it('HWP는 더 이상 허용하지 않는다', () => {
    expect(isAllowedUploadMime('application/x-hwp')).toBe(false)
  })

  it('SVG와 HTML은 거부한다', () => {
    expect(isAllowedUploadMime('image/svg+xml')).toBe(false)
    expect(isAllowedUploadMime('text/html')).toBe(false)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/upload-sniff.test.ts`
Expected: FAIL — `sniffPdfMime` is not exported / `isAllowedUploadMime('application/pdf')` 가 false

- [ ] **Step 3: 구현을 바꾼다**

`src/lib/upload-sniff.ts` 전체를 아래로 교체한다:

```ts
export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
export type UploadMime = ImageMime | 'application/pdf'

// "%PDF-" — 버전 숫자 앞의 하이픈까지 봐야 "%PDF"로 시작하는 다른 텍스트를 배제할 수 있다.
const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d] as const

function hasBytes(buffer: Buffer, offset: number, bytes: readonly number[]) {
  if (buffer.length < offset + bytes.length) return false
  return bytes.every((byte, index) => buffer[offset + index] === byte)
}

export function sniffImageMime(buffer: Buffer): ImageMime | null {
  if (hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (hasBytes(buffer, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return 'image/gif'
  if (hasBytes(buffer, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'image/gif'
  if (hasBytes(buffer, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(buffer, 8, [0x57, 0x45, 0x42, 0x50])) {
    return 'image/webp'
  }
  return null
}

export function sniffPdfMime(buffer: Buffer): 'application/pdf' | null {
  return hasBytes(buffer, 0, pdfMagic) ? 'application/pdf' : null
}

export function isAllowedUploadMime(contentType: string): contentType is UploadMime {
  return (
    contentType === 'image/png' ||
    contentType === 'image/jpeg' ||
    contentType === 'image/webp' ||
    contentType === 'image/gif' ||
    contentType === 'application/pdf'
  )
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/upload-sniff.test.ts`
Expected: PASS — 14 tests

`npm run typecheck`는 아직 실패한다 (`src/lib/actions/bulletins.ts:11`이 `sniffHwpMime`을 import한다). Task 9에서 해소된다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/upload-sniff.ts src/lib/upload-sniff.test.ts
git commit -m "feat: 업로드 스니핑을 HWP에서 PDF로 교체"
```

---

## Task 5: R2 주보 키·presign — `r2.ts`

**Files:**
- Modify: `src/lib/r2.ts:104-108` (`bulletinHwpKey` 삭제 후 그 자리에 신규 함수)
- Modify: `src/lib/r2.test.ts` (파일 끝에 describe 블록 추가, `keyFromUrl` 테스트의 hwp 예시 교체)

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/r2.test.ts` 맨 끝에 아래를 추가한다:

```ts
describe('bulletin keys', () => {
  const uploadId = '0189d3f0-1111-4222-8333-444455556666'

  beforeEach(() => {
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
  })

  it('면 이미지 키에 날짜·업로드id·면번호·크기가 들어간다', async () => {
    const { bulletinPageKey } = await import('./r2')
    expect(bulletinPageKey('2026-07-26', uploadId, 1, 'full', 'webp')).toBe(
      `bulletins/2026-07-26/${uploadId}/1-full.webp`
    )
    expect(bulletinPageKey('2026-07-26', uploadId, 12, 'thumb', 'jpg')).toBe(
      `bulletins/2026-07-26/${uploadId}/12-thumb.jpg`
    )
  })

  it('원본 PDF 키는 업로드 폴더 아래 original.pdf 다', async () => {
    const { bulletinPdfKey } = await import('./r2')
    expect(bulletinPdfKey('2026-07-26', uploadId)).toBe(`bulletins/2026-07-26/${uploadId}/original.pdf`)
  })

  it('날짜 형식이 틀리면 던진다 — 경로 조작 차단', async () => {
    const { bulletinPdfKey } = await import('./r2')
    expect(() => bulletinPdfKey('2026-7-26', uploadId)).toThrow('invalid bulletin date')
    expect(() => bulletinPdfKey('../../etc', uploadId)).toThrow('invalid bulletin date')
  })

  it('업로드 id가 uuid 형식이 아니면 던진다', async () => {
    const { bulletinPdfKey } = await import('./r2')
    expect(() => bulletinPdfKey('2026-07-26', '../evil')).toThrow('invalid upload id')
  })

  it('면 번호가 1 이상 정수가 아니면 던진다', async () => {
    const { bulletinPageKey } = await import('./r2')
    expect(() => bulletinPageKey('2026-07-26', uploadId, 0, 'full', 'webp')).toThrow('invalid page number')
    expect(() => bulletinPageKey('2026-07-26', uploadId, 1.5, 'full', 'webp')).toThrow('invalid page number')
  })

  it('bulletinHwpKey는 더 이상 존재하지 않는다', async () => {
    const r2 = await import('./r2')
    expect('bulletinHwpKey' in r2).toBe(false)
  })
})

describe('presignBulletinPut', () => {
  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = 'acc'
    process.env.R2_ACCESS_KEY_ID = 'key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_BUCKET_NAME = 'bucket'
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com/assets/'
    vi.resetModules()
  })

  it('bulletins/ 이외의 프리픽스를 거부한다', async () => {
    const { presignBulletinPut } = await import('./r2')
    await expect(presignBulletinPut('gallery/evil.webp', 'image/webp')).rejects.toThrow('invalid key prefix')
  })

  it('bulletins/ 키에는 서명 URL을 발급한다', async () => {
    const { presignBulletinPut } = await import('./r2')
    const url = await presignBulletinPut('bulletins/2026-07-26/x/1-full.webp', 'image/webp')
    expect(url).toContain('bulletins/2026-07-26/x/1-full.webp')
  })
})
```

또한 기존 `keyFromUrl` 테스트에서 hwp 확장자 예시를 새 키 규칙으로 바꾼다. `src/lib/r2.test.ts:34`를 아래로 교체한다:

```ts
    expect(keyFromUrl('https://cdn.example.com/assets/bulletins/2026-07-26/x/1-full.webp')).toBe('bulletins/2026-07-26/x/1-full.webp')
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/r2.test.ts`
Expected: FAIL — `bulletinPageKey` / `bulletinPdfKey` / `presignBulletinPut` 미정의, 그리고 `'bulletinHwpKey' in r2` 가 true

- [ ] **Step 3: 구현을 바꾼다**

`src/lib/r2.ts`의 `bulletinHwpKey`(104-106행)를 삭제하고 그 자리에 아래를 넣는다:

```ts
export type BulletinPageSize = 'full' | 'preview' | 'thumb'
export type BulletinImageExt = 'webp' | 'jpg'

const bulletinDatePattern = /^\d{4}-\d{2}-\d{2}$/
const uploadIdPattern = /^[0-9a-fA-F-]{1,64}$/

// 키에 날짜와 업로드 id가 그대로 들어가므로 경로 조작(../)을 막기 위해 형식을 강제한다.
function bulletinUploadPrefix(date: string, uploadId: string) {
  if (!bulletinDatePattern.test(date)) throw new Error('invalid bulletin date')
  if (!uploadIdPattern.test(uploadId)) throw new Error('invalid upload id')
  return `bulletins/${date}/${uploadId}`
}

/**
 * 면 이미지 키. 업로드 id 아래로 스테이징하는 이유는, 날짜만으로 키를 만들면
 * 수정 중 공개 이미지를 부분적으로 덮어써 1·2면은 새 것 4·5면은 옛 것인 상태가 보이기 때문이다.
 */
export function bulletinPageKey(
  date: string,
  uploadId: string,
  pageNumber: number,
  size: BulletinPageSize,
  ext: BulletinImageExt
) {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error('invalid page number')
  return `${bulletinUploadPrefix(date, uploadId)}/${pageNumber}-${size}.${ext}`
}

export function bulletinPdfKey(date: string, uploadId: string) {
  return `${bulletinUploadPrefix(date, uploadId)}/original.pdf`
}

/**
 * 브라우저가 R2로 직접 PUT 할 서명 URL. Content-Type이 서명에 포함되므로
 * 클라이언트가 다른 타입으로 올리면 R2가 403으로 거부한다.
 *
 * contentDisposition을 넘기면 그 헤더도 서명에 포함된다. 교차 출처 리소스에는
 * <a download>가 먹지 않으므로 원본 PDF는 attachment로 올려야 저장 버튼이 동작한다.
 */
export async function presignBulletinPut(
  key: string,
  contentType: string,
  contentDisposition?: string,
  expiresIn = 900
) {
  if (!key.startsWith('bulletins/')) throw new Error('invalid key prefix')
  const signableHeaders = new Set(['content-type'])
  if (contentDisposition) signableHeaders.add('content-disposition')
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: requireEnv(bucket, 'R2_BUCKET_NAME'),
      Key: key,
      ContentType: contentType,
      ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
    }),
    { expiresIn, signableHeaders }
  )
}

/** 프리픽스 아래 객체 키를 모두 모은다. 고아 객체 정리 스크립트가 쓴다. */
export async function listR2Keys(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined
  do {
    const res = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: requireEnv(bucket, 'R2_BUCKET_NAME'),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    )
    for (const item of res.Contents ?? []) if (item.Key) keys.push(item.Key)
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return keys
}
```

같은 파일 3행의 import에 `ListObjectsV2Command`를 추가한다:

```ts
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/r2.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/r2.ts src/lib/r2.test.ts
git commit -m "feat: 주보 R2 키·presign을 업로드 id 스테이징 방식으로 교체"
```

---

## Task 6: 타입 교체 — `types.ts`

**Files:**
- Modify: `src/lib/types.ts:30-65` (`BulletinTable`·`BulletinOffering`·`BulletinSection`·`Bulletin` 교체)

이 태스크 이후 `npm run typecheck`는 대량 실패한다 (구 타입을 쓰는 파일이 12개). Task 11까지 순차로 해소된다. 중간에 타입체크가 깨지는 것은 예상된 상태다.

- [ ] **Step 1: 타입을 교체한다**

`src/lib/types.ts`의 30~65행(`BulletinTable`부터 `Bulletin` 인터페이스 끝까지)을 아래로 교체한다:

```ts
/** 「이번 주 일정 · 공지」 통합 리스트 항목. when이 있으면 시간 배지를 앞에 붙인다. */
export interface BulletinNotice {
  title: string
  detail: string
  when?: string
}

/**
 * 원본 주보 면 이미지. 배열 순서가 면 순서다.
 * width·height는 full 기준이며 세 크기의 종횡비가 같으므로 한 번만 저장한다.
 */
export interface BulletinPage {
  width: number
  height: number
  /** 긴 변 2000px — 라이트박스 */
  fullUrl: string
  /** 긴 변 1000px — 인라인 큰 이미지, 목록 표지, 홈 카드 */
  previewUrl: string
  /** 긴 변 320px — 인라인 썸네일 스트립 */
  thumbUrl: string
}

export interface Bulletin {
  id: string
  bulletinDate: string
  volume: string
  issue: string
  sermonTitle: string
  /** 설교 본문 (예: 마태복음 7:24-27) */
  scripture: string
  preacher: string
  /** 찬송가 번호. 자유 텍스트 (예: 새 210장 · 통 40장) */
  hymns: string
  /** 교독문 번호 */
  responsiveReading: string
  /** 다음 주 예고 한 줄 */
  nextWeek: string
  /** R2 원본 PDF. 이미지를 직접 올린 경우 없다 */
  pdfUrl?: string
  notices: BulletinNotice[]
  pages: BulletinPage[]
  isPublished: boolean
}
```

`churchInfo` 필드는 뺐다. 새 상세 화면은 교회 주소·전화를 렌더하지 않으며, 필요한 컴포넌트는 `@/lib/church`의 `churchInfo`를 직접 import하면 된다 — 주보 레코드마다 같은 값을 실어 보낼 이유가 없다.

- [ ] **Step 2: 구 타입이 남아 있지 않은지 확인한다**

Run: `npx tsc --noEmit 2>&1 | grep -c "BulletinSection\|BulletinTable\|BulletinOffering"`
Expected: 0이 아닌 숫자 (구 타입을 참조하는 파일들이 아직 있다는 뜻 — Task 7~11에서 지운다). 이 숫자를 기록해 두고 Task 11에서 0이 되는지 확인한다.

- [ ] **Step 3: 커밋한다**

```bash
git add src/lib/types.ts
git commit -m "refactor: 주보 타입을 면 이미지·공지 기반으로 교체"
```

---

## Task 7: 스키마·마이그레이션

**Files:**
- Modify: `src/lib/db/schema.ts:1-13` (import), `:109-121` (bulletins 테이블)
- Create: `drizzle/<생성됨>.sql` (drizzle-kit이 만든 뒤 손으로 DELETE 추가)

- [ ] **Step 1: 스키마를 교체한다**

`src/lib/db/schema.ts` 1~13행의 import를 아래로 교체한다 (`uniqueIndex` 추가, 타입 import 교체):

```ts
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  jsonb,
  check,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { BulletinNotice, BulletinPage, SermonChapter } from '../types'
import type { ThumbnailCandidate, ThumbnailStyle, ThumbnailText } from '@/lib/thumbnails/types'
```

같은 파일 109~121행의 `bulletins` 테이블 정의를 아래로 교체한다:

```ts
export const bulletins = pgTable('bulletins', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  bulletinDate: date('bulletin_date').notNull(),
  volume: text('volume'),
  issue: text('issue'),
  sermonTitle: text('sermon_title'),
  scripture: text('scripture'),
  preacher: text('preacher'),
  hymns: text('hymns'),
  responsiveReading: text('responsive_reading'),
  nextWeek: text('next_week'),
  pdfUrl: text('pdf_url'),
  notices: jsonb('notices').$type<BulletinNotice[]>().notNull().default(sql`'[]'::jsonb`),
  pages: jsonb('pages').$type<BulletinPage[]>().notNull().default(sql`'[]'::jsonb`),
  isPublished: boolean('is_published').notNull().default(false),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('bulletins_published_date_idx').on(t.isPublished, t.bulletinDate),
  // 주보는 날짜로 식별된다. 같은 날짜를 다시 만드는 것은 항상 실수이며(수정하려면 편집한다),
  // 중복되면 목록에 같은 날짜가 두 번 나오고 홈 카드가 어느 것을 집을지 불확정해진다.
  uniqueIndex('bulletins_date_key').on(t.bulletinDate),
])
```

- [ ] **Step 2: 마이그레이션을 생성한다**

```bash
npm run db:generate
```

Expected: `drizzle/` 아래에 새 `.sql` 파일이 생기고, `ALTER TABLE "bulletins" DROP COLUMN "sections"`, `DROP COLUMN "theme"`, 8개 `ADD COLUMN`, `CREATE UNIQUE INDEX "bulletins_date_key"`가 포함된다.

- [ ] **Step 3: 생성된 SQL 맨 앞에 DELETE를 손으로 넣는다**

방금 생성된 `drizzle/*.sql` 파일의 **첫 줄 위**에 아래를 추가한다:

```sql
--> 기존 주보 레코드 전량 삭제 (사용자 확정). 파서 기반 sections 데이터는 새 스키마에서
--> 되살릴 수 없고, sermon_title·pages가 빈 행이 남으면 목록·상세가 깨진다.
--> 되돌릴 수 없다 — 실행 전 Neon 콘솔에서 브랜치 스냅샷을 떠 둘 것.
DELETE FROM "bulletins";
--> statement-breakpoint
```

- [ ] **Step 4: 마이그레이션 정합성을 확인한다**

```bash
npm run db:check
npm run test
```

Expected: `db:check`는 "Everything's fine" 류의 성공 출력. `npm run test`는 `src/lib/db/schema.test.ts`가 있으므로 통과해야 한다. 실패하면 스키마 테스트가 기대하는 컬럼 목록을 확인해 갱신한다.

**마이그레이션은 지금 실행하지 않는다.** 실행 시점은 Task 24의 배포 절차에 있다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: 주보 스키마를 면 이미지·공지 기반으로 재구성"
```

---

## Task 8: 입력 정규화 — `bulletin-editor.ts`

**Files:**
- Modify: `src/lib/bulletin-editor.ts` (전체 교체)
- Modify: `src/lib/bulletin-editor.test.ts` (전체 교체)

- [ ] **Step 1: 테스트를 전체 교체한다**

`src/lib/bulletin-editor.test.ts` 전체를 아래로 교체한다:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeBulletinInput, normalizeNotices, normalizePages } from './bulletin-editor'
import type { BulletinFormInput } from '@/lib/actions/bulletins'

const page = {
  width: 1414,
  height: 2000,
  fullUrl: 'https://cdn.example.com/bulletins/2026-07-26/u/1-full.webp',
  previewUrl: 'https://cdn.example.com/bulletins/2026-07-26/u/1-preview.webp',
  thumbUrl: 'https://cdn.example.com/bulletins/2026-07-26/u/1-thumb.webp',
}

describe('normalizeNotices', () => {
  it('앞뒤 공백을 지운다', () => {
    expect(normalizeNotices([{ title: '  여름성경학교 ', detail: ' 교육관 1층  ', when: ' 토 09:00 ' }])).toEqual([
      { title: '여름성경학교', detail: '교육관 1층', when: '토 09:00' },
    ])
  })

  it('when이 비면 키 자체를 뺀다 — 배지 분기가 undefined 하나만 보게 한다', () => {
    expect(normalizeNotices([{ title: '새가족 등록', detail: '3명', when: '   ' }])).toEqual([
      { title: '새가족 등록', detail: '3명' },
    ])
  })

  it('제목과 내용이 모두 비면 버린다', () => {
    expect(normalizeNotices([{ title: '  ', detail: '  ', when: '월 10:00' }])).toEqual([])
  })

  it('제목만 있어도 남긴다', () => {
    expect(normalizeNotices([{ title: '구역예배', detail: '' }])).toEqual([{ title: '구역예배', detail: '' }])
  })
})

describe('normalizePages', () => {
  it('정상 면은 그대로 통과시킨다', () => {
    expect(normalizePages([page])).toEqual([page])
  })

  it('세 URL 중 하나라도 비면 버린다', () => {
    expect(normalizePages([{ ...page, thumbUrl: '' }])).toEqual([])
    expect(normalizePages([{ ...page, previewUrl: '   ' }])).toEqual([])
  })

  it('폭·높이가 0 이하이거나 숫자가 아니면 버린다', () => {
    expect(normalizePages([{ ...page, width: 0 }])).toEqual([])
    expect(normalizePages([{ ...page, height: Number.NaN }])).toEqual([])
  })
})

describe('normalizeBulletinInput', () => {
  const input: BulletinFormInput = {
    bulletinDate: '2026-07-26',
    volume: ' 제12권 ',
    issue: ' 30호 ',
    sermonTitle: ' 흔들리지 않는 반석 위에 ',
    scripture: ' 마태복음 7:24-27 ',
    preacher: ' 김선찬 담임목사 ',
    hymns: ' 새 210장 · 통 40장 ',
    responsiveReading: ' 32번 ',
    nextWeek: '  ',
    pdfUrl: '   ',
    notices: [{ title: ' 구역예배 ', detail: ' 목 19:30 ', when: '' }],
    pages: [page, { ...page, fullUrl: '' }],
  }

  it('모든 스칼라를 trim한다', () => {
    const result = normalizeBulletinInput(input)
    expect(result.volume).toBe('제12권')
    expect(result.sermonTitle).toBe('흔들리지 않는 반석 위에')
    expect(result.preacher).toBe('김선찬 담임목사')
  })

  it('빈 nextWeek는 빈 문자열로 남긴다', () => {
    expect(normalizeBulletinInput(input).nextWeek).toBe('')
  })

  it('빈 pdfUrl은 undefined로 만든다', () => {
    expect(normalizeBulletinInput(input).pdfUrl).toBeUndefined()
  })

  it('공지와 면을 정규화해 넘긴다', () => {
    const result = normalizeBulletinInput(input)
    expect(result.notices).toEqual([{ title: '구역예배', detail: '목 19:30' }])
    expect(result.pages).toEqual([page])
  })

  it('bulletinDate는 건드리지 않는다', () => {
    expect(normalizeBulletinInput(input).bulletinDate).toBe('2026-07-26')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/bulletin-editor.test.ts`
Expected: FAIL — `normalizeNotices` / `normalizePages` 미정의

- [ ] **Step 3: 구현을 전체 교체한다**

`src/lib/bulletin-editor.ts` 전체를 아래로 교체한다:

```ts
import type { BulletinFormInput } from '@/lib/actions/bulletins'
import type { BulletinNotice, BulletinPage } from '@/lib/types'

/**
 * 공지 항목을 정규화한다.
 * when을 빈 문자열이 아니라 키 부재로 만드는 이유: 화면에서 시간 배지 유무를
 * `notice.when`의 truthy 판정 하나로 결정하도록 상태를 하나만 남긴다.
 */
export function normalizeNotices(value: BulletinNotice[]): BulletinNotice[] {
  return value
    .map((notice) => ({
      title: notice.title.trim(),
      detail: notice.detail.trim(),
      when: notice.when?.trim() ?? '',
    }))
    .filter((notice) => notice.title || notice.detail)
    .map(({ title, detail, when }) => ({ title, detail, ...(when ? { when } : {}) }))
}

/**
 * 면 이미지를 검증한다. 세 크기 URL과 유효한 치수가 모두 있어야 통과한다.
 * 업로드가 부분 실패한 면이 DB로 들어가면 라이트박스가 깨진 이미지를 띄운다.
 */
export function normalizePages(value: BulletinPage[]): BulletinPage[] {
  return value.filter(
    (page) =>
      page.fullUrl.trim() !== '' &&
      page.previewUrl.trim() !== '' &&
      page.thumbUrl.trim() !== '' &&
      Number.isFinite(page.width) &&
      Number.isFinite(page.height) &&
      page.width > 0 &&
      page.height > 0
  )
}

export function normalizeBulletinInput(input: BulletinFormInput): BulletinFormInput {
  return {
    bulletinDate: input.bulletinDate,
    volume: input.volume.trim(),
    issue: input.issue.trim(),
    sermonTitle: input.sermonTitle.trim(),
    scripture: input.scripture.trim(),
    preacher: input.preacher.trim(),
    hymns: input.hymns.trim(),
    responsiveReading: input.responsiveReading.trim(),
    nextWeek: input.nextWeek.trim(),
    pdfUrl: input.pdfUrl?.trim() || undefined,
    notices: normalizeNotices(input.notices),
    pages: normalizePages(input.pages),
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/bulletin-editor.test.ts`
Expected: FAIL — `BulletinFormInput`이 아직 새 필드를 갖지 않았다. Task 9를 먼저 끝내고 다시 돌린다.

> **주의:** 이 태스크와 Task 9는 서로의 타입을 참조하므로 함께 통과한다. Task 9의 Step 3까지 끝낸 뒤 `npx vitest run src/lib/bulletin-editor.test.ts src/lib/actions`를 돌려 둘을 같이 확인하고, 커밋도 그때 함께 한다.

- [ ] **Step 5: 커밋은 Task 9와 함께 한다** (여기서는 커밋하지 않음)

---

## Task 9: 서버 액션 — `actions/bulletins.ts`

**Files:**
- Modify: `src/lib/actions/bulletins.ts` (전체 교체)
- Create: `src/lib/actions/bulletins.test.ts`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/actions/bulletins.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 서버 액션 모듈은 db·r2·auth를 끌고 오므로 경계를 전부 mock한다.
// 검증 대상은 "업로드된 실물이 확인되지 않은 키를 저장하지 않는다"는 규칙 자체다.
const headR2Object = vi.fn()
const deleteFromR2 = vi.fn()

vi.mock('@/lib/dal', () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: 'admin-1' } })),
}))

vi.mock('@/lib/logger', () => ({ log: vi.fn(async () => {}) }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/r2', () => ({
  bulletinPageKey: (date: string, uploadId: string, n: number, size: string, ext: string) =>
    `bulletins/${date}/${uploadId}/${n}-${size}.${ext}`,
  bulletinPdfKey: (date: string, uploadId: string) => `bulletins/${date}/${uploadId}/original.pdf`,
  presignBulletinPut: vi.fn(async (key: string) => `https://signed.example.com/${key}`),
  publicUrlForKey: (key: string) => `https://cdn.example.com/${key}`,
  keyFromUrl: (url: string) =>
    url.startsWith('https://cdn.example.com/') ? url.slice('https://cdn.example.com/'.length) : '',
  headR2Object: (...args: unknown[]) => headR2Object(...args),
  deleteFromR2: (...args: unknown[]) => deleteFromR2(...args),
}))

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/db/schema', () => ({ bulletins: {} }))

const page = {
  width: 1414,
  height: 2000,
  fullUrl: 'https://cdn.example.com/bulletins/2026-07-26/u1/1-full.webp',
  previewUrl: 'https://cdn.example.com/bulletins/2026-07-26/u1/1-preview.webp',
  thumbUrl: 'https://cdn.example.com/bulletins/2026-07-26/u1/1-thumb.webp',
}

beforeEach(() => {
  vi.clearAllMocks()
  headR2Object.mockResolvedValue({ size: 1000, contentType: 'image/webp' })
})

describe('prepareBulletinUpload', () => {
  it('면 수 × 3크기만큼 서명 URL을 발급한다', async () => {
    const { prepareBulletinUpload } = await import('./bulletins')
    const result = await prepareBulletinUpload({
      date: '2026-07-26',
      pageCount: 2,
      hasPdf: false,
      imageMime: 'image/webp',
    })
    expect(result.pages).toHaveLength(6)
    expect(result.pdf).toBeUndefined()
    expect(result.uploadId).toBeTruthy()
  })

  it('hasPdf면 PDF 서명 URL도 함께 준다', async () => {
    const { prepareBulletinUpload } = await import('./bulletins')
    const result = await prepareBulletinUpload({
      date: '2026-07-26',
      pageCount: 1,
      hasPdf: true,
      imageMime: 'image/webp',
    })
    expect(result.pdf?.publicUrl).toContain('original.pdf')
  })

  it('jpeg 폴백이면 키 확장자가 jpg가 된다', async () => {
    const { prepareBulletinUpload } = await import('./bulletins')
    const result = await prepareBulletinUpload({
      date: '2026-07-26',
      pageCount: 1,
      hasPdf: false,
      imageMime: 'image/jpeg',
    })
    expect(result.pages.every((p) => p.publicUrl.endsWith('.jpg'))).toBe(true)
  })

  it('면 수 상한을 넘으면 거부한다', async () => {
    const { maxBulletinPages, prepareBulletinUpload } = await import('./bulletins')
    await expect(
      prepareBulletinUpload({
        date: '2026-07-26',
        pageCount: maxBulletinPages + 1,
        hasPdf: false,
        imageMime: 'image/webp',
      })
    ).rejects.toThrow('면 수는')
  })

  it('날짜 형식이 틀리면 거부한다', async () => {
    const { prepareBulletinUpload } = await import('./bulletins')
    await expect(
      prepareBulletinUpload({ date: '2026/07/26', pageCount: 1, hasPdf: false, imageMime: 'image/webp' })
    ).rejects.toThrow('bulletinDate is required')
  })
})

describe('assertBulletinAssets', () => {
  it('R2에 실물이 없으면 거부한다', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    headR2Object.mockResolvedValue(null)
    await expect(assertBulletinAssets([page], undefined)).rejects.toThrow('업로드된 파일을 찾을 수 없습니다')
  })

  it('우리 bulletins/ 키가 아닌 URL은 거부한다 — 임의 값 주입 차단', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    await expect(
      assertBulletinAssets([{ ...page, fullUrl: 'https://evil.example.com/x.webp' }], undefined)
    ).rejects.toThrow('invalid bulletin asset url')
  })

  it('gallery/ 키도 거부한다', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    await expect(
      assertBulletinAssets([{ ...page, thumbUrl: 'https://cdn.example.com/gallery/x.webp' }], undefined)
    ).rejects.toThrow('invalid bulletin asset url')
  })

  it('모든 키가 확인되면 통과한다', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    await expect(assertBulletinAssets([page], undefined)).resolves.toBeUndefined()
    expect(headR2Object).toHaveBeenCalledTimes(3)
  })

  it('pdfUrl이 있으면 그것도 확인한다', async () => {
    const { assertBulletinAssets } = await import('./bulletins')
    await assertBulletinAssets([page], 'https://cdn.example.com/bulletins/2026-07-26/u1/original.pdf')
    expect(headR2Object).toHaveBeenCalledTimes(4)
  })
})

describe('bulletinAssetKeys', () => {
  it('면 세 크기와 PDF 키를 모두 모은다 — 교체 시 정리 대상', async () => {
    const { bulletinAssetKeys } = await import('./bulletins')
    const keys = bulletinAssetKeys([page], 'https://cdn.example.com/bulletins/2026-07-26/u1/original.pdf')
    expect(keys).toEqual([
      'bulletins/2026-07-26/u1/1-full.webp',
      'bulletins/2026-07-26/u1/1-preview.webp',
      'bulletins/2026-07-26/u1/1-thumb.webp',
      'bulletins/2026-07-26/u1/original.pdf',
    ])
  })

  it('우리 키가 아닌 URL은 제외한다', async () => {
    const { bulletinAssetKeys } = await import('./bulletins')
    expect(bulletinAssetKeys([{ ...page, fullUrl: 'https://evil.example.com/x' }], undefined)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/actions/bulletins.test.ts`
Expected: FAIL — `prepareBulletinUpload` / `assertBulletinAssets` / `bulletinAssetKeys` 미정의

- [ ] **Step 3: 구현을 전체 교체한다**

`src/lib/actions/bulletins.ts` 전체를 아래로 교체한다:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/dal'
import { db } from '@/lib/db'
import { bulletins } from '@/lib/db/schema'
import { log } from '@/lib/logger'
import {
  bulletinPageKey,
  bulletinPdfKey,
  deleteFromR2,
  headR2Object,
  keyFromUrl,
  presignBulletinPut,
  publicUrlForKey,
  type BulletinImageExt,
  type BulletinPageSize,
} from '@/lib/r2'
import type { BulletinNotice, BulletinPage } from '@/lib/types'

/** PDF 면 수 상한. 주보는 보통 4~6면이며, 12면을 넘으면 잘못된 파일이다. */
export const maxBulletinPages = 12

export interface BulletinFormInput {
  bulletinDate: string
  volume: string
  issue: string
  sermonTitle: string
  scripture: string
  preacher: string
  hymns: string
  responsiveReading: string
  nextWeek: string
  pdfUrl?: string
  notices: BulletinNotice[]
  pages: BulletinPage[]
}

export type BulletinUploadMime = 'image/webp' | 'image/jpeg'

export interface BulletinUploadTarget {
  pageNumber: number
  size: BulletinPageSize
  /** presigned PUT URL */
  uploadUrl: string
  /** 저장할 공개 URL */
  publicUrl: string
}

export interface BulletinUploadPlan {
  uploadId: string
  pages: BulletinUploadTarget[]
  pdf?: { uploadUrl: string; publicUrl: string; contentDisposition: string }
}

const pageSizes = ['full', 'preview', 'thumb'] as const satisfies readonly BulletinPageSize[]

function revalidateBulletinPaths(id?: string) {
  revalidatePath('/')
  revalidatePath('/bulletins')
  revalidatePath('/admin/bulletins')
  if (id) {
    revalidatePath(`/bulletins/${id}`)
    revalidatePath(`/admin/bulletins/${id}/edit`)
  }
}

async function requireSession() {
  return requireAdmin()
}

function parseBulletinDate(value: string) {
  const date = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('bulletinDate is required')
  return date
}

function extForMime(mime: BulletinUploadMime): BulletinImageExt {
  return mime === 'image/webp' ? 'webp' : 'jpg'
}

/**
 * 업로드 id를 발급하고 면 세 크기 + (선택) 원본 PDF의 presigned PUT URL을 한 번에 준다.
 *
 * 액션 1회 + 브라우저 병렬 PUT이면 갤러리처럼 별도 API Route가 필요 없다.
 * 갤러리는 서버 액션이 직렬화되어 여러 장을 동시에 못 올려서 Route를 뒀다.
 */
export async function prepareBulletinUpload(input: {
  date: string
  pageCount: number
  hasPdf: boolean
  imageMime: BulletinUploadMime
}): Promise<BulletinUploadPlan> {
  await requireSession()
  const date = parseBulletinDate(input.date)
  if (!Number.isInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > maxBulletinPages) {
    throw new Error(`면 수는 1~${maxBulletinPages}장이어야 합니다.`)
  }
  if (input.imageMime !== 'image/webp' && input.imageMime !== 'image/jpeg') {
    throw new Error('unsupported image mime')
  }

  const uploadId = crypto.randomUUID()
  const ext = extForMime(input.imageMime)
  const pages: BulletinUploadTarget[] = []

  for (let pageNumber = 1; pageNumber <= input.pageCount; pageNumber += 1) {
    for (const size of pageSizes) {
      const key = bulletinPageKey(date, uploadId, pageNumber, size, ext)
      pages.push({
        pageNumber,
        size,
        uploadUrl: await presignBulletinPut(key, input.imageMime),
        publicUrl: publicUrlForKey(key),
      })
    }
  }

  if (!input.hasPdf) return { uploadId, pages }

  const pdfKey = bulletinPdfKey(date, uploadId)
  // 파일명은 ASCII로 둔다 — 한글 filename은 RFC5987 인코딩이 필요해 서명 헤더가 어긋나기 쉽다.
  const contentDisposition = `attachment; filename="bulletin-${date}.pdf"`
  return {
    uploadId,
    pages,
    pdf: {
      uploadUrl: await presignBulletinPut(pdfKey, 'application/pdf', contentDisposition),
      publicUrl: publicUrlForKey(pdfKey),
      contentDisposition,
    },
  }
}

/** 면·PDF URL에서 우리 R2의 bulletins/ 키만 뽑는다. 교체 시 정리 대상 목록이 된다. */
export function bulletinAssetKeys(pages: BulletinPage[], pdfUrl: string | undefined): string[] {
  const urls = [
    ...pages.flatMap((page) => [page.fullUrl, page.previewUrl, page.thumbUrl]),
    ...(pdfUrl ? [pdfUrl] : []),
  ]
  return urls.map(keyFromUrl).filter((key) => key.startsWith('bulletins/'))
}

/**
 * 저장 전에 업로드된 실물을 확인한다.
 *
 * presigned PUT은 Content-Length를 서명하지 않으므로 클라이언트가 보낸 값을 믿을 수 없고,
 * 애초에 클라이언트가 임의 URL을 폼에 실어 보낼 수도 있다. 우리 프리픽스인지 + HEAD로 존재하는지
 * 둘 다 확인한다.
 */
export async function assertBulletinAssets(pages: BulletinPage[], pdfUrl: string | undefined): Promise<void> {
  const urls = [
    ...pages.flatMap((page) => [page.fullUrl, page.previewUrl, page.thumbUrl]),
    ...(pdfUrl ? [pdfUrl] : []),
  ]
  for (const url of urls) {
    const key = keyFromUrl(url)
    if (!key.startsWith('bulletins/')) throw new Error('invalid bulletin asset url')
    let head: Awaited<ReturnType<typeof headR2Object>>
    try {
      head = await headR2Object(key)
    } catch {
      // 일시 장애를 "없음"으로 오판해 정상 업로드를 버리지 않는다
      throw new Error('파일 확인 중 일시 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (!head) throw new Error('업로드된 파일을 찾을 수 없습니다. 다시 시도해 주세요.')
  }
}

async function deleteR2BestEffort(key: string, userId: string) {
  if (!key) return
  try {
    await deleteFromR2(key)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log('error', 'r2_object', undefined, `failed to delete ${key}: ${message}`, userId)
  }
}

function isDuplicateDateError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = error instanceof Error ? error.message : ''
  return code === '23505' || message.includes('bulletins_date_key')
}

function toValues(input: BulletinFormInput) {
  return {
    bulletinDate: parseBulletinDate(input.bulletinDate),
    volume: input.volume.trim() || null,
    issue: input.issue.trim() || null,
    sermonTitle: input.sermonTitle.trim() || null,
    scripture: input.scripture.trim() || null,
    preacher: input.preacher.trim() || null,
    hymns: input.hymns.trim() || null,
    responsiveReading: input.responsiveReading.trim() || null,
    nextWeek: input.nextWeek.trim() || null,
    pdfUrl: input.pdfUrl?.trim() || null,
    notices: input.notices,
    pages: input.pages,
  }
}

export async function createBulletin(input: BulletinFormInput) {
  const s = await requireSession()
  await assertBulletinAssets(input.pages, input.pdfUrl)
  const values = toValues(input)

  let created: { id: string; title: string } | undefined
  try {
    const result = await db
      .insert(bulletins)
      .values({ ...values, isPublished: true, createdBy: s.user.id })
      .returning({ id: bulletins.id, title: bulletins.bulletinDate })
    created = result[0]
  } catch (error) {
    if (isDuplicateDateError(error)) {
      throw new Error('같은 날짜의 주보가 이미 있습니다. 기존 주보를 수정해 주세요.')
    }
    throw error
  }

  if (!created) throw new Error('failed to create bulletin')
  await log('create', 'bulletin', created.id, created.title, s.user.id)
  revalidateBulletinPaths(created.id)
  return created.id
}

export async function updateBulletin(id: string, input: BulletinFormInput) {
  const s = await requireSession()
  await assertBulletinAssets(input.pages, input.pdfUrl)

  const [previous] = await db
    .select({ pages: bulletins.pages, pdfUrl: bulletins.pdfUrl })
    .from(bulletins)
    .where(eq(bulletins.id, id))
    .limit(1)
  if (!previous) throw new Error('bulletin not found')

  const values = toValues(input)
  let updated: { id: string; title: string } | undefined
  try {
    const result = await db
      .update(bulletins)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(bulletins.id, id))
      .returning({ id: bulletins.id, title: bulletins.bulletinDate })
    updated = result[0]
  } catch (error) {
    if (isDuplicateDateError(error)) {
      throw new Error('같은 날짜의 주보가 이미 있습니다.')
    }
    throw error
  }
  if (!updated) throw new Error('bulletin not found')

  // DB가 새 세트를 가리킨 뒤에 옛 세트를 지운다. 순서를 뒤집으면 교체 실패 시 이미지가 사라진다.
  const nextKeys = new Set(bulletinAssetKeys(input.pages, input.pdfUrl))
  const staleKeys = bulletinAssetKeys(previous.pages ?? [], previous.pdfUrl ?? undefined).filter(
    (key) => !nextKeys.has(key)
  )
  await Promise.all(staleKeys.map((key) => deleteR2BestEffort(key, s.user.id)))

  await log('update', 'bulletin', updated.id, updated.title, s.user.id)
  revalidateBulletinPaths(updated.id)
}

export async function deleteBulletin(id: string) {
  const s = await requireSession()
  const [deleted] = await db
    .delete(bulletins)
    .where(eq(bulletins.id, id))
    .returning({
      id: bulletins.id,
      title: bulletins.bulletinDate,
      pages: bulletins.pages,
      pdfUrl: bulletins.pdfUrl,
    })
  if (!deleted) throw new Error('bulletin not found')

  const keys = bulletinAssetKeys(deleted.pages ?? [], deleted.pdfUrl ?? undefined)
  await Promise.all(keys.map((key) => deleteR2BestEffort(key, s.user.id)))

  await log('delete', 'bulletin', deleted.id, deleted.title, s.user.id)
  revalidateBulletinPaths(deleted.id)
}

export async function getBulletinForAdmin(id: string) {
  await requireAdmin()
  const [row] = await db.select().from(bulletins).where(eq(bulletins.id, id)).limit(1)
  return row
}

export async function getBulletinsForAdmin() {
  await requireAdmin()
  return db.select().from(bulletins).orderBy(desc(bulletins.bulletinDate))
}
```

> `and`, `gt`, `lt`는 Task 10의 데이터 레이어에서 쓰이므로 이 파일에서는 import하지 않는다. 위 import 목록에서 `and, gt, lt`를 지우고 `desc, eq`만 남긴다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/actions/bulletins.test.ts src/lib/bulletin-editor.test.ts`
Expected: PASS — 두 파일 합쳐 27 tests

- [ ] **Step 5: 커밋한다** (Task 8과 함께)

```bash
git add src/lib/bulletin-editor.ts src/lib/bulletin-editor.test.ts src/lib/actions/bulletins.ts src/lib/actions/bulletins.test.ts
git commit -m "feat: 주보 서버 액션을 업로드 스테이징·자산 검증 기반으로 재작성"
```

---

## Task 10: 데이터 레이어 — `data/bulletins.ts`

**Files:**
- Modify: `src/lib/data/bulletins.ts` (전체 교체)

- [ ] **Step 1: 전체를 교체한다**

`src/lib/data/bulletins.ts` 전체를 아래로 교체한다:

```ts
import { and, asc, desc, eq, gt, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bulletins as bulletinsTable, type BulletinRow } from '@/lib/db/schema'
import type { Bulletin } from '@/lib/types'

type BulletinListRow = Pick<
  BulletinRow,
  | 'id'
  | 'bulletinDate'
  | 'volume'
  | 'issue'
  | 'sermonTitle'
  | 'scripture'
  | 'preacher'
  | 'hymns'
  | 'responsiveReading'
  | 'nextWeek'
  | 'pdfUrl'
  | 'notices'
  | 'pages'
  | 'isPublished'
>

const bulletinColumns = {
  id: bulletinsTable.id,
  bulletinDate: bulletinsTable.bulletinDate,
  volume: bulletinsTable.volume,
  issue: bulletinsTable.issue,
  sermonTitle: bulletinsTable.sermonTitle,
  scripture: bulletinsTable.scripture,
  preacher: bulletinsTable.preacher,
  hymns: bulletinsTable.hymns,
  responsiveReading: bulletinsTable.responsiveReading,
  nextWeek: bulletinsTable.nextWeek,
  pdfUrl: bulletinsTable.pdfUrl,
  notices: bulletinsTable.notices,
  pages: bulletinsTable.pages,
  isPublished: bulletinsTable.isPublished,
}

function toBulletin(row: BulletinListRow): Bulletin {
  return {
    id: row.id,
    bulletinDate: row.bulletinDate,
    volume: row.volume ?? '',
    issue: row.issue ?? '',
    sermonTitle: row.sermonTitle ?? '',
    scripture: row.scripture ?? '',
    preacher: row.preacher ?? '',
    hymns: row.hymns ?? '',
    responsiveReading: row.responsiveReading ?? '',
    nextWeek: row.nextWeek ?? '',
    ...(row.pdfUrl ? { pdfUrl: row.pdfUrl } : {}),
    notices: row.notices ?? [],
    pages: row.pages ?? [],
    isPublished: row.isPublished,
  }
}

export async function getBulletins(): Promise<Bulletin[]> {
  const rows = await db
    .select(bulletinColumns)
    .from(bulletinsTable)
    .where(eq(bulletinsTable.isPublished, true))
    .orderBy(desc(bulletinsTable.bulletinDate))
  return rows.map(toBulletin)
}

export async function getBulletinById(id: string): Promise<Bulletin | undefined> {
  const rows = await db
    .select(bulletinColumns)
    .from(bulletinsTable)
    .where(and(eq(bulletinsTable.id, id), eq(bulletinsTable.isPublished, true)))
    .limit(1)
  return rows[0] ? toBulletin(rows[0]) : undefined
}

export async function getLatestBulletin(): Promise<Bulletin | undefined> {
  const rows = await db
    .select(bulletinColumns)
    .from(bulletinsTable)
    .where(eq(bulletinsTable.isPublished, true))
    .orderBy(desc(bulletinsTable.bulletinDate))
    .limit(1)
  return rows[0] ? toBulletin(rows[0]) : undefined
}

export interface BulletinNeighbor {
  id: string
  bulletinDate: string
}

/**
 * 상세 화면의 이전/다음 이동용. bulletin_date에 unique 제약이 있으므로
 * 날짜 비교만으로 인접 주보가 하나로 결정된다.
 */
export async function getAdjacentBulletins(
  bulletinDate: string
): Promise<{ previous?: BulletinNeighbor; next?: BulletinNeighbor }> {
  const columns = { id: bulletinsTable.id, bulletinDate: bulletinsTable.bulletinDate }

  const [previous] = await db
    .select(columns)
    .from(bulletinsTable)
    .where(and(eq(bulletinsTable.isPublished, true), lt(bulletinsTable.bulletinDate, bulletinDate)))
    .orderBy(desc(bulletinsTable.bulletinDate))
    .limit(1)

  const [next] = await db
    .select(columns)
    .from(bulletinsTable)
    .where(and(eq(bulletinsTable.isPublished, true), gt(bulletinsTable.bulletinDate, bulletinDate)))
    .orderBy(asc(bulletinsTable.bulletinDate))
    .limit(1)

  return {
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  }
}
```

- [ ] **Step 2: 타입만 확인한다** (DB 접근이라 단위 테스트 없음 — e2e가 Task 23에서 덮는다)

Run: `npx tsc --noEmit 2>&1 | grep "data/bulletins"`
Expected: 출력 없음 (이 파일에는 타입 오류가 없다)

- [ ] **Step 3: 커밋한다**

```bash
git add src/lib/data/bulletins.ts
git commit -m "feat: 주보 데이터 레이어 재작성 + 이전/다음 조회 추가"
```

---

## Task 11: HWP 파서·구 UI 삭제

**Files:**
- Delete: `src/lib/hwp/parse.ts`, `src/lib/hwp/parse.test.ts` (디렉터리 전체)
- Delete: `src/components/admin/BulletinHwpUpload.tsx`, `BulletinSectionEditor.tsx`, `BulletinSectionText.tsx`, `BulletinRowsEditor.tsx`, `BulletinTablesEditor.tsx`, `BulletinOfferingsEditor.tsx`
- Modify: `package.json` (`cfb` 제거)

- [ ] **Step 1: 삭제 전에 다른 소비처가 없는지 다시 확인한다**

```bash
grep -rn "lib/hwp\|from 'cfb'\|BulletinHwpUpload\|BulletinSectionEditor\|BulletinSectionText\|BulletinRowsEditor\|BulletinTablesEditor\|BulletinOfferingsEditor" src scripts e2e
```

Expected: `src/components/admin/BulletinForm.tsx`의 import만 남아 있어야 한다 (Task 22에서 재작성). 그 외 파일이 나오면 멈추고 보고한다.

- [ ] **Step 2: 삭제한다**

```bash
git rm -r src/lib/hwp
git rm src/components/admin/BulletinHwpUpload.tsx src/components/admin/BulletinSectionEditor.tsx src/components/admin/BulletinSectionText.tsx src/components/admin/BulletinRowsEditor.tsx src/components/admin/BulletinTablesEditor.tsx src/components/admin/BulletinOfferingsEditor.tsx
npm uninstall cfb
```

- [ ] **Step 3: 구 타입 참조가 0이 되었는지 확인한다**

```bash
npx tsc --noEmit 2>&1 | grep -c "BulletinSection\|BulletinTable\|BulletinOffering"
```

Expected: `0` — Task 6 Step 2에서 기록한 숫자가 0으로 떨어졌다. `BulletinForm.tsx`가 아직 깨져 있으므로 다른 타입 오류는 남아 있는 게 정상이다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm run test`
Expected: PASS — `hwp/parse.test.ts`가 사라지고 나머지가 통과한다

- [ ] **Step 5: 커밋한다**

```bash
git add -A
git commit -m "refactor: HWP 파서와 표 편집 UI 전량 삭제"
```

---

## Task 12: pdfjs-dist 도입 + 워커 배치

**Files:**
- Modify: `package.json` (의존성 + `predev`/`prebuild`)
- Create: `scripts/copy-pdf-worker.mjs`
- Modify: `.gitignore`

스펙은 `new Worker()` 번들링 검증을 요구하지만, **워커 파일을 `public/`에 복사해 `workerSrc`로 지정하는 방식을 1차로 택한다.** 번들러 동작에 의존하지 않아 개발·프로덕션이 동일하게 동작하고, 실패 지점이 "파일이 있나" 하나로 줄어든다.

- [ ] **Step 1: 의존성을 설치한다**

```bash
npm install pdfjs-dist
node -e "console.log(require('pdfjs-dist/package.json').version)"
```

Expected: 버전 문자열 출력 (예: `5.x.x`)

- [ ] **Step 2: 워커 파일 위치를 확인한다**

```bash
ls node_modules/pdfjs-dist/build/ | grep worker
```

Expected: `pdf.worker.min.mjs`가 목록에 있다. 이름이 다르면 아래 스크립트의 후보 목록에 실제 이름을 추가한다.

- [ ] **Step 3: 복사 스크립트를 만든다**

`scripts/copy-pdf-worker.mjs`:

```js
// pdfjs-dist 의 워커를 public/ 으로 복사한다.
//
// 번들러의 new Worker() 처리에 의존하지 않는 이유: Turbopack 개발 서버와 프로덕션
// 번들에서 동작이 갈릴 수 있고, 실패하면 원인 파악이 어렵다. public/ 에 놓고
// workerSrc 로 직접 가리키면 실패 지점이 "파일이 있나" 하나로 줄어든다.
//
// predev/prebuild 에서 돌기 때문에 pdfjs-dist 를 올릴 때 따로 챙길 일이 없다.

import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const candidates = ['pdf.worker.min.mjs', 'pdf.worker.mjs']

const pkgPath = require.resolve('pdfjs-dist/package.json')
const buildDir = path.join(path.dirname(pkgPath), 'build')
const publicDir = path.join(process.cwd(), 'public')

let copied = false
for (const name of candidates) {
  try {
    await mkdir(publicDir, { recursive: true })
    await copyFile(path.join(buildDir, name), path.join(publicDir, 'pdf.worker.min.mjs'))
    console.log(`[copy-pdf-worker] ${name} -> public/pdf.worker.min.mjs`)
    copied = true
    break
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

if (!copied) {
  console.error(`[copy-pdf-worker] 워커 파일을 찾지 못했습니다. 확인 대상: ${buildDir}`)
  process.exit(1)
}
```

- [ ] **Step 4: package.json에 훅을 추가한다**

`package.json`의 `scripts`에 두 줄을 추가한다 (`dev`, `build` 바로 위):

```json
    "predev": "node scripts/copy-pdf-worker.mjs",
    "prebuild": "node scripts/copy-pdf-worker.mjs",
```

- [ ] **Step 5: 산출물을 git에서 제외한다**

`.gitignore` 맨 끝에 추가한다:

```
# pdfjs 워커는 prebuild/predev 가 node_modules 에서 복사한다
/public/pdf.worker.min.mjs
```

- [ ] **Step 6: 실제로 복사되는지 확인한다**

```bash
node scripts/copy-pdf-worker.mjs
ls -la public/pdf.worker.min.mjs
```

Expected: `[copy-pdf-worker] pdf.worker.min.mjs -> public/pdf.worker.min.mjs` 출력 후 파일이 존재한다

- [ ] **Step 7: 커밋한다**

```bash
git add package.json package-lock.json scripts/copy-pdf-worker.mjs .gitignore
git commit -m "chore: pdfjs-dist 도입 및 워커를 public으로 복사하는 빌드 훅 추가"
```

---

## Task 13: PDF·이미지 → 면 이미지 변환 — `bulletin-pdf.ts`

**Files:**
- Create: `src/lib/bulletin-pdf.ts`
- Test: `src/lib/bulletin-pdf.test.ts`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/bulletin-pdf.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeCanvas, maxBulletinFileSize, maxBulletinPages, validateOriginFile } from './bulletin-pdf'

describe('validateOriginFile', () => {
  it('40MB를 넘는 파일을 거부한다', () => {
    expect(validateOriginFile({ size: maxBulletinFileSize + 1, type: 'application/pdf' })).toBe(
      '파일이 너무 큽니다. 40MB 이하로 올려주세요.'
    )
  })

  it('PDF와 이미지를 허용한다', () => {
    expect(validateOriginFile({ size: 1000, type: 'application/pdf' })).toBeNull()
    expect(validateOriginFile({ size: 1000, type: 'image/png' })).toBeNull()
    expect(validateOriginFile({ size: 1000, type: 'image/jpeg' })).toBeNull()
  })

  it('그 외 형식을 거부한다', () => {
    expect(validateOriginFile({ size: 1000, type: 'application/x-hwp' })).toBe(
      'PDF 또는 이미지 파일만 올릴 수 있습니다.'
    )
  })
})

describe('maxBulletinPages', () => {
  it('12면이 상한이다', () => {
    expect(maxBulletinPages).toBe(12)
  })
})

describe('encodeCanvas', () => {
  function fakeCanvas(results: Record<string, Blob | null>) {
    return {
      toBlob: (callback: (blob: Blob | null) => void, mime: string) => callback(results[mime] ?? null),
    } as unknown as HTMLCanvasElement
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('webp 인코딩이 되면 webp로 준다', async () => {
    const webp = new Blob(['webp'], { type: 'image/webp' })
    const result = await encodeCanvas(fakeCanvas({ 'image/webp': webp }), 'image/webp')
    expect(result).toEqual({ blob: webp, mime: 'image/webp' })
  })

  it('webp가 null이면 jpeg로 폴백한다 — 구형 사파리 대응', async () => {
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' })
    const result = await encodeCanvas(fakeCanvas({ 'image/webp': null, 'image/jpeg': jpeg }), 'image/webp')
    expect(result).toEqual({ blob: jpeg, mime: 'image/jpeg' })
  })

  it('jpeg를 요청하면 webp를 시도하지 않는다', async () => {
    const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' })
    const canvas = fakeCanvas({ 'image/webp': new Blob(['x']), 'image/jpeg': jpeg })
    const result = await encodeCanvas(canvas, 'image/jpeg')
    expect(result.mime).toBe('image/jpeg')
  })

  it('둘 다 실패하면 던진다', async () => {
    await expect(encodeCanvas(fakeCanvas({}), 'image/webp')).rejects.toThrow(
      '이미지 변환에 실패했습니다'
    )
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/bulletin-pdf.test.ts`
Expected: FAIL — `Failed to resolve import "./bulletin-pdf"`

- [ ] **Step 3: 최소 구현을 작성한다**

`src/lib/bulletin-pdf.ts`:

```ts
// 브라우저 전용 모듈. 관리자 화면에서만 동적 import 한다.
//
// 서버에서 변환하지 않는 이유: sharp 는 Vercel 에서 PDF 를 읽지 못한다
// (libvips 에 poppler/pdfium 이 없다). 브라우저 변환이면 서버 네이티브 의존성이 0이다.

import { bulletinSizeNames, bulletinSizes, scaleToLongEdge, type BulletinSizeName } from '@/lib/bulletin-scale'

export const maxBulletinPages = 12
export const maxBulletinFileSize = 40 * 1024 * 1024

export type RenderedMime = 'image/webp' | 'image/jpeg'

export interface RenderedPage {
  pageNumber: number
  /** full 기준 치수 */
  width: number
  height: number
  blobs: Record<BulletinSizeName, Blob>
}

export interface RenderResult {
  mime: RenderedMime
  pages: RenderedPage[]
}

/** 업로드 전 형식·크기 검사. 문제가 없으면 null, 있으면 사용자에게 보여줄 메시지. */
export function validateOriginFile(file: { size: number; type: string }): string | null {
  if (file.size > maxBulletinFileSize) return '파일이 너무 큽니다. 40MB 이하로 올려주세요.'
  if (file.type === 'application/pdf') return null
  if (file.type.startsWith('image/')) return null
  return 'PDF 또는 이미지 파일만 올릴 수 있습니다.'
}

function toBlob(canvas: HTMLCanvasElement, mime: RenderedMime): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mime, 0.82))
}

/**
 * canvas 를 인코딩한다. webp 를 요청했는데 브라우저가 지원하지 않으면(toBlob 이 null)
 * jpeg 로 폴백한다. 폴백하면 이후 모든 면이 같은 mime 을 써야 하므로 결과에 mime 을 실어 보낸다.
 */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  preferred: RenderedMime
): Promise<{ blob: Blob; mime: RenderedMime }> {
  if (preferred === 'image/webp') {
    const webp = await toBlob(canvas, 'image/webp')
    if (webp) return { blob: webp, mime: 'image/webp' }
  }
  const jpeg = await toBlob(canvas, 'image/jpeg')
  if (jpeg) return { blob: jpeg, mime: 'image/jpeg' }
  throw new Error('이미지 변환에 실패했습니다. 다른 브라우저에서 시도해 주세요.')
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('캔버스를 만들 수 없습니다.')
  return { canvas, context }
}

/** 렌더가 끝난 canvas 를 즉시 해제한다. iOS Safari 는 이걸 빼면 몇 면 만에 메모리가 터진다. */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

/** 원본 canvas 에서 세 크기 blob 을 만든다. */
async function encodeThreeSizes(
  source: HTMLCanvasElement,
  sourceWidth: number,
  sourceHeight: number,
  preferred: RenderedMime
) {
  const blobs = {} as Record<BulletinSizeName, Blob>
  let mime = preferred
  for (const name of bulletinSizeNames) {
    const scaled = scaleToLongEdge(sourceWidth, sourceHeight, bulletinSizes[name])
    const { canvas, context } = makeCanvas(scaled.width, scaled.height)
    try {
      context.drawImage(source, 0, 0, scaled.width, scaled.height)
      const encoded = await encodeCanvas(canvas, mime)
      blobs[name] = encoded.blob
      mime = encoded.mime
    } finally {
      releaseCanvas(canvas)
    }
  }
  return { blobs, mime }
}

/**
 * PDF 를 면별로 렌더해 면당 세 크기 blob 을 만든다.
 * 면을 순차 처리하는 이유: 병렬 렌더는 iOS Safari 의 canvas 메모리를 터뜨린다.
 */
export async function renderPdfToPages(file: File): Promise<RenderResult> {
  const pdfjs = await import('pdfjs-dist')
  // 번들러의 워커 처리에 의존하지 않는다 — prebuild 가 public/ 으로 복사해 둔 파일을 쓴다.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  try {
    if (doc.numPages > maxBulletinPages) {
      throw new Error(`면 수가 너무 많습니다. ${maxBulletinPages}면 이하 PDF만 올릴 수 있습니다.`)
    }

    const pages: RenderedPage[] = []
    let mime: RenderedMime = 'image/webp'

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      try {
        const base = page.getViewport({ scale: 1 })
        const target = scaleToLongEdge(base.width, base.height, bulletinSizes.full)
        const viewport = page.getViewport({ scale: target.scale })
        const { canvas, context } = makeCanvas(Math.round(viewport.width), Math.round(viewport.height))
        try {
          await page.render({ canvas, canvasContext: context, viewport }).promise
          const encoded = await encodeThreeSizes(canvas, canvas.width, canvas.height, mime)
          mime = encoded.mime
          pages.push({ pageNumber, width: canvas.width, height: canvas.height, blobs: encoded.blobs })
        } finally {
          releaseCanvas(canvas)
        }
      } finally {
        page.cleanup()
      }
    }

    return { mime, pages }
  } finally {
    await doc.destroy()
  }
}

/** 이미지 파일 여러 장을 면으로 받는다. PDF 경로와 같은 규칙으로 세 크기를 만든다. */
export async function renderImagesToPages(files: File[]): Promise<RenderResult> {
  if (files.length > maxBulletinPages) {
    throw new Error(`면 수가 너무 많습니다. ${maxBulletinPages}장 이하로 올려주세요.`)
  }

  const pages: RenderedPage[] = []
  let mime: RenderedMime = 'image/webp'

  for (const [index, file] of files.entries()) {
    const url = URL.createObjectURL(file)
    try {
      const image = await loadImage(url)
      const target = scaleToLongEdge(image.naturalWidth, image.naturalHeight, bulletinSizes.full)
      const { canvas, context } = makeCanvas(target.width, target.height)
      try {
        context.drawImage(image, 0, 0, target.width, target.height)
        const encoded = await encodeThreeSizes(canvas, canvas.width, canvas.height, mime)
        mime = encoded.mime
        pages.push({
          pageNumber: index + 1,
          width: canvas.width,
          height: canvas.height,
          blobs: encoded.blobs,
        })
      } finally {
        releaseCanvas(canvas)
      }
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return { mime, pages }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
    image.src = url
  })
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/bulletin-pdf.test.ts`
Expected: PASS — 8 tests

`renderPdfToPages`·`renderImagesToPages`는 DOM과 pdf.js 워커가 필요해 node 환경에서 단위 테스트하지 않는다. Task 21의 수동 확인과 Task 23의 e2e가 덮는다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/bulletin-pdf.ts src/lib/bulletin-pdf.test.ts
git commit -m "feat: PDF·이미지를 면당 세 크기 이미지로 변환하는 클라이언트 모듈 추가"
```

---

## Task 14: 날짜 표기 + 한눈에 카드 3종

**Files:**
- Create: `src/lib/bulletin-format.ts`
- Test: `src/lib/bulletin-format.test.ts`
- Create: `src/components/bulletins/BulletinGlance.tsx`
- Create: `src/components/bulletins/BulletinWorshipTimes.tsx`
- Create: `src/components/bulletins/BulletinNotices.tsx`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/lib/bulletin-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatBulletinDate, formatIssueLabel, formatPageAlt } from './bulletin-format'

describe('formatBulletinDate', () => {
  it('YYYY-MM-DD를 점 표기로 바꾼다', () => {
    expect(formatBulletinDate('2026-07-26')).toBe('2026. 7. 26')
  })

  it('앞자리 0을 지운다', () => {
    expect(formatBulletinDate('2026-01-04')).toBe('2026. 1. 4')
  })

  it('형식이 다르면 원본을 그대로 준다 — 화면이 깨지지 않게', () => {
    expect(formatBulletinDate('unknown')).toBe('unknown')
  })
})

describe('formatIssueLabel', () => {
  it('권과 호를 이어 붙인다', () => {
    expect(formatIssueLabel('제12권', '30호')).toBe('제12권 30호')
  })

  it('한쪽만 있으면 그것만 준다', () => {
    expect(formatIssueLabel('제12권', '')).toBe('제12권')
    expect(formatIssueLabel('', '30호')).toBe('30호')
  })

  it('둘 다 없으면 빈 문자열 — 호출부가 렌더를 생략한다', () => {
    expect(formatIssueLabel('', '')).toBe('')
    expect(formatIssueLabel('  ', '  ')).toBe('')
  })
})

describe('formatPageAlt', () => {
  it('스크린리더용 면 위치를 알린다', () => {
    expect(formatPageAlt('2026-07-26', 3)).toBe('2026년 7월 26일 주보 3면')
  })

  it('날짜 형식이 다르면 날짜를 그대로 쓴다', () => {
    expect(formatPageAlt('unknown', 1)).toBe('unknown 주보 1면')
  })
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/bulletin-format.test.ts`
Expected: FAIL — `Failed to resolve import "./bulletin-format"`

- [ ] **Step 3: 구현을 작성한다**

`src/lib/bulletin-format.ts`:

```ts
// bulletin_date 는 date 컬럼이라 'YYYY-MM-DD' 문자열로 온다.
// new Date() 로 파싱하면 UTC 로 해석돼 하루가 밀릴 수 있으므로 문자열을 그대로 쪼갠다.
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(value: string) {
  const match = value.match(isoDatePattern)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/** 화면 표기용. 예: `2026. 7. 26` */
export function formatBulletinDate(value: string): string {
  const p = parts(value)
  if (!p) return value
  return `${p.year}. ${p.month}. ${p.day}`
}

/** 권·호 아이브로우. 둘 다 비면 빈 문자열이며 호출부가 렌더를 생략한다. */
export function formatIssueLabel(volume: string, issue: string): string {
  return [volume.trim(), issue.trim()].filter(Boolean).join(' ')
}

/**
 * 면 이미지 alt. 이미지 방식은 본문을 스크린리더에 전달하지 못하므로
 * 최소한 어느 주보의 몇 번째 면인지는 알린다.
 */
export function formatPageAlt(bulletinDate: string, pageNumber: number): string {
  const p = parts(bulletinDate)
  const label = p ? `${p.year}년 ${p.month}월 ${p.day}일` : bulletinDate
  return `${label} 주보 ${pageNumber}면`
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/bulletin-format.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: 한눈에 카드를 만든다**

`src/components/bulletins/BulletinGlance.tsx`:

```tsx
import { formatBulletinDate, formatIssueLabel } from '@/lib/bulletin-format'
import type { Bulletin } from '@/lib/types'

/**
 * 「이번 주 한눈에」 카드.
 *
 * 원본 이미지는 모바일에서 확대 없이 읽히지 않는다. 이 카드가 관리자가 직접 타이핑한
 * 텍스트로 그 공백을 메우고, 동시에 이미지 방식이 잃는 검색·스크린리더 접근성을 되살린다.
 */
export default function BulletinGlance({ bulletin }: { bulletin: Bulletin }) {
  const issueLabel = formatIssueLabel(bulletin.volume, bulletin.issue)
  const eyebrow = [formatBulletinDate(bulletin.bulletinDate), issueLabel].filter(Boolean).join(' · ')

  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#0B1F5C] to-[#071540] p-7 text-white shadow-lifted sm:p-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold-soft">{eyebrow}</p>
      <span aria-hidden className="mt-3 block h-0.5 w-9 bg-gold" />
      {bulletin.sermonTitle ? (
        <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
          {bulletin.sermonTitle}
        </h2>
      ) : null}
      {(bulletin.scripture || bulletin.preacher) && (
        <p className="mt-3 text-sm text-[#B9C4DE]">
          {bulletin.scripture}
          {bulletin.scripture && bulletin.preacher ? ' · ' : ''}
          {bulletin.preacher ? <b className="font-bold text-gold-soft">{bulletin.preacher}</b> : null}
        </p>
      )}
      {(bulletin.hymns || bulletin.responsiveReading) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {bulletin.hymns ? <Chip label="찬송" value={bulletin.hymns} /> : null}
          {bulletin.responsiveReading ? <Chip label="교독" value={bulletin.responsiveReading} /> : null}
        </div>
      )}
    </section>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-gold-soft/30 bg-white/10 px-3 py-1 text-[11px]">
      <b className="mr-1.5 font-bold text-gold-soft">{label}</b>
      {value}
    </span>
  )
}
```

- [ ] **Step 6: 예배 시간 블록을 만든다**

`src/components/bulletins/BulletinWorshipTimes.tsx`:

```tsx
import { adultWorshipSchedule } from '@/lib/worship'

// 주보마다 바뀌지 않는 고정 일정이라 worship.ts 에서 그대로 가져온다.
// 관리자가 매주 다시 입력할 이유가 없다.
const shown = ['주일예배', '찬양예배', '수요예배'] as const

export default function BulletinWorshipTimes() {
  const items = shown
    .map((name) => adultWorshipSchedule.find((item) => item.name === name))
    .filter((item): item is (typeof adultWorshipSchedule)[number] => Boolean(item))

  return (
    <section className="rounded-2xl bg-beige p-6">
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">예배 시간</h2>
      <dl className="mt-3 divide-y divide-ink/10">
        {items.map((item) => (
          <div key={item.name} className="flex items-baseline justify-between gap-4 py-2 text-sm">
            <dt className="font-bold text-ink">{item.name}</dt>
            <dd className="text-ink-muted">
              {item.time} · {item.place}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
```

- [ ] **Step 7: 일정·공지 리스트를 만든다**

`src/components/bulletins/BulletinNotices.tsx`:

```tsx
import type { BulletinNotice } from '@/lib/types'

/**
 * 「이번 주 일정 · 공지」 통합 리스트.
 *
 * 특별일정과 공지를 한 배열로 합친 이유: 따로 두면 특별일정이 2개 이상일 때
 * 카드 그리드가 깨진다. when 유무로 배지만 갈리는 단일 리스트면 개수에 무관하게 렌더된다.
 */
export default function BulletinNotices({ notices }: { notices: BulletinNotice[] }) {
  if (notices.length === 0) return null

  return (
    <section className="rounded-2xl border border-line bg-paper p-6">
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">
        이번 주 일정 · 공지
      </h2>
      <ul className="mt-3 divide-y divide-line-soft">
        {notices.map((notice, index) => (
          <li key={`${notice.title}-${index}`} className="flex gap-3 py-2.5">
            <span
              className={
                notice.when
                  ? 'h-fit shrink-0 rounded-md bg-[#0B1F5C] px-2 py-1 text-[10px] font-extrabold text-gold-soft'
                  : 'h-fit shrink-0 rounded-md bg-line-soft px-2 py-1 text-[10px] font-extrabold text-faint'
              }
            >
              {notice.when || '공지'}
            </span>
            <div className="min-w-0">
              {notice.title ? <h3 className="text-sm font-extrabold text-ink">{notice.title}</h3> : null}
              {notice.detail ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{notice.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 8: 커밋한다**

```bash
git add src/lib/bulletin-format.ts src/lib/bulletin-format.test.ts src/components/bulletins/BulletinGlance.tsx src/components/bulletins/BulletinWorshipTimes.tsx src/components/bulletins/BulletinNotices.tsx
git commit -m "feat: 한눈에 카드·예배시간·공지 리스트 컴포넌트 추가"
```

---

## Task 15: 라이트박스 — `BulletinLightbox.tsx`

**Files:**
- Create: `src/components/bulletins/BulletinLightbox.tsx`

판정 로직은 Task 2·3의 순수 함수에 있다. 이 컴포넌트는 상태 보관과 렌더링만 한다.

- [ ] **Step 1: 컴포넌트를 만든다**

`src/components/bulletins/BulletinLightbox.tsx`:

```tsx
'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatPageAlt } from '@/lib/bulletin-format'
import {
  lastSpreadStart,
  moveSpread,
  pagesPerSpread,
  realignSpread,
  spreadLabel,
  spreadPageIndexes,
  spreadStartForPage,
} from '@/lib/bulletin-spread'
import { isDraggable, nextZoom, offsetForStep, zoomScale, type Offset, type ZoomStep } from '@/lib/bulletin-zoom'
import type { BulletinPage } from '@/lib/types'

/** 스와이프로 인정할 최소 가로 이동 거리(px). 이보다 짧으면 탭으로 본다. */
const swipeThreshold = 50

interface BulletinLightboxProps {
  pages: BulletinPage[]
  bulletinDate: string
  startPageIndex: number
  pdfUrl?: string
  onClose: () => void
}

/**
 * 전체화면 스프레드 뷰어.
 *
 * Fullscreen API 에 의존하지 않는다 — iOS Safari 는 <video> 외의 요소에
 * requestFullscreen() 을 지원하지 않는다. position:fixed 오버레이로 구현하고
 * Fullscreen 은 지원되는 환경에서만 부가로 건다.
 */
export default function BulletinLightbox({
  pages,
  bulletinDate,
  startPageIndex,
  pdfUrl,
  onClose,
}: BulletinLightboxProps) {
  const initialPerSpread = typeof window === 'undefined' ? 1 : pagesPerSpread(window.innerWidth)
  const [perSpread, setPerSpread] = useState(initialPerSpread)
  // 진입 면을 스프레드 경계로 정렬해 둔다. 정렬하지 않으면 이후 moveSpread 가
  // 어긋난 기준에서 계산돼 다음 면으로 가야 할 때 뒤로 돌아가는 일이 생긴다.
  const [start, setStart] = useState(() => spreadStartForPage(startPageIndex, pages.length, initialPerSpread))
  const [zoom, setZoom] = useState<ZoomStep>('fit')
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [showStrip, setShowStrip] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ pointerId: number; originX: number; originY: number; from: Offset } | null>(null)

  const indexes = useMemo(() => spreadPageIndexes(start, pages.length, perSpread), [start, pages.length, perSpread])

  // 스프레드 콘텐츠의 자연 크기 — 나란히 붙인 폭 합계와 최대 높이
  const content = useMemo(() => {
    const shown = indexes.map((index) => pages[index]).filter(Boolean)
    return {
      width: shown.reduce((sum, page) => sum + page.width, 0),
      height: shown.reduce((max, page) => Math.max(max, page.height), 0),
    }
  }, [indexes, pages])

  const move = useCallback(
    (delta: -1 | 1) => {
      setStart((current) => moveSpread(current, delta, pages.length, perSpread))
      setZoom('fit')
      setOffset({ x: 0, y: 0 })
    },
    [pages.length, perSpread]
  )

  // 폭이 바뀌면 현재 스프레드의 첫 면을 유지한 채 재정렬한다
  useEffect(() => {
    function onResize() {
      const next = pagesPerSpread(window.innerWidth)
      setPerSpread((current) => {
        if (current === next) return current
        setStart((currentStart) => realignSpread(currentStart, pages.length, next))
        return next
      })
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pages.length])

  // 다음 스프레드 한 세트만 미리 받는다. 2000px WebP 는 장당 300~600KB 라
  // 전부 프리로드하면 6면짜리에서 3MB 가까이 낭비된다.
  useEffect(() => {
    const nextStart = moveSpread(start, 1, pages.length, perSpread)
    if (nextStart === start) return
    const preloaded = spreadPageIndexes(nextStart, pages.length, perSpread).map((index) => {
      const image = new window.Image()
      image.src = pages[index].fullUrl
      return image
    })
    return () => {
      for (const image of preloaded) image.src = ''
    }
  }, [start, perSpread, pages])

  // 열릴 때 포커스를 닫기 버튼으로 옮기고 배경 스크롤을 잠근다
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  // Escape 로 닫고, 방향키로 스프레드를 넘기며, Tab 포커스를 오버레이 안에 가둔다
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = stageRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [move, onClose])

  function applyZoom(step: ZoomStep) {
    const viewport = stageRef.current?.getBoundingClientRect()
    const size = { width: viewport?.width ?? 0, height: viewport?.height ?? 0 }
    setZoom(step)
    setOffset(offsetForStep(step, offset, size, content))
  }

  // 확대 상태에서는 드래그가 화면 이동이고, 맞춤 상태에서는 같은 제스처가 스프레드 넘김이다.
  // 스펙: "줌이 맞춤이 아닐 때는 스프레드 단위 이동 대신 드래그가 우선한다"
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { pointerId: event.pointerId, originX: event.clientX, originY: event.clientY, from: offset }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!isDraggable(zoom)) return
    const viewport = stageRef.current?.getBoundingClientRect()
    const size = { width: viewport?.width ?? 0, height: viewport?.height ?? 0 }
    const moved = {
      x: drag.from.x + (event.clientX - drag.originX),
      y: drag.from.y + (event.clientY - drag.originY),
    }
    setOffset(offsetForStep(zoom, moved, size, content))
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (isDraggable(zoom)) return

    const dx = event.clientX - drag.originX
    const dy = event.clientY - drag.originY
    // 세로로 더 많이 움직였으면 스크롤 의도로 보고 무시한다
    if (Math.abs(dx) < swipeThreshold || Math.abs(dx) <= Math.abs(dy)) return
    move(dx < 0 ? 1 : -1)
  }

  const viewportRect = stageRef.current?.getBoundingClientRect()
  const scale = zoomScale(zoom, { width: viewportRect?.width ?? 0, height: viewportRect?.height ?? 0 }, content)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulletin-lightbox-title"
      className="fixed inset-0 z-50 flex flex-col bg-[#14171d]"
    >
      <h2 id="bulletin-lightbox-title" className="sr-only">
        원본 주보 크게 보기
      </h2>

      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ToolButton onClick={() => setShowStrip((v) => !v)} pressed={showStrip} label="면 목록">
            면 목록
          </ToolButton>
          <ToolButton onClick={() => applyZoom('fit')} pressed={zoom === 'fit'} label="화면에 맞춤">
            맞춤
          </ToolButton>
          <ToolButton onClick={() => applyZoom('1x')} pressed={zoom === '1x'} label="원래 크기">
            1×
          </ToolButton>
          <ToolButton onClick={() => applyZoom('2x')} pressed={zoom === '2x'} label="2배 확대">
            2×
          </ToolButton>
          <ToolButton onClick={() => applyZoom(nextZoom(zoom, 1))} label="한 단계 확대">
            ＋
          </ToolButton>
        </div>
        <p className="text-xs font-bold text-white/60">{spreadLabel(start, pages.length, perSpread)}</p>
        <div className="flex items-center gap-1.5">
          {pdfUrl ? (
            <a
              href={pdfUrl}
              className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/20"
            >
              PDF 저장
            </a>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/20"
          >
            닫기
          </button>
        </div>
      </div>

      {showStrip ? (
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2">
          {pages.map((page, index) => (
            <button
              key={page.thumbUrl}
              type="button"
              onClick={() => {
                setStart(realignSpread(index, pages.length, perSpread))
                setZoom('fit')
                setOffset({ x: 0, y: 0 })
              }}
              className={
                indexes.includes(index)
                  ? 'shrink-0 rounded border-2 border-gold'
                  : 'shrink-0 rounded border border-white/20'
              }
            >
              <Image
                src={page.thumbUrl}
                alt={formatPageAlt(bulletinDate, index + 1)}
                width={48}
                height={Math.round((48 * page.height) / page.width)}
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-1 items-center gap-2 overflow-hidden px-2 py-3">
        <NavButton onClick={() => move(-1)} label="이전 면" disabled={start === 0}>
          ‹
        </NavButton>
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          style={{ cursor: isDraggable(zoom) ? 'grab' : 'default', touchAction: 'none' }}
        >
          <div
            className="flex items-start gap-2"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            {indexes.map((index) => (
              <SpreadPage
                key={pages[index].fullUrl}
                page={pages[index]}
                alt={formatPageAlt(bulletinDate, index + 1)}
              />
            ))}
          </div>
        </div>
        <NavButton
          onClick={() => move(1)}
          label="다음 면"
          disabled={start >= lastSpreadStart(pages.length, perSpread)}
        >
          ›
        </NavButton>
      </div>
    </div>
  )
}

/**
 * 인라인에서 이미 받아둔 preview 를 먼저 깔고, full 로드가 끝나면 그 위로 덮는다.
 * 라이트박스를 열자마자 흰 화면을 보지 않게 하는 것이 목적이다.
 */
function SpreadPage({ page, alt }: { page: BulletinPage; alt: string }) {
  const [fullLoaded, setFullLoaded] = useState(false)

  return (
    <div className="relative bg-white" style={{ width: page.width, height: page.height }}>
      <Image
        src={page.previewUrl}
        alt=""
        aria-hidden
        fill
        unoptimized
        sizes="100vw"
        className="object-contain"
      />
      <Image
        src={page.fullUrl}
        alt={alt}
        fill
        unoptimized
        priority
        sizes="100vw"
        onLoad={() => setFullLoaded(true)}
        className={fullLoaded ? 'object-contain opacity-100' : 'object-contain opacity-0'}
      />
    </div>
  )
}

function ToolButton({
  onClick,
  pressed,
  label,
  children,
}: {
  onClick: () => void
  pressed?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={
        pressed
          ? 'rounded-md bg-[#0B1F5C] px-2.5 py-1.5 text-xs font-bold text-gold-soft'
          : 'rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/20'
      }
    >
      {children}
    </button>
  )
}

function NavButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void
  label: string
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="h-14 w-8 shrink-0 rounded-lg bg-white/10 text-lg text-white/70 transition hover:bg-white/20 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: 타입을 확인한다**

Run: `npx tsc --noEmit 2>&1 | grep "BulletinLightbox"`
Expected: 출력 없음

- [ ] **Step 3: 커밋한다**

```bash
git add src/components/bulletins/BulletinLightbox.tsx
git commit -m "feat: 반응형 스프레드 라이트박스 추가"
```

---

## Task 16: 인라인 뷰어 — `BulletinPageViewer.tsx`

**Files:**
- Create: `src/components/bulletins/BulletinPageViewer.tsx`

- [ ] **Step 1: 컴포넌트를 만든다**

`src/components/bulletins/BulletinPageViewer.tsx`:

```tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { formatPageAlt } from '@/lib/bulletin-format'
import BulletinLightbox from './BulletinLightbox'
import type { BulletinPage } from '@/lib/types'

interface BulletinPageViewerProps {
  pages: BulletinPage[]
  bulletinDate: string
  pdfUrl?: string
}

/**
 * 인라인 원본 뷰어.
 *
 * 줌을 두지 않는다 — 확대는 라이트박스의 책임이고, 같은 기능을 두 곳에 두지 않는다.
 * 썸네일 클릭은 큰 이미지만 바꾼다. 즉시 전체화면이 뜨면 면을 훑어보는 것이 불가능해지고,
 * 잘못 눌렀을 때 빠져나오는 비용이 클릭보다 커진다.
 */
export default function BulletinPageViewer({ pages, bulletinDate, pdfUrl }: BulletinPageViewerProps) {
  const [current, setCurrent] = useState(0)
  const [lightboxFrom, setLightboxFrom] = useState<number | null>(null)

  if (pages.length === 0) return null
  const page = pages[Math.min(current, pages.length - 1)]

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">원본 주보</h2>

      {pages.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" data-testid="bulletin-thumb-strip">
          {pages.map((item, index) => (
            <button
              key={item.thumbUrl}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={`${index + 1}면 보기`}
              aria-current={index === current}
              className={
                index === current
                  ? 'shrink-0 overflow-hidden rounded border-2 border-gold'
                  : 'shrink-0 overflow-hidden rounded border border-line transition hover:border-line-strong'
              }
            >
              <Image
                src={item.thumbUrl}
                alt={formatPageAlt(bulletinDate, index + 1)}
                width={56}
                height={Math.round((56 * item.height) / item.width)}
                unoptimized
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setLightboxFrom(current)}
        aria-label={`${current + 1}면 크게 보기`}
        className="mt-3 block w-full overflow-hidden rounded-lg border border-line bg-paper"
        data-testid="bulletin-current-page"
      >
        <Image
          src={page.previewUrl}
          alt={formatPageAlt(bulletinDate, current + 1)}
          width={page.width}
          height={page.height}
          unoptimized
          className="h-auto w-full"
        />
      </button>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setLightboxFrom(current)}
          className="flex-1 rounded-lg bg-[#0B1F5C] px-4 py-2.5 text-xs font-extrabold text-gold-soft transition hover:opacity-90"
        >
          원본 크게 보기
        </button>
        {pdfUrl ? (
          <a
            href={pdfUrl}
            className="flex-1 rounded-lg border border-[#0B1F5C] px-4 py-2.5 text-center text-xs font-extrabold text-[#0B1F5C] transition hover:bg-line-soft"
          >
            PDF 저장
          </a>
        ) : null}
      </div>

      {lightboxFrom !== null ? (
        <BulletinLightbox
          pages={pages}
          bulletinDate={bulletinDate}
          startPageIndex={lightboxFrom}
          pdfUrl={pdfUrl}
          onClose={() => setLightboxFrom(null)}
        />
      ) : null}
    </section>
  )
}
```

- [ ] **Step 2: 타입을 확인한다**

Run: `npx tsc --noEmit 2>&1 | grep "BulletinPageViewer"`
Expected: 출력 없음

- [ ] **Step 3: 커밋한다**

```bash
git add src/components/bulletins/BulletinPageViewer.tsx
git commit -m "feat: 인라인 주보 뷰어 추가 (썸네일 선택 + 라이트박스 진입)"
```

---

## Task 17: 상세 화면 조립

**Files:**
- Modify: `src/components/bulletins/BulletinView.tsx` (전체 교체)
- Modify: `src/app/bulletins/[id]/page.tsx` (전체 교체)

- [ ] **Step 1: BulletinView를 전체 교체한다**

`src/components/bulletins/BulletinView.tsx`:

```tsx
import Link from 'next/link'
import BulletinGlance from './BulletinGlance'
import BulletinNotices from './BulletinNotices'
import BulletinPageViewer from './BulletinPageViewer'
import BulletinWorshipTimes from './BulletinWorshipTimes'
import { formatBulletinDate } from '@/lib/bulletin-format'
import type { BulletinNeighbor } from '@/lib/data/bulletins'
import type { Bulletin } from '@/lib/types'

interface BulletinViewProps {
  bulletin: Bulletin
  previous?: BulletinNeighbor
  next?: BulletinNeighbor
}

export default function BulletinView({ bulletin, previous, next }: BulletinViewProps) {
  return (
    <article>
      {/* 데스크탑은 좌(한눈에 정보) / 우(원본) 2단, 모바일은 단일 열 */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-5">
          <BulletinGlance bulletin={bulletin} />
          <BulletinWorshipTimes />
          <BulletinNotices notices={bulletin.notices} />
          {bulletin.nextWeek ? (
            <section className="rounded-2xl border border-dashed border-line bg-surface p-5">
              <h2 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">다음 주 예고</h2>
              <p className="mt-2 text-sm text-ink-muted">{bulletin.nextWeek}</p>
            </section>
          ) : null}
        </div>
        <BulletinPageViewer
          pages={bulletin.pages}
          bulletinDate={bulletin.bulletinDate}
          pdfUrl={bulletin.pdfUrl}
        />
      </div>

      <nav className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5 text-sm">
        {previous ? (
          <Link href={`/bulletins/${previous.id}`} className="font-bold text-accent-deep transition hover:opacity-70">
            ← {formatBulletinDate(previous.bulletinDate)} 주보
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/bulletins/${next.id}`} className="font-bold text-accent-deep transition hover:opacity-70">
            {formatBulletinDate(next.bulletinDate)} 주보 →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}
```

- [ ] **Step 2: 상세 페이지를 전체 교체한다**

`src/app/bulletins/[id]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Container from '@/components/layout/Container'
import BulletinView from '@/components/bulletins/BulletinView'
import { getAdjacentBulletins, getBulletinById, getBulletins } from '@/lib/data/bulletins'
import JsonLd from '@/components/seo/JsonLd'
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { formatBulletinDate } from '@/lib/bulletin-format'
import { churchInfo } from '@/lib/church'

export const revalidate = 3600

interface BulletinDetailProps {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  const bulletins = await getBulletins()
  return bulletins.map((bulletin) => ({ id: bulletin.id }))
}

export async function generateMetadata({ params }: BulletinDetailProps): Promise<Metadata> {
  const { id } = await params
  const bulletin = await getBulletinById(id)
  if (!bulletin) return { title: '주보' }

  const label = formatBulletinDate(bulletin.bulletinDate)
  const cover = bulletin.pages[0]?.previewUrl
  return {
    title: `${label} 주보`,
    description: bulletin.sermonTitle
      ? `${churchInfo.name} ${label} 주보 — ${bulletin.sermonTitle}`
      : `${churchInfo.name} ${label} 주보입니다.`,
    alternates: {
      canonical: `/bulletins/${bulletin.id}`,
    },
    // 표지 이미지가 있으면 OG 로 쓴다. 없으면 레이아웃의 기본 OG 로 폴백된다.
    ...(cover ? { openGraph: { images: [{ url: cover }] } } : {}),
  }
}

export default async function BulletinDetailPage({ params }: BulletinDetailProps) {
  const { id } = await params
  const bulletin = await getBulletinById(id)
  if (!bulletin) notFound()

  const { previous, next } = await getAdjacentBulletins(bulletin.bulletinDate)
  const label = formatBulletinDate(bulletin.bulletinDate)

  return (
    <div className="py-12">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '주보', path: '/bulletins' },
          { name: `${label} 주보`, path: `/bulletins/${bulletin.id}` },
        ])}
      />
      <Container size="wide">
        <BulletinView bulletin={bulletin} previous={previous} next={next} />
      </Container>
    </div>
  )
}
```

- [ ] **Step 3: 타입을 확인한다**

Run: `npx tsc --noEmit 2>&1 | grep "bulletins"`
Expected: `BulletinForm.tsx`와 admin 페이지 관련 오류만 남는다 (Task 22에서 해소)

- [ ] **Step 4: 커밋한다**

```bash
git add src/components/bulletins/BulletinView.tsx "src/app/bulletins/[id]/page.tsx"
git commit -m "feat: 주보 상세 화면을 한눈에 카드 + 원본 뷰어 2단으로 재작성"
```

---

## Task 18: 목록 화면 — 최신 강조 + 날짜 목록

**Files:**
- Modify: `src/app/bulletins/page.tsx` (전체 교체)

- [ ] **Step 1: 전체를 교체한다**

`src/app/bulletins/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import BulletinsHero from '@/components/bulletins/BulletinsHero'
import NewsSubnav from '@/components/news/NewsSubnav'
import Reveal from '@/components/ui/Reveal'
import { getBulletins } from '@/lib/data/bulletins'
import { formatBulletinDate, formatIssueLabel } from '@/lib/bulletin-format'
import { churchInfo } from '@/lib/church'
import type { Bulletin } from '@/lib/types'

export const metadata: Metadata = {
  title: '주보',
  description: `${churchInfo.name} 주보를 온라인으로 열람할 수 있습니다.`,
  alternates: {
    canonical: '/bulletins',
  },
}

export const revalidate = 3600

export default async function BulletinsPage() {
  const bulletins = await getBulletins()
  const [latest, ...rest] = bulletins

  return (
    <>
      <BulletinsHero />
      <NewsSubnav />
      <div className="py-16 sm:py-20">
        <Container size="wide">
          {latest ? (
            <Reveal variant="fade-up">
              <FeaturedBulletin bulletin={latest} />
            </Reveal>
          ) : (
            <p className="rounded-2xl border border-line bg-paper p-10 text-center text-ink-muted">
              등록된 주보가 아직 없습니다.
            </p>
          )}

          {rest.length > 0 ? (
            <Reveal variant="fade-up" delay={100}>
              <section className="mt-10">
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gold-deep">지난 주보</h2>
                <ul className="mt-3 divide-y divide-line-soft border-t border-line">
                  {rest.map((bulletin) => (
                    <li key={bulletin.id}>
                      <Link
                        href={`/bulletins/${bulletin.id}`}
                        className="flex items-baseline justify-between gap-4 py-3.5 transition hover:opacity-70"
                      >
                        <span className="shrink-0 text-[13px] text-faint">
                          {formatBulletinDate(bulletin.bulletinDate)}
                        </span>
                        <span className="min-w-0 truncate text-right text-sm font-bold text-ink">
                          {bulletin.sermonTitle || '주보 보기'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ) : null}
        </Container>
      </div>
    </>
  )
}

/** 교인 대부분은 이번 주 주보만 본다. 최신 것에 시선을 집중시킨다. */
function FeaturedBulletin({ bulletin }: { bulletin: Bulletin }) {
  const cover = bulletin.pages[0]
  const issueLabel = formatIssueLabel(bulletin.volume, bulletin.issue)

  return (
    <Link
      href={`/bulletins/${bulletin.id}`}
      className="group grid gap-5 rounded-2xl bg-gradient-to-br from-[#0B1F5C] to-[#071540] p-6 text-white shadow-lifted transition hover:-translate-y-0.5 sm:grid-cols-[140px_1fr] sm:p-8"
    >
      <div className="overflow-hidden rounded-lg bg-white">
        {cover ? (
          <Image
            src={cover.previewUrl}
            alt={`${formatBulletinDate(bulletin.bulletinDate)} 주보 표지`}
            width={cover.width}
            height={cover.height}
            unoptimized
            className="h-auto w-full"
          />
        ) : (
          <div className="flex aspect-[1/1.414] items-center justify-center text-line-strong">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold-soft">이번 주 주보</p>
        {bulletin.sermonTitle ? (
          <h2 className="mt-2.5 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            {bulletin.sermonTitle}
          </h2>
        ) : null}
        <p className="mt-2.5 text-sm text-[#B9C4DE]">
          {[formatBulletinDate(bulletin.bulletinDate), issueLabel, bulletin.scripture].filter(Boolean).join(' · ')}
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-gold-soft">
          주보 보기 →
        </span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: 타입을 확인한다**

Run: `npx tsc --noEmit 2>&1 | grep "app/bulletins/page"`
Expected: 출력 없음

- [ ] **Step 3: 커밋한다**

```bash
git add src/app/bulletins/page.tsx
git commit -m "feat: 주보 목록을 최신 강조 + 지난 주보 날짜 목록으로 재작성"
```

---

## Task 19: 홈 축약 카드

**Files:**
- Create: `src/components/home/HomeBulletinCard.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 카드를 만든다**

`src/components/home/HomeBulletinCard.tsx`:

```tsx
import Image from 'next/image'
import Link from 'next/link'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { formatBulletinDate, formatIssueLabel } from '@/lib/bulletin-format'
import type { Bulletin } from '@/lib/types'

/**
 * 홈의 「이번 주 한눈에」 축약판. 카드 전체가 상세로 가는 링크다.
 * 교인이 홈만 열어도 이번 주 설교와 날짜가 보이게 한다.
 */
export default function HomeBulletinCard({ bulletin }: { bulletin: Bulletin }) {
  const cover = bulletin.pages[0]
  const meta = [formatBulletinDate(bulletin.bulletinDate), formatIssueLabel(bulletin.volume, bulletin.issue)]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="bg-surface py-16 sm:py-20">
      <Container size="wide">
        <Reveal variant="fade-up">
          <Link
            href={`/bulletins/${bulletin.id}`}
            className="group grid gap-5 rounded-2xl bg-gradient-to-br from-[#0B1F5C] to-[#071540] p-6 text-white shadow-lifted transition hover:-translate-y-0.5 sm:grid-cols-[112px_1fr] sm:p-8"
          >
            {cover ? (
              <div className="overflow-hidden rounded-lg bg-white">
                <Image
                  src={cover.previewUrl}
                  alt={`${formatBulletinDate(bulletin.bulletinDate)} 주보 표지`}
                  width={cover.width}
                  height={cover.height}
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold-soft">이번 주 주보</p>
              {bulletin.sermonTitle ? (
                <h2 className="mt-2.5 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
                  {bulletin.sermonTitle}
                </h2>
              ) : null}
              {(bulletin.scripture || bulletin.preacher) && (
                <p className="mt-2 text-sm text-[#B9C4DE]">
                  {[bulletin.scripture, bulletin.preacher].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="mt-1 text-xs text-[#8A94AC]">{meta}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-gold-soft">
                주보 보기 →
              </span>
            </div>
          </Link>
        </Reveal>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: 홈에 마운트한다**

`src/app/page.tsx`에서 세 곳을 바꾼다.

import 블록에 두 줄 추가:

```tsx
import HomeBulletinCard from '@/components/home/HomeBulletinCard'
import { getLatestBulletin } from '@/lib/data/bulletins'
```

`HomePage` 함수 본문의 데이터 조회를 아래로 교체:

```tsx
export default async function HomePage() {
  const [sermons, latestBulletin] = await Promise.all([getLatestSermons(3), getLatestBulletin()])
  const sermonSummary = firstSentence(sermons.find((s) => s.summary)?.summary)
```

`return` 안의 `<EntryCards ... />` 바로 아래에 추가:

```tsx
      {latestBulletin ? <HomeBulletinCard bulletin={latestBulletin} /> : null}
```

게시된 주보가 없으면 섹션 자체를 렌더하지 않는다.

- [ ] **Step 3: 타입을 확인한다**

Run: `npx tsc --noEmit 2>&1 | grep "app/page\|HomeBulletinCard"`
Expected: 출력 없음

- [ ] **Step 4: 커밋한다**

```bash
git add src/components/home/HomeBulletinCard.tsx src/app/page.tsx
git commit -m "feat: 홈에 이번 주 주보 축약 카드 추가"
```

---

## Task 20: 관리자 입력 필드

**Files:**
- Create: `src/components/admin/BulletinGlanceFields.tsx`
- Create: `src/components/admin/BulletinNoticesEditor.tsx`

- [ ] **Step 1: 스칼라 필드 묶음을 만든다**

`src/components/admin/BulletinGlanceFields.tsx`:

```tsx
'use client'

import BulletinField from './BulletinField'
import type { BulletinFormInput } from '@/lib/actions/bulletins'

interface BulletinGlanceFieldsProps {
  form: BulletinFormInput
  onChange: (patch: Partial<BulletinFormInput>) => void
}

export default function BulletinGlanceFields({ form, onChange }: BulletinGlanceFieldsProps) {
  return (
    <div className="grid gap-4 rounded-xl bg-paper p-6 shadow-sm md:grid-cols-2">
      <BulletinField
        id="bulletinDate"
        label="주보일"
        type="date"
        value={form.bulletinDate}
        required
        onChange={(bulletinDate) => onChange({ bulletinDate })}
      />
      <BulletinField id="preacher" label="설교자" value={form.preacher} onChange={(preacher) => onChange({ preacher })} />
      <BulletinField id="volume" label="권" value={form.volume} onChange={(volume) => onChange({ volume })} />
      <BulletinField id="issue" label="호" value={form.issue} onChange={(issue) => onChange({ issue })} />
      <div className="md:col-span-2">
        <BulletinField
          id="sermonTitle"
          label="설교 제목"
          value={form.sermonTitle}
          onChange={(sermonTitle) => onChange({ sermonTitle })}
        />
      </div>
      <div className="md:col-span-2">
        <BulletinField
          id="scripture"
          label="설교 본문"
          value={form.scripture}
          onChange={(scripture) => onChange({ scripture })}
        />
      </div>
      <BulletinField
        id="hymns"
        label="찬송가 (예: 새 210장 · 통 40장)"
        value={form.hymns}
        onChange={(hymns) => onChange({ hymns })}
      />
      <BulletinField
        id="responsiveReading"
        label="교독문"
        value={form.responsiveReading}
        onChange={(responsiveReading) => onChange({ responsiveReading })}
      />
      <div className="md:col-span-2">
        <BulletinField
          id="nextWeek"
          label="다음 주 예고 (한 줄, 비우면 표시되지 않음)"
          value={form.nextWeek}
          onChange={(nextWeek) => onChange({ nextWeek })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 공지 편집기를 만든다**

`src/components/admin/BulletinNoticesEditor.tsx`:

```tsx
'use client'

import type { BulletinNotice } from '@/lib/types'

interface BulletinNoticesEditorProps {
  notices: BulletinNotice[]
  onChange: (notices: BulletinNotice[]) => void
}

const inputClass =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none transition focus:border-accent'

export default function BulletinNoticesEditor({ notices, onChange }: BulletinNoticesEditorProps) {
  function patch(index: number, next: Partial<BulletinNotice>) {
    onChange(notices.map((notice, i) => (i === index ? { ...notice, ...next } : notice)))
  }

  return (
    <div className="rounded-xl bg-paper p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">이번 주 일정 · 공지</h2>
        <button
          type="button"
          onClick={() => onChange([...notices, { title: '', detail: '', when: '' }])}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
        >
          항목 추가
        </button>
      </div>
      <p className="mt-1.5 text-xs text-faint">
        「시간」을 채우면 앞에 시간 배지가 붙고, 비우면 「공지」 배지가 붙습니다.
      </p>

      {notices.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
          아직 항목이 없습니다.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notices.map((notice, index) => (
            <li key={index} className="grid gap-2 rounded-lg border border-line p-3 md:grid-cols-[120px_1fr_1fr_auto]">
              <input
                aria-label={`${index + 1}번 항목 시간`}
                placeholder="토 09:00"
                value={notice.when ?? ''}
                onChange={(event) => patch(index, { when: event.target.value })}
                className={inputClass}
              />
              <input
                aria-label={`${index + 1}번 항목 제목`}
                placeholder="여름성경학교"
                value={notice.title}
                onChange={(event) => patch(index, { title: event.target.value })}
                className={inputClass}
              />
              <input
                aria-label={`${index + 1}번 항목 내용`}
                placeholder="8/1(토)~8/3(월) · 교육관 1층"
                value={notice.detail}
                onChange={(event) => patch(index, { detail: event.target.value })}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => onChange(notices.filter((_, i) => i !== index))}
                className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 커밋한다**

```bash
git add src/components/admin/BulletinGlanceFields.tsx src/components/admin/BulletinNoticesEditor.tsx
git commit -m "feat: 주보 한눈에 필드·공지 편집 UI 추가"
```

---

## Task 21: 원본 업로드 컴포넌트

**Files:**
- Create: `src/components/admin/BulletinOriginUpload.tsx`

- [ ] **Step 1: 컴포넌트를 만든다**

`src/components/admin/BulletinOriginUpload.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { prepareBulletinUpload } from '@/lib/actions/bulletins'
import { putWithProgress } from '@/lib/client-video-upload'
import type { BulletinPage } from '@/lib/types'

interface BulletinOriginUploadProps {
  bulletinDate: string
  pageCount: number
  onUploaded: (result: { pages: BulletinPage[]; pdfUrl?: string }) => void
}

/**
 * 원본 PDF(또는 이미지 여러 장)를 면별 세 크기 이미지로 변환해 R2에 직접 올린다.
 *
 * 브라우저에서 변환하는 이유: sharp 는 Vercel 에서 PDF 를 못 읽는다(libvips 에 poppler 없음).
 * 서버 액션 1회로 서명 URL 배열을 받고 병렬 PUT 하므로 갤러리처럼 별도 Route 가 필요 없다.
 */
export default function BulletinOriginUpload({ bulletinDate, pageCount, onUploaded }: BulletinOriginUploadProps) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: File[]) {
    if (files.length === 0) return
    setError('')
    setBusy(true)
    try {
      // 무거운 pdfjs 는 실제로 파일을 고른 뒤에만 받는다
      const { renderImagesToPages, renderPdfToPages, validateOriginFile } = await import('@/lib/bulletin-pdf')

      for (const file of files) {
        const problem = validateOriginFile(file)
        if (problem) throw new Error(problem)
      }

      const isPdf = files.length === 1 && files[0].type === 'application/pdf'
      setStatus(isPdf ? 'PDF를 면별 이미지로 변환하는 중...' : '이미지를 변환하는 중...')
      const rendered = isPdf ? await renderPdfToPages(files[0]) : await renderImagesToPages(files)
      if (rendered.pages.length === 0) throw new Error('변환된 면이 없습니다.')

      setStatus('업로드 준비 중...')
      const plan = await prepareBulletinUpload({
        date: bulletinDate,
        pageCount: rendered.pages.length,
        hasPdf: isPdf,
        imageMime: rendered.mime,
      })

      setStatus('업로드 중...')
      let done = 0
      const total = plan.pages.length + (plan.pdf ? 1 : 0)
      const bump = () => {
        done += 1
        setStatus(`업로드 중... ${done}/${total}`)
      }

      await Promise.all(
        plan.pages.map(async (target) => {
          const page = rendered.pages.find((item) => item.pageNumber === target.pageNumber)
          if (!page) throw new Error('변환 결과와 업로드 대상이 어긋났습니다.')
          const blob = page.blobs[target.size]
          await putWithProgress(target.uploadUrl, new File([blob], `${target.size}`, { type: rendered.mime }), () => {})
          bump()
        })
      )

      if (plan.pdf && isPdf) {
        await putPdf(plan.pdf.uploadUrl, files[0], plan.pdf.contentDisposition)
        bump()
      }

      const pages: BulletinPage[] = rendered.pages.map((page) => ({
        width: page.width,
        height: page.height,
        fullUrl: urlFor(plan, page.pageNumber, 'full'),
        previewUrl: urlFor(plan, page.pageNumber, 'preview'),
        thumbUrl: urlFor(plan, page.pageNumber, 'thumb'),
      }))

      onUploaded({ pages, ...(plan.pdf && isPdf ? { pdfUrl: plan.pdf.publicUrl } : {}) })
      setStatus(`${pages.length}면 업로드 완료`)
    } catch (e) {
      // 일부 PUT 이 실패하면 onUploaded 를 부르지 않으므로 DB 는 건드려지지 않는다.
      // 남은 R2 객체는 다음 성공 업로드 때 정리 대상에 들어간다.
      setStatus('')
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl bg-paper p-6 shadow-sm">
      <h2 className="text-sm font-bold text-ink">원본 주보</h2>
      <p className="mt-1.5 text-xs text-faint">
        PDF 1개 또는 이미지 여러 장. 브라우저가 면별로 큰·중간·작은 이미지를 만들어 올립니다. 최대 12면 / 40MB.
      </p>
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        multiple
        disabled={busy}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void handleFiles(files)
        }}
        className="mt-4 block w-full text-sm text-ink"
      />
      {pageCount > 0 ? <p className="mt-3 text-xs font-bold text-ink">현재 등록된 면: {pageCount}면</p> : null}
      {status ? <p className="mt-2 text-xs text-ink-muted">{status}</p> : null}
      {error ? <p className="mt-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink">{error}</p> : null}
    </div>
  )
}

function urlFor(
  plan: Awaited<ReturnType<typeof prepareBulletinUpload>>,
  pageNumber: number,
  size: 'full' | 'preview' | 'thumb'
) {
  const target = plan.pages.find((item) => item.pageNumber === pageNumber && item.size === size)
  if (!target) throw new Error('업로드 대상 URL을 찾을 수 없습니다.')
  return target.publicUrl
}

// presign 에 content-disposition 이 서명돼 있으므로 같은 값을 헤더로 보내야 R2 가 받는다.
function putPdf(url: string, file: File, contentDisposition: string) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'application/pdf')
    xhr.setRequestHeader('Content-Disposition', contentDisposition)
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`PDF 업로드 실패 (HTTP ${xhr.status})`))
    xhr.onerror = () => reject(new Error('PDF 업로드 실패 — 네트워크 또는 R2 CORS 설정을 확인하세요.'))
    xhr.send(file)
  })
}
```

- [ ] **Step 2: R2 CORS에 Content-Disposition 허용 헤더가 있는지 확인한다**

`docs/r2-cors-video-upload.md`를 읽고, 버킷 CORS의 `AllowedHeaders`에 `content-disposition`이 포함되어 있는지 확인한다. 없으면 문서에 적힌 절차로 추가한다. 빠지면 PDF PUT이 CORS 프리플라이트에서 막힌다.

- [ ] **Step 3: 커밋한다**

```bash
git add src/components/admin/BulletinOriginUpload.tsx
git commit -m "feat: 주보 원본 업로드·변환 컴포넌트 추가"
```

---

## Task 22: 관리자 폼·페이지 재조립

**Files:**
- Modify: `src/components/admin/BulletinForm.tsx` (전체 교체)
- Modify: `src/app/admin/bulletins/page.tsx:54`
- Modify: `src/app/admin/bulletins/[id]/edit/page.tsx:18-25`

- [ ] **Step 1: BulletinForm을 전체 교체한다**

`src/components/admin/BulletinForm.tsx`:

```tsx
'use client'

import { FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeBulletinInput } from '@/lib/bulletin-editor'
import BulletinGlanceFields from './BulletinGlanceFields'
import BulletinNoticesEditor from './BulletinNoticesEditor'
import BulletinOriginUpload from './BulletinOriginUpload'
import SubmitButton from './SubmitButton'
import BulletinView from '@/components/bulletins/BulletinView'
import { todayKst } from '@/lib/date'
import type { BulletinFormInput } from '@/lib/actions/bulletins'

interface BulletinFormProps {
  initialValue?: BulletinFormInput
  submitLabel: string
  submitAction: (input: BulletinFormInput) => Promise<string | void>
}

const emptyBulletin: BulletinFormInput = {
  bulletinDate: todayKst(),
  volume: '',
  issue: '',
  sermonTitle: '',
  scripture: '',
  preacher: '',
  hymns: '',
  responsiveReading: '',
  nextWeek: '',
  notices: [],
  pages: [],
}

export default function BulletinForm({ initialValue, submitLabel, submitAction }: BulletinFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [form, setForm] = useState<BulletinFormInput>(initialValue ?? emptyBulletin)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        await submitAction(normalizeBulletinInput(form))
        router.push('/admin/bulletins')
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    })
  }

  return (
    <div className="space-y-6">
      <BulletinOriginUpload
        bulletinDate={form.bulletinDate}
        pageCount={form.pages.length}
        onUploaded={({ pages, pdfUrl }) => setForm((current) => ({ ...current, pages, pdfUrl }))}
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <BulletinGlanceFields form={form} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
        <BulletinNoticesEditor
          notices={form.notices}
          onChange={(notices) => setForm((current) => ({ ...current, notices }))}
        />

        {/* 미리보기는 공개 화면 컴포넌트를 그대로 재사용한다 — 보이는 것과 저장되는 것이 어긋나지 않게 */}
        <div className="rounded-xl bg-paper p-6 shadow-sm">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
          >
            {showPreview ? '미리보기 닫기' : '미리보기 열기'}
          </button>
          {showPreview ? (
            <div className="mt-5 border-t border-line pt-5">
              <BulletinView bulletin={{ ...normalizeBulletinInput(form), id: 'preview', isPublished: false }} />
            </div>
          ) : null}
        </div>

        {error ? <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{error}</p> : null}
        <div className="flex items-center justify-end gap-3 rounded-xl bg-paper p-6 shadow-sm">
          <button
            type="button"
            onClick={() => router.push('/admin/bulletins')}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
          >
            취소
          </button>
          <SubmitButton
            pendingOverride={isPending}
            pendingLabel="저장 중..."
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-deep disabled:opacity-60"
          >
            {submitLabel}
          </SubmitButton>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 관리자 목록의 `theme` 참조를 고친다**

`src/app/admin/bulletins/page.tsx:54`의 아래 줄을

```tsx
      <td className="px-4 py-3 font-medium text-ink">{bulletin.theme || '-'}</td>
```

이렇게 바꾼다:

```tsx
      <td className="px-4 py-3 font-medium text-ink">{bulletin.sermonTitle || '-'}</td>
```

같은 파일에서 헤더 셀 텍스트가 `주제`라면 `설교 제목`으로 바꾼다. 그리고 면 수를 보여주는 열을 `공개` 열 앞에 추가한다:

```tsx
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{(bulletin.pages ?? []).length}면</td>
```

헤더 행에도 대응하는 `<th>`를 같은 위치에 추가한다:

```tsx
        <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">면</th>
```

- [ ] **Step 3: 편집 페이지의 initialValue를 고친다**

`src/app/admin/bulletins/[id]/edit/page.tsx`의 `initialValue` 블록을 아래로 교체한다:

```tsx
  const initialValue: BulletinFormInput = {
    bulletinDate: bulletin.bulletinDate,
    volume: bulletin.volume ?? '',
    issue: bulletin.issue ?? '',
    sermonTitle: bulletin.sermonTitle ?? '',
    scripture: bulletin.scripture ?? '',
    preacher: bulletin.preacher ?? '',
    hymns: bulletin.hymns ?? '',
    responsiveReading: bulletin.responsiveReading ?? '',
    nextWeek: bulletin.nextWeek ?? '',
    ...(bulletin.pdfUrl ? { pdfUrl: bulletin.pdfUrl } : {}),
    notices: bulletin.notices ?? [],
    pages: bulletin.pages ?? [],
  }
```

- [ ] **Step 4: 전체 타입체크와 테스트를 돌린다**

```bash
npm run typecheck
npm run lint
npm run test
```

Expected: 셋 다 성공. 여기서 처음으로 전체 타입체크가 깨끗해진다.

- [ ] **Step 5: 프로덕션 빌드가 되는지 확인한다**

Run: `npm run build`
Expected: 빌드 성공. `prebuild`가 워커를 복사하는 로그도 함께 보인다.

- [ ] **Step 6: 커밋한다**

```bash
git add src/components/admin/BulletinForm.tsx src/app/admin/bulletins/page.tsx "src/app/admin/bulletins/[id]/edit/page.tsx"
git commit -m "feat: 주보 관리자 폼을 업로드·한눈에 필드·미리보기로 재조립"
```

---

## Task 23: e2e 테스트

**Files:**
- Create: `e2e/bulletins.spec.ts`

이 스펙은 **게시된 주보가 최소 1개 있고 그 주보에 면이 2개 이상**인 상태를 전제한다. Task 24의 마이그레이션·첫 업로드를 끝낸 뒤에 돌린다.

- [ ] **Step 1: 스펙을 작성한다**

`e2e/bulletins.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

// 실제 DB/R2 를 쓰는 시나리오다(playwright.config.ts 가 workers:1 로 직렬 실행).
// 주보가 하나도 없으면 목록에 안내문만 뜨므로 그 경우는 건너뛴다.

async function openLatestBulletin(page: import('@playwright/test').Page) {
  await page.goto('/bulletins')
  const featured = page.getByRole('link', { name: /주보 보기/ }).first()
  if ((await featured.count()) === 0) return false
  await featured.click()
  await expect(page).toHaveURL(/\/bulletins\/[0-9a-f-]+$/)
  return true
}

test('목록에서 상세로 들어가 한눈에 카드가 보인다', async ({ page }) => {
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
  await expect(page.getByText('예배 시간')).toBeVisible()
})

test('썸네일 클릭은 큰 이미지만 바꾸고 라이트박스를 열지 않는다', async ({ page }) => {
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')

  const strip = page.getByTestId('bulletin-thumb-strip')
  test.skip((await strip.count()) === 0, '면이 1장이라 스트립이 없음')

  const before = await page.getByTestId('bulletin-current-page').locator('img').getAttribute('src')
  await strip.getByRole('button', { name: '2면 보기' }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  const after = await page.getByTestId('bulletin-current-page').locator('img').getAttribute('src')
  expect(after).not.toBe(before)
})

test('원본 크게 보기로 라이트박스를 열고 이동·줌·Escape 닫기가 동작한다', async ({ page }) => {
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')

  const openButton = page.getByRole('button', { name: '원본 크게 보기' })
  await openButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '닫기' })).toBeFocused()

  await dialog.getByRole('button', { name: '2배 확대' }).click()
  await expect(dialog.getByRole('button', { name: '2배 확대' })).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  // 닫으면 포커스가 진입 지점으로 돌아온다
  await expect(openButton).toBeFocused()
})

test('데스크탑은 3면, 모바일은 1면을 동시에 띄운다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  test.skip(!(await openLatestBulletin(page)), '게시된 주보가 없음')
  await page.getByRole('button', { name: '원본 크게 보기' }).click()
  const desktopLabel = await page.getByRole('dialog').getByText(/\/ \d+면$/).textContent()

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileLabel = await page.getByRole('dialog').getByText(/\/ \d+면$/).textContent()

  // 데스크탑은 범위 표기(1 – 3), 모바일은 단일 표기(1)
  expect(desktopLabel).not.toBe(mobileLabel)
  expect(mobileLabel).not.toContain('–')
})

test('면이 없는 주보도 상세·목록이 깨지지 않는다', async ({ page }) => {
  // 면 없이 「한눈에」 카드만 등록한 주보를 미리 하나 만들어 둔 뒤 그 URL 을 넣는다.
  // 환경변수가 없으면 건너뛴다 — 데이터 준비를 강제하지 않는다.
  const url = process.env.E2E_EMPTY_BULLETIN_URL
  test.skip(!url, 'E2E_EMPTY_BULLETIN_URL 미설정')

  await page.goto(url!)
  await expect(page.getByText('예배 시간')).toBeVisible()
  // 뷰어 영역과 PDF 버튼이 아예 렌더되지 않는다
  await expect(page.getByText('원본 주보')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '원본 크게 보기' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'PDF 저장' })).toHaveCount(0)

  await page.goto('/bulletins')
  await expect(page.getByRole('link', { name: /주보 보기/ }).first()).toBeVisible()
})

test('같은 날짜의 주보를 또 만들면 사유가 표시된다', async ({ page }) => {
  // 관리자 인증이 필요한 시나리오다. 로그인 상태가 아니면 건너뛴다.
  await page.goto('/admin/bulletins')
  test.skip(page.url().includes('/login'), '관리자 로그인 상태가 아님')

  const existing = page.locator('table tbody tr').first()
  test.skip((await existing.count()) === 0, '기존 주보가 없음')
  const existingDate = (await existing.locator('td').first().textContent())?.trim() ?? ''
  test.skip(!existingDate, '주보일을 읽을 수 없음')

  await page.goto('/admin/bulletins/new')
  await page.getByLabel('주보일').fill(existingDate)
  await page.getByLabel('설교 제목').fill('중복 날짜 확인용')
  await page.getByRole('button', { name: /등록|저장/ }).click()

  await expect(page.getByText('같은 날짜의 주보가 이미 있습니다')).toBeVisible()
})
```

- [ ] **Step 2: 개발 서버에서 돌린다**

Run: `npx playwright test e2e/bulletins.spec.ts`
Expected: 6개 통과 또는 skip. 실패하면 실제 화면을 열어 선택자를 맞춘다.

마지막 두 테스트는 데이터·인증 전제가 있어 기본적으로 skip될 수 있다. Task 24 Step 7에서 실제 데이터를 갖춘 뒤 다시 돌린다.

- [ ] **Step 3: 커밋한다**

```bash
git add e2e/bulletins.spec.ts
git commit -m "test: 주보 상세·라이트박스 e2e 추가"
```

---

## Task 24: R2 고아 객체 정리 + 배포

**Files:**
- Create: `scripts/audit-bulletin-r2.ts`

`bulletinHwpKey`는 지금 호출부가 없지만 `c9060df feat: 주보 hwp 업로드 + 섹션 관리 CRUD` 시점에는 쓰였고 키가 `bulletins/{uuid}-{파일명}.hwp` 형태였다. 버킷에 과거 업로드분이 남아 있을 수 있다.

- [ ] **Step 1: 감사 스크립트를 만든다**

`scripts/audit-bulletin-r2.ts`:

```ts
// bulletins/ 프리픽스에서 새 키 규칙에 맞지 않는 객체를 찾아 나열한다.
// 새 규칙: bulletins/{YYYY-MM-DD}/{uploadId}/...
// 과거 규칙: bulletins/{uuid}-{파일명}.hwp  ← 이번에 폐기됨
//
// 기본은 조회만 한다. 지우려면 --delete 를 준다.
//
// 실행: npx tsx --env-file=.env.local scripts/audit-bulletin-r2.ts [--delete]

import { deleteFromR2, listR2Keys } from '../src/lib/r2'

const currentKeyPattern = /^bulletins\/\d{4}-\d{2}-\d{2}\/[0-9a-fA-F-]+\/.+$/

async function main() {
  const shouldDelete = process.argv.includes('--delete')
  const keys = await listR2Keys('bulletins/')
  const orphans = keys.filter((key) => !currentKeyPattern.test(key))

  console.log(`bulletins/ 전체 객체: ${keys.length}개`)
  console.log(`새 키 규칙에 맞지 않는 객체: ${orphans.length}개`)
  for (const key of orphans) console.log(`  ${key}`)

  if (orphans.length === 0) return
  if (!shouldDelete) {
    console.log('\n삭제하려면 --delete 를 붙여 다시 실행하세요.')
    return
  }

  for (const key of orphans) {
    await deleteFromR2(key)
    console.log(`deleted ${key}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

- [ ] **Step 2: 조회만 먼저 돌려 목록을 확인한다**

```bash
npx tsx --env-file=.env.local scripts/audit-bulletin-r2.ts
```

Expected: 고아 객체 목록. **여기서 나온 목록을 사용자에게 보고하고 삭제 승인을 받는다.** 승인 없이 `--delete`를 돌리지 않는다.

- [ ] **Step 3: 커밋한다**

```bash
git add scripts/audit-bulletin-r2.ts
git commit -m "chore: 주보 R2 고아 객체 감사 스크립트 추가"
```

- [ ] **Step 4: 마이그레이션 전 스냅샷을 뜬다**

Neon 콘솔에서 프로덕션 브랜치의 스냅샷(또는 브랜치 복제)을 만든다. `DELETE FROM bulletins`와 `DROP COLUMN`은 되돌릴 수 없다.

- [ ] **Step 5: 배포 순서를 지켜 반영한다**

이 순서는 스펙 5장의 결정이다. 구 코드와 신 코드 어느 쪽도 전후 스키마를 함께 지원하지 않으므로 순서가 중요하다.

```bash
# 1) 브랜치를 푸시해 Vercel 프리뷰 빌드가 성공하는지 확인
git push -u origin feature/bulletin-rebuild
```

프리뷰 빌드 성공을 확인한 뒤:

```bash
# 2) 마이그레이션 실행
npm run db:migrate
```

```bash
# 3) 즉시 프로덕션에 반영 (main 으로 머지 → 배포)
```

2와 3 사이에 구 코드가 신 스키마를 조회하는 짧은 창이 생겨 `/bulletins`와 홈이 500을 낼 수 있다. 저트래픽 사이트이고 `DELETE` 때문에 첫 주보를 올릴 때까지 목록이 비어 있으므로 이 창은 수용한다.

- [ ] **Step 6: 첫 주보를 올려 실제 동작을 확인한다**

`/admin/bulletins/new`에서 실제 주보 PDF를 올려 아래를 확인한다.

1. PDF가 면별로 변환되고 진행률이 `업로드 중... n/m`으로 올라간다
2. 미리보기가 공개 화면과 같은 모습으로 뜬다
3. 게시 후 `/bulletins`에 피처드 카드가, 홈에 축약 카드가 나타난다
4. 상세에서 썸네일을 눌러도 라이트박스가 열리지 않고 큰 이미지만 바뀐다
5. 「원본 크게 보기」로 라이트박스가 열리고 데스크탑에서 3면이 나란히 보인다
6. 「PDF 저장」을 누르면 브라우저가 파일을 **다운로드**한다 (탭에서 열리면 `Content-Disposition`이나 CORS 설정을 다시 본다)
7. 같은 날짜로 주보를 하나 더 만들면 `같은 날짜의 주보가 이미 있습니다`가 뜬다

- [ ] **Step 7: e2e를 실제 데이터로 돌린다**

먼저 「면 없는 주보」 테스트용 데이터를 만든다. `/admin/bulletins/new`에서 원본 업로드 없이 설교 제목만 채워 하나 등록하고, 그 상세 URL을 `.env.local`에 넣는다:

```
E2E_EMPTY_BULLETIN_URL=/bulletins/<그 주보 id>
```

Run: `npx playwright test e2e/bulletins.spec.ts`
Expected: 6개 통과. 관리자 로그인 상태가 아니면 중복 날짜 테스트만 skip될 수 있다 — 그 경우 Task 24 Step 6의 7번 수동 확인으로 대체한다.

- [ ] **Step 8: R2 고아 객체를 정리한다**

Step 2에서 보고한 목록에 대해 사용자 승인을 받은 뒤:

```bash
npx tsx --env-file=.env.local scripts/audit-bulletin-r2.ts --delete
```

---

## 완료 조건

- [ ] `npm run test` 통과
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과
- [ ] `npx playwright test e2e/bulletins.spec.ts` 통과 (앞 4개는 skip 없이)
- [ ] Task 24 Step 6의 7개 항목 수동 확인 완료
- [ ] `grep -rn "hwp\|BulletinSection" src` 결과가 비어 있음
- [ ] Task 24 Step 2의 R2 고아 객체 목록을 사용자에게 보고하고 처리 완료

