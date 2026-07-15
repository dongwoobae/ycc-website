# 네비 정비 + PDF 잔여 반영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤더/서브내비 순서 정렬, 특별행사·기타를 소식 섹션(/events)으로 분리, 홈 히어로 간소화, PDF 첨부 사진 적용.

**Architecture:** `src/lib/nav.ts`(네비 단일 출처)와 `src/lib/worship.ts`(스코프 단일 출처)만 고치면 헤더·서브내비·그리드가 따라온다. `/events`는 `/praise` 페이지 패턴 복제. 사진은 PDF 내장 JPEG를 추출해 sharp로 webp 변환.

**Tech Stack:** Next.js(App Router), vitest, sharp. 패키지 매니저는 **npm** (pnpm 아님). 모든 명령은 `c:\Users\servi\projects\ycc-website`에서 실행(cwd 리셋 주의 — 매 명령마다 cd 포함).

**Spec:** `docs/superpowers/specs/2026-07-15-nav-reorg-pdf-fixes-design.md`

**커밋 규칙:** Conventional Commits 한국어(`feat:`/`fix:`/`chore:`), Co-Authored-By 트레일러 금지.

---

### Task 1: worship.ts 이벤트 스코프 분리 (TDD)

**Files:**
- Modify: `src/lib/worship.ts`
- Test: `src/lib/worship.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/worship.test.ts`의 import에 `eventFilterPills, eventSectionScope, isEventWorshipType`를 추가하고, 파일 끝에 describe 블록 추가. 기존 `'전체' scope keeps 찬양 out...` 테스트에는 행사 제외 단언을 보강한다.

```ts
// import 블록에 추가 (알파벳 순 유지)
import {
  adultWorshipSchedule,
  eventFilterPills,
  eventSectionScope,
  expectsAutoSummary,
  getWorshipScheduleItem,
  isEventWorshipType,
  isPraiseWorshipType,
  isPublicWorshipType,
  nextGenerationWorshipSchedule,
  praiseFilterPills,
  praiseSectionScope,
  sermonFilterPills,
  sermonSectionScope,
  worshipLabels,
  worshipTypes,
} from './worship'
```

```ts
// 파일 끝에 추가
describe('특별행사/기타 → 소식(/events) 섹션 분리', () => {
  it('classifies 특별행사·기타만 event 로', () => {
    expect(isEventWorshipType('특별행사')).toBe(true)
    expect(isEventWorshipType('기타')).toBe(true)
    for (const t of ['주일예배', '주일찬양예배', '수요예배', '금요기도회', '시온찬양대', '특송']) {
      expect(isEventWorshipType(t)).toBe(false)
    }
  })

  it('event 스코프는 /events 기반, 알약은 전체·특별행사·기타', () => {
    expect(eventSectionScope.basePath).toBe('/events')
    expect(eventFilterPills.map((p) => p.value)).toEqual(['전체', '특별행사', '기타'])
  })

  it("'전체' 스코프: 예배·설교는 행사 제외, event 는 행사만", () => {
    expect(sermonSectionScope.includes('특별행사')).toBe(false)
    expect(sermonSectionScope.includes('기타')).toBe(false)
    expect(sermonSectionScope.includes('주일예배')).toBe(true)
    expect(sermonSectionScope.includes('금요기도회')).toBe(true)
    expect(eventSectionScope.includes('특별행사')).toBe(true)
    expect(eventSectionScope.includes('기타')).toBe(true)
    expect(eventSectionScope.includes('주일예배')).toBe(false)
    expect(eventSectionScope.includes('시온찬양대')).toBe(false)
  })
})
```

기존 테스트 보강(70행 부근, `'전체' scope keeps 찬양 out of 예배·설교 and vice versa` it 블록 안):

```ts
    // 예배·설교 '전체'는 행사 유형도 제외 (소식 /events 로 이동)
    expect(sermonSectionScope.includes('특별행사')).toBe(false)
    expect(sermonSectionScope.includes('기타')).toBe(false)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd c:\Users\servi\projects\ycc-website; npx vitest run src/lib/worship.test.ts`
Expected: FAIL — `eventSectionScope` 등 export 없음(SyntaxError) 또는 단언 실패.

- [ ] **Step 3: worship.ts 구현**

`src/lib/worship.ts` 수정 4곳:

(1) `praiseWorshipTypes` 선언(25행 부근) 아래에 추가:

```ts
// '소식' 섹션(/events)에 속하는 행사 유형. 예배·설교(/sermons) '전체'에서는 제외된다.
export const eventWorshipTypes = ['특별행사', '기타'] as const satisfies readonly WorshipType[]

/** '소식' 특별행사(/events) 섹션에 노출되는 유형인지. */
export function isEventWorshipType(value: string): boolean {
  return (eventWorshipTypes as readonly string[]).includes(value)
}
```

(2) 39-40행 주석 교체:

```ts
// '예배·설교'(/sermons) 페이지 필터 알약. '전체'는 찬양(시온찬양대·특송)과
// 행사(특별행사·기타)를 제외한 예배 유형만 보여준다.
```

(3) `praiseFilterPills` 아래에 추가:

```ts
// '특별행사'(/events) 페이지 필터 알약. 소식 섹션에서 행사 영상을 모아 보여준다.
export const eventFilterPills = [
  { label: '전체', value: '전체' },
  { label: '특별행사', value: '특별행사' },
  { label: '기타', value: '기타' },
] as const satisfies readonly { label: string; value: WorshipFilterValue }[]
```

(4) `sermonSectionScope.includes` 교체 및 `eventSectionScope` 추가(`praiseSectionScope` 아래):

```ts
export const sermonSectionScope: SermonScope = {
  basePath: '/sermons',
  pills: sermonFilterPills,
  includes: (type) => !isPraiseWorshipType(type) && !isEventWorshipType(type),
}
```

```ts
export const eventSectionScope: SermonScope = {
  basePath: '/events',
  pills: eventFilterPills,
  includes: (type) => isEventWorshipType(type),
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd c:\Users\servi\projects\ycc-website; npx vitest run src/lib/worship.test.ts`
Expected: PASS (전체 describe 통과)

- [ ] **Step 5: 커밋**

```powershell
cd c:\Users\servi\projects\ycc-website; git add src/lib/worship.ts src/lib/worship.test.ts; git commit -m "feat: 특별행사·기타 event 스코프 분리(예배·설교 전체에서 제외)"
```

---

### Task 2: SermonsGrid에 event variant 추가

**Files:**
- Modify: `src/components/sermons/SermonsGrid.tsx:10,19-24`

- [ ] **Step 1: variant 확장**

import 수정(10행):

```ts
import { eventSectionScope, isPublicWorshipType, praiseSectionScope, sermonSectionScope, type WorshipFilterValue } from '@/lib/worship'
```

시그니처·스코프 결정 수정(17-24행):

```ts
export default function SermonsGrid({
  sermons,
  variant = 'sermon',
}: {
  sermons: Sermon[]
  variant?: 'sermon' | 'praise' | 'event'
}) {
  const scope =
    variant === 'praise' ? praiseSectionScope : variant === 'event' ? eventSectionScope : sermonSectionScope
```

- [ ] **Step 2: 타입 확인**

Run: `cd c:\Users\servi\projects\ycc-website; npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: 커밋**

```powershell
cd c:\Users\servi\projects\ycc-website; git add src/components/sermons/SermonsGrid.tsx; git commit -m "feat: SermonsGrid event variant 추가"
```

---

### Task 3: /events 페이지 신설 + NewsSubnav 탭 추가

**Files:**
- Create: `src/components/news/EventsHero.tsx`
- Create: `src/app/events/page.tsx`
- Modify: `src/components/news/NewsSubnav.tsx:3-7`

- [ ] **Step 1: EventsHero 생성**

`src/components/news/EventsHero.tsx` (PageHero 기본 tone=navy — 소식 계열):

```tsx
import PageHero from '@/components/layout/PageHero'

export default function EventsHero() {
  return (
    <PageHero
      eyebrow="Events"
      title="특별행사"
      subtitle="사역 보고와 특별행사 등 교회의 다양한 순간을 영상으로 전합니다."
    />
  )
}
```

- [ ] **Step 2: /events 페이지 생성**

`src/app/events/page.tsx` (`/praise` 패턴, loading.tsx 없음 — praise와 동일):

```tsx
import { Suspense } from 'react'
import type { Metadata } from 'next'
import Container from '@/components/layout/Container'
import EventsHero from '@/components/news/EventsHero'
import NewsSubnav from '@/components/news/NewsSubnav'
import SermonsGrid from '@/components/sermons/SermonsGrid'
import { getSermons } from '@/lib/data/sermons'

export const metadata: Metadata = {
  title: '특별행사',
  description: '영천중앙교회 특별행사와 사역 보고 영상을 모아 제공합니다.',
  alternates: {
    canonical: '/events',
  },
}

export const revalidate = 3600

export default async function EventsPage() {
  const sermons = await getSermons()

  return (
    <>
      <EventsHero />
      <NewsSubnav />
      <div className="py-20 sm:py-24">
        <Container size="wide">
          <Suspense fallback={null}>
            <SermonsGrid sermons={sermons} variant="event" />
          </Suspense>
        </Container>
      </div>
    </>
  )
}
```

- [ ] **Step 3: NewsSubnav 탭 추가**

`src/components/news/NewsSubnav.tsx` tabs 교체:

```ts
const tabs = [
  { label: '소식', href: '/news' },
  { label: '주보', href: '/bulletins' },
  { label: '갤러리', href: '/gallery' },
  { label: '특별행사', href: '/events' },
]
```

- [ ] **Step 4: 타입 확인**

Run: `cd c:\Users\servi\projects\ycc-website; npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 5: 커밋**

```powershell
cd c:\Users\servi\projects\ycc-website; git add src/components/news/EventsHero.tsx src/app/events/page.tsx src/components/news/NewsSubnav.tsx; git commit -m "feat: 소식 섹션 특별행사 페이지(/events) 신설"
```

---

### Task 4: nav.ts 순서 정렬·링크 변경

**Files:**
- Modify: `src/lib/nav.ts:27-31,65-71,73-79`

- [ ] **Step 1: aboutLinks 재배열 (27-31행)**

```ts
const aboutLinks: NavChild[] = [
  { label: '담임목사 인사', href: '/about/greeting', desc: '담임목사 인사말' },
  { label: '교회 연혁', href: '/about/history', desc: '걸어온 발자취' },
  { label: '섬기는 사람들', href: '/about/serving', desc: '함께 섬기는 이들' },
]
```

- [ ] **Step 2: newsLinks 링크 변경 (65-71행)**

```ts
const newsLinks: NavChild[] = [
  { label: '교회소식', href: '/news', desc: '교회 소식과 공지' },
  { label: '주보', href: '/bulletins', desc: '주간 주보 열람' },
  { label: '행사 사진', href: '/gallery', desc: '사진으로 보는 일상' },
  { label: '특별행사', href: '/events?worship=특별행사', desc: '특별행사 영상' },
  { label: '기타', href: '/events?worship=기타', desc: '기타 영상' },
]
```

- [ ] **Step 3: navLinks 순서 교체 (73-79행) — 소식을 처음 오셨나요 앞으로**

```ts
export const navLinks: NavSection[] = [
  { label: '소개', href: '/about', section: '/about', eyebrow: 'About', children: aboutLinks },
  { label: '안내', href: '/happiness', section: '/happiness', eyebrow: 'Guide', children: guideLinks },
  { label: '말씀과 찬양', href: '/sermons', section: '/sermons', eyebrow: 'Worship', children: wordLinks, groups: worshipGroups },
  { label: '소식', href: '/news', section: '/news', eyebrow: 'News', children: newsLinks },
  { label: '처음 오셨나요?', href: '/newfamily', section: '/newfamily', eyebrow: 'Welcome', children: newcomerLinks },
]
```

- [ ] **Step 4: 타입 확인**

Run: `cd c:\Users\servi\projects\ycc-website; npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 5: 커밋**

```powershell
cd c:\Users\servi\projects\ycc-website; git add src/lib/nav.ts; git commit -m "fix: 네비 순서 정렬(소개 드롭다운·소식/처음오셨나요) 및 행사 링크 /events 전환"
```

---

### Task 5: 홈 히어로 간소화

**Files:**
- Modify: `src/components/home/ImmersiveHero.tsx` (전체 교체)

- [ ] **Step 1: 태그라인·버튼 제거**

파일 전체를 아래로 교체 (`HomeButton` import 제거 포함):

```tsx
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'

// 홈 #1 — PDF 수정요청: Welcome to 영천중앙교회만 남김(태그라인·버튼 제거).
export default function ImmersiveHero() {
  return (
    <section className="relative isolate flex min-h-[620px] h-[100svh] items-center overflow-hidden bg-beige text-ink">
      <Container size="wide" className="text-center">
        <Reveal delay={60}>
          <p className="text-[clamp(13px,1.6vw,16px)] font-extrabold uppercase tracking-[0.3em] text-gold-deep">
            Welcome to
          </p>
        </Reveal>
        <Reveal delay={140}>
          <h1 className="mt-5 text-[clamp(46px,9vw,104px)] font-extrabold leading-[1.08] tracking-[-0.01em] text-accent-deep">
            영천중앙교회
          </h1>
        </Reveal>
        <Reveal delay={220}>
          <div className="mx-auto mt-9 h-1 w-16 bg-gold" aria-hidden />
        </Reveal>
      </Container>
    </section>
  )
}
```

- [ ] **Step 2: 타입·lint 확인**

Run: `cd c:\Users\servi\projects\ycc-website; npx tsc --noEmit; npm run lint`
Expected: 에러 0 (HomeButton 미사용 import 남기면 lint 실패하니 주의)

- [ ] **Step 3: 커밋**

```powershell
cd c:\Users\servi\projects\ycc-website; git add src/components/home/ImmersiveHero.tsx; git commit -m "fix: 홈 히어로 Welcome to 영천중앙교회만 유지(태그라인·버튼 제거, PDF p2)"
```

---

### Task 6: sitemap 정비

**Files:**
- Modify: `src/lib/sitemap.ts:11-25`

- [ ] **Step 1: staticRoutes에 /praise·/events 추가 (기존 /praise 누락 보수)**

```ts
const staticRoutes = [
  '/',
  '/newfamily',
  '/about',
  '/about/greeting',
  '/about/history',
  '/about/serving',
  '/worship',
  '/happiness',
  '/faq',
  '/sermons',
  '/praise',
  '/events',
  '/news',
  '/bulletins',
  '/gallery',
] as const
```

- [ ] **Step 2: 관련 테스트 확인**

Run: `cd c:\Users\servi\projects\ycc-website; npx vitest run src/lib`
Expected: PASS (sitemap 스냅샷/개수 테스트가 있으면 기대값 갱신)

- [ ] **Step 3: 커밋**

```powershell
cd c:\Users\servi\projects\ycc-website; git add src/lib/sitemap.ts; git commit -m "fix: sitemap에 /praise·/events 정적 경로 추가"
```

---

### Task 7: PDF 첨부 사진 추출·적용

**Files:**
- Create(임시, scratchpad): `extract-jpegs.mjs`, `convert.mjs`
- Replace: `public/images/entry/word.webp`, `public/images/entry/praise.webp`, `public/images/entry/school.webp`
- Create: `public/images/nextgen/kinder.webp`, `public/images/nextgen/children.webp`, `public/images/nextgen/youth.webp`
- Modify: `src/app/newfamily/page.tsx:9,71-75,234-236`

- [ ] **Step 1: PDF에서 JPEG 추출 (scratchpad에 스크립트 작성 후 실행)**

`<scratchpad>/extract-jpegs.mjs`:

```js
// PDF 원시 바이트에서 JPEG(SOI FFD8FF ~ EOI FFD9) 추출. 30KB 미만은 아이콘류로 스킵.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const [pdfPath, outDir] = process.argv.slice(2)
const pdf = readFileSync(pdfPath)
mkdirSync(outDir, { recursive: true })

let count = 0
for (let i = 0; i < pdf.length - 3; i++) {
  if (pdf[i] === 0xff && pdf[i + 1] === 0xd8 && pdf[i + 2] === 0xff) {
    const end = pdf.indexOf(Buffer.from([0xff, 0xd9]), i + 2)
    if (end === -1) break
    const jpeg = pdf.subarray(i, end + 2)
    if (jpeg.length > 30000) {
      writeFileSync(`${outDir}/img-${String(count).padStart(2, '0')}.jpg`, jpeg)
      count++
    }
    i = end + 1
  }
}
console.log(`extracted: ${count}`)
```

Run: `node <scratchpad>/extract-jpegs.mjs "c:\Users\servi\projects\ycc-website\docs\홈페이지-수정사항.pdf" <scratchpad>\pdf-images`
Expected: `extracted: N` (N ≥ 6)

- [ ] **Step 2: 추출 이미지 육안 매핑 (Read 도구로 각 img-*.jpg 확인)**

매핑 대상 6장 — p4: 성경책→word, 찬양(손 든 회중)→praise, 새싹 든 손들(VOLUNTEER 티셔츠)→school / p10: 계단 단체(유치부)→kinder, 무대 공연(아동부)→children, 야외 수련회 현수막 단체(중고등부)→youth.
PNG(FlateDecode)로 내장돼 JPEG 추출에 안 잡히는 사진이 있으면: `npx mutool draw` 대신 **pdfimages 불가 환경이므로** 해당 사진만 PDF 페이지 렌더 후 크롭(마지막 수단). 6장 모두 JPEG로 잡히는지 먼저 확인.

- [ ] **Step 3: webp 변환·배치**

`<scratchpad>/convert.mjs` (ycc-website 디렉토리에서 실행해야 sharp 해석됨):

```js
// 사용: node convert.mjs <src.jpg> <dest.webp> — 가로 1600 제한, q80
import sharp from 'sharp'
const [src, dest] = process.argv.slice(2)
await sharp(src).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dest)
console.log('ok:', dest)
```

Run (6회, 매핑 확정된 파일명으로):

```powershell
cd c:\Users\servi\projects\ycc-website
node <scratchpad>\convert.mjs <scratchpad>\pdf-images\img-XX.jpg public\images\entry\word.webp
node <scratchpad>\convert.mjs <scratchpad>\pdf-images\img-XX.jpg public\images\entry\praise.webp
node <scratchpad>\convert.mjs <scratchpad>\pdf-images\img-XX.jpg public\images\entry\school.webp
node <scratchpad>\convert.mjs <scratchpad>\pdf-images\img-XX.jpg public\images\nextgen\kinder.webp
node <scratchpad>\convert.mjs <scratchpad>\pdf-images\img-XX.jpg public\images\nextgen\children.webp
node <scratchpad>\convert.mjs <scratchpad>\pdf-images\img-XX.jpg public\images\nextgen\youth.webp
```

Expected: `ok: ...` 6회. 이후 Read로 6개 webp 재확인(엉뚱한 사진 방지).
주의: `public\images\nextgen` 디렉토리는 sharp가 자동 생성하지 않음 — 먼저 `New-Item -ItemType Directory -Force public\images\nextgen`.

- [ ] **Step 4: newfamily 주일학교 섹션 placeholder → 실사진**

`src/app/newfamily/page.tsx` 수정 3곳:

(1) 9행 import에서 ImagePlaceholder 제거(이 파일 유일 사용처):

```ts
import { HomeButton } from '@/components/home/HomePrimitives'
```

(2) 71-75행 nextGen 배열에 photo 추가·label 제거:

```ts
const nextGen = [
  { title: '유치부', photo: '/images/nextgen/kinder.webp', info: '본당 1층 유치부실 · 주일 오전 9:00' },
  { title: '아동부', photo: '/images/nextgen/children.webp', info: '교육관 1층 · 주일 오전 9:00' },
  { title: '중·고등부', photo: '/images/nextgen/youth.webp', info: '교육관 지하 · 주일 오전 9:00' },
]
```

(3) 234-236행 카드 이미지 영역 교체 (Image는 이 파일에 이미 import됨):

```tsx
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={group.photo}
                    alt={`${group.title} 활동 사진`}
                    fill
                    unoptimized
                    sizes="(min-width: 960px) 33vw, 100vw"
                    className="object-cover"
                  />
                </div>
```

- [ ] **Step 5: 타입·lint 확인**

Run: `cd c:\Users\servi\projects\ycc-website; npx tsc --noEmit; npm run lint`
Expected: 에러 0

- [ ] **Step 6: 커밋**

```powershell
cd c:\Users\servi\projects\ycc-website; git add public/images/entry public/images/nextgen src/app/newfamily/page.tsx; git commit -m "feat: PDF 첨부 사진 적용(진입카드 3종 교체·주일학교 부서 사진 3종, PDF p4·p10)"
```

---

### Task 8: 전체 검증

- [ ] **Step 1: 단위 테스트**

Run: `cd c:\Users\servi\projects\ycc-website; npm test`
Expected: 전체 PASS

- [ ] **Step 2: lint**

Run: `cd c:\Users\servi\projects\ycc-website; npm run lint`
Expected: 에러·경고 0

- [ ] **Step 3: 프로덕션 빌드**

Run: `cd c:\Users\servi\projects\ycc-website; npm run build`
Expected: 빌드 성공, `/events` 라우트가 출력 목록에 등장

- [ ] **Step 4: 수동 확인 체크리스트 (env 부재로 로컬 시각 확인 불가 — 코드 리뷰로 대체)**

- 메가패널 컬럼 순서: 소개 > 안내 > 말씀과 찬양 > 소식 > 처음 오셨나요
- 소개 드롭다운: 담임목사 인사 > 교회 연혁 > 섬기는 사람들 (AboutSubnav와 일치)
- 소식 드롭다운의 특별행사·기타가 `/events?worship=…`로 연결
- SermonsGrid: `/sermons` 전체에 특별행사·기타 미노출, `/events` 전체에 행사만 노출
- 홈 히어로: Welcome to + 영천중앙교회 + 골드 라인만

- [ ] **Step 5: 검증 결과 사용자 보고 (푸시·PR은 사용자 지시 대기)**
