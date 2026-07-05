# "처음 오셨나요?" 자기완결형 페이지 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤더 "처음 오셨나요?" 드롭다운을 전부 `/newfamily` 페이지 내 앵커로 돌리고, `/about/visit`의 지도·연락처를 `/newfamily` "다시 오시는 길" 섹션에 통합한 뒤 `/about/visit`를 삭제·리다이렉트한다.

**Architecture:** 데이터 변경(nav.ts) + 기존 섹션에 앵커 id 부여 + `VisitBlock`/`KakaoMap` 재사용으로 신규 컴포넌트 없음. 페이지 삭제는 `next.config.ts` permanent redirect로 커버.

**Tech Stack:** Next.js 16.2.7 (App Router), React, Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-05-newfamily-self-contained-design.md`

## Global Constraints

- Next.js는 커스텀 16.2.7 — API 의심 시 `node_modules/next/dist/docs/` 확인. redirects 문법은 `{ source, destination, permanent }` (확인 완료).
- 커밋 메시지에 Co-Authored-By 라인 금지.
- 모든 명령은 repo 루트 `c:\Users\dw581\project\ycc-website`에서 실행 (git은 `git -C c:\Users\dw581\project\ycc-website ...` 권장).
- 테스트: `npm test` (vitest run). 빌드: `npm run build`.

---

### Task 1: 드롭다운을 /newfamily 내 앵커로 교체

**Files:**
- Modify: `src/lib/nav.ts:36-41`

**Interfaces:**
- Consumes: 없음 (데이터만 변경)
- Produces: 드롭다운 href `/newfamily#flow`, `/newfamily#faq`, `/newfamily#nextgen`, `/newfamily#visit` — Task 2가 이 4개 앵커 id를 페이지에 만든다.

- [ ] **Step 1: `newcomerLinks` 교체**

`src/lib/nav.ts`의 기존 블록:

```ts
const newcomerLinks: NavChild[] = [
  { label: '예배 시간표', href: '/worship#sunday', desc: '예배 안내' },
  { label: '교회 지도', href: '/about/visit#map', desc: '오시는 길' },
  { label: '주소 · 연락처', href: '/about/visit#contact', desc: '위치와 전화' },
  { label: 'FAQ', href: '/faq', desc: '자주 묻는 질문' },
]
```

를 다음으로 교체:

```ts
const newcomerLinks: NavChild[] = [
  { label: '예배 안내', href: '/newfamily#flow', desc: '주일예배 진행 순서' },
  { label: '자주 묻는 질문', href: '/newfamily#faq', desc: '새가족 FAQ' },
  { label: '다음세대 안내', href: '/newfamily#nextgen', desc: '아이와 함께 오세요' },
  { label: '다시 오시는 길', href: '/newfamily#visit', desc: '지도 · 주소 · 연락처' },
]
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (NavChild 형태 동일)

- [ ] **Step 3: Commit**

```bash
git add src/lib/nav.ts
git commit -m "feat: 처음 오셨나요 드롭다운을 newfamily 페이지 내 앵커로 교체"
```

---

### Task 2: /newfamily 섹션 앵커 부여 + "다시 오시는 길" 실전화

**Files:**
- Modify: `src/components/layout/VisitBlock.tsx`
- Modify: `src/app/newfamily/page.tsx`

**Interfaces:**
- Consumes: `KakaoMap` (default export, props 없음, 자체 높이 `h-[340px] sm:h-[400px]` iframe), `VisitBlock`의 `showPastorKakao?: boolean` prop, `churchInfo.address`
- Produces: `/newfamily`에 앵커 `#flow`, `#faq`, `#nextgen`, `#visit` (Task 1 드롭다운과 Task 3~4 링크가 의존)

- [ ] **Step 1: VisitBlock에 scroll-mt + 카카오맵 길찾기 버튼 추가**

`src/components/layout/VisitBlock.tsx`:

(1) import 아래에 길찾기 URL 상수 추가:

```ts
const kakaoMapUrl = `https://map.kakao.com/?q=${encodeURIComponent(churchInfo.address)}`
```

(2) 섹션 태그에 앵커 스크롤 보정 (고정 헤더 가림 방지):

```tsx
// 변경 전
<section id="visit" className={className}>
// 변경 후
<section id="visit" className={`scroll-mt-28 ${className}`}>
```

(3) Contact 블록의 Blog 링크 다음에 길찾기 버튼 추가 (`</VisitInfo>` 닫기 전, Blog `<a>` 바로 뒤):

```tsx
<a
  href={kakaoMapUrl}
  target="_blank"
  rel="noreferrer"
  className="motion-hover rounded-full border border-[#FEE500] bg-[#FEE500] px-5 py-3 text-sm font-bold text-[#3a2929] transition hover:brightness-95"
>
  카카오맵 길찾기
</a>
```

- [ ] **Step 2: newfamily 페이지 — 섹션 id 3개 부여**

`src/app/newfamily/page.tsx`에서 각 섹션의 여는 태그만 변경:

```tsx
// ServiceFlow(): 변경 전
<section className="bg-paper py-20 min-[960px]:py-28">
// 변경 후
<section id="flow" className="scroll-mt-28 bg-paper py-20 min-[960px]:py-28">

// Faq(): 변경 전
<section className="bg-surface py-20 min-[960px]:py-28">
// 변경 후
<section id="faq" className="scroll-mt-28 bg-surface py-20 min-[960px]:py-28">

// NextGeneration(): 변경 전
<section className="bg-bg py-20 min-[960px]:py-28">
// 변경 후
<section id="nextgen" className="scroll-mt-28 bg-bg py-20 min-[960px]:py-28">
```

주의: `Welcome()`도 `bg-bg py-20 min-[960px]:py-28`를 쓰므로 NextGeneration 쪽(`Container size="wide"`가 있는 함수)을 수정할 것. `#visit`은 VisitBlock이 이미 렌더링하므로 페이지에서 추가할 것 없음.

- [ ] **Step 3: Visit() — placeholder를 실제 지도로 교체 + PastorKakaoCard 표시**

(1) import 추가:

```tsx
import KakaoMap from '@/components/layout/KakaoMap'
```

(2) `Visit()`의 `VisitBlock` 호출을 다음으로 교체:

```tsx
function Visit() {
  const visitWorshipItems = adultWorshipSchedule.slice(0, 4)

  return (
    <VisitBlock
      eyebrow="Visit us"
      title="다시 오시는 길"
      description="처음 오시는 길이 어렵지 않도록 지도와 연락처, 예배 시간을 함께 안내합니다."
      showPastorKakao
      media={
        <div className="overflow-hidden rounded-[20px] border border-line">
          <KakaoMap />
        </div>
      }
      details={
        <VisitInfo label="Worship">
          <dl className="grid gap-2.5 text-sm leading-6">
            {visitWorshipItems.map((item) => (
              <div key={item.name} className="flex justify-between gap-4">
                <dt className="font-bold text-ink">{item.name}</dt>
                <dd className="text-ink-muted">{item.displayTime}</dd>
              </div>
            ))}
          </dl>
        </VisitInfo>
      }
    />
  )
}
```

(`ImagePlaceholder` import는 `NextGeneration()`이 계속 사용하므로 유지.)

- [ ] **Step 4: 로컬 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

Run: `npm run dev` 후 브라우저에서 `http://localhost:3000/newfamily#visit`
Expected: 헤더에 가려지지 않고 "다시 오시는 길" 섹션으로 스크롤, 카카오맵(또는 4초 후 구글맵 폴백) 렌더, 목사 카카오 카드·길찾기 버튼 표시. `#flow`/`#faq`/`#nextgen`도 각 섹션 도착.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/VisitBlock.tsx src/app/newfamily/page.tsx
git commit -m "feat: newfamily 섹션 앵커 부여 및 다시 오시는 길에 실제 지도·연락처 통합"
```

---

### Task 3: /about/visit 삭제 + 리다이렉트

**Files:**
- Delete: `src/app/about/visit/page.tsx` (디렉터리째)
- Modify: `next.config.ts:55-63`

**Interfaces:**
- Consumes: Task 2의 `/newfamily#visit` 앵커
- Produces: `/about/visit`, `/contact` → `/newfamily#visit` 308 리다이렉트 (Task 4 전까지 기존 내부 링크도 이 리다이렉트로 동작 유지)

- [ ] **Step 1: 페이지 삭제**

```bash
git rm -r src/app/about/visit
```

- [ ] **Step 2: redirects 수정**

`next.config.ts`의 기존 블록:

```ts
async redirects() {
  return [
    {
      source: '/contact',
      destination: '/about/visit',
      permanent: true,
    },
  ]
},
```

를 다음으로 교체 (이중 홉 방지 위해 /contact도 직행):

```ts
async redirects() {
  return [
    {
      source: '/contact',
      destination: '/newfamily#visit',
      permanent: true,
    },
    {
      source: '/about/visit',
      destination: '/newfamily#visit',
      permanent: true,
    },
  ]
},
```

- [ ] **Step 3: 리다이렉트 동작 확인**

Run: `npm run dev` 후 `http://localhost:3000/about/visit` 접속
Expected: `/newfamily#visit`로 이동. `/contact`도 동일.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat: about/visit 페이지 삭제 및 newfamily#visit 리다이렉트"
```

---

### Task 4: 잔여 참조 정리 (내부 링크 · sitemap · 테스트)

**Files:**
- Modify: `src/components/home/FullBleedBand.tsx:34`
- Modify: `src/app/about/page.tsx:100`
- Modify: `src/app/faq/page.tsx:132`
- Modify: `src/lib/sitemap.ts:18`
- Test: `src/lib/analytics/paths.test.ts:7`

**Interfaces:**
- Consumes: `/newfamily#visit` 앵커 (Task 2)
- Produces: 없음 (참조 정리 마무리)

- [ ] **Step 1: 테스트를 먼저 수정 (삭제된 경로 대신 실존 경로 검증)**

`src/lib/analytics/paths.test.ts:7`:

```ts
// 변경 전
expect(isTrackablePath('/about/visit')).toBe(true)
// 변경 후
expect(isTrackablePath('/newfamily')).toBe(true)
```

Run: `npm test`
Expected: PASS (isTrackablePath는 경로 패턴 기반이므로 통과해야 정상)

- [ ] **Step 2: 내부 링크 3곳 교체**

`src/components/home/FullBleedBand.tsx:34`:

```tsx
// 변경 전
<HomeButton href="/about/visit" variant="ghost">
  오시는 길
</HomeButton>
// 변경 후
<HomeButton href="/newfamily#visit" variant="ghost">
  오시는 길
</HomeButton>
```

`src/app/about/page.tsx:100` — `href="/about/visit"`를 `href="/newfamily#visit"`로 변경 (라벨 "예배시간·오시는 길" 유지).

`src/app/faq/page.tsx:132` — `<Link href="/about/visit" ...>오시는 길</Link>`의 href를 `/newfamily#visit`로 변경.

- [ ] **Step 3: sitemap에서 제거**

`src/lib/sitemap.ts`의 `staticRoutes` 배열에서 `'/about/visit',` 한 줄 삭제.

- [ ] **Step 4: 잔여 참조 0건 확인**

Run: `git grep -n "about/visit" -- src`
Expected: 결과 없음

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: 전체 PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/home/FullBleedBand.tsx src/app/about/page.tsx src/app/faq/page.tsx src/lib/sitemap.ts src/lib/analytics/paths.test.ts
git commit -m "chore: about/visit 잔여 참조를 newfamily#visit로 정리"
```

---

### Task 5: 최종 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 전체 PASS

- [ ] **Step 2: 프로덕션 빌드**

Run: `npm run build`
Expected: 성공, `/about/visit` 라우트 미출력, redirect 경고 없음

- [ ] **Step 3: 수동 체크리스트 (dev 서버)**

- 헤더 "처음 오셨나요?" 드롭다운 4개 항목이 모두 `/newfamily` 내 해당 섹션으로 이동 (타 페이지에서 진입 + `/newfamily`에 머문 상태 둘 다)
- 모바일 메뉴에서도 동일 동작
- `/about/visit` → `/newfamily#visit` 리다이렉트
- 홈 FullBleedBand·소개·FAQ 페이지의 "오시는 길" 링크가 `/newfamily#visit` 도착

- [ ] **Step 4: 이상 없으면 완료 보고** (push는 사용자 지시 시)
