# 딥 네이비 & 골드 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ycc-website 전 페이지를 핸드오프 시안(딥 네이비 #0B1F5C & 골드 #E8B54D, 단색 히어로, Pretendard 단일)대로 재구현한다.

**Architecture:** 색은 `globals.css` CSS 변수(단일 출처)를 교체하고, 페이지 히어로는 `PageHero`의 파스텔 그라디언트 맵을 3색 단색 맵(navy/royal/beige)으로 바꾼다. 홈 4개 섹션·헤더·푸터·서브페이지는 기존 컴포넌트를 시안 값으로 재스타일링한다. aurora/ken-burns 애니메이션과 `HeroBackdrop`(공개 히어로 사진·패럴랙스)은 제거한다.

**Tech Stack:** Next.js 16 App Router, Tailwind v4(@theme inline + CSS variables), Vitest 4, npm (pnpm 아님)

**시안 출처:** `C:\Users\servi\Downloads\design_handoff_ycc_redesign\` — 홈은 `Home 리디자인.dc.html` `#1a`만, 서브는 `서브페이지 리디자인.dc.html` `#1a~#1g` 전부.

---

## 사전 확인 결과 (조사 완료 — 재확인 불필요)

| README 체크리스트 | repo 현황 | 조치 |
|---|---|---|
| 8. 연혁 데이터 | `about/history/page.tsx:15-25`에 1956~2025 전부 반영됨 | 확인만 (수정 없음) |
| 9. "Rejoice" 문장 | `about/greeting/page.tsx`에 존재하지 않음 | 확인만 |
| 10. 마 6:33 줄바꿈 | `happiness/page.tsx:76-84` 이미 시안과 동일한 5줄 | 스타일만 변경 |
| 12. 설교 필터 4종 | `src/lib/worship.ts:41-46` `sermonFilterPills` 이미 전체/주일예배/주일찬양예배/수요예배 | 확인만 |
| 5. 모바일 드로어 | `Header.tsx:247` 이미 우측(right-0) 슬라이드-인 | nav 순서만 변경 |
| 11. 썸네일 | `SermonCard.tsx`에 AI 생성 코드 없음(DB `thumbnailUrl` 표시만). AI 생성은 관리자 수동 도구(`ThumbnailModal`)로 별도 | 카드 폴백만 단색+제목으로 변경, 관리자 도구는 유지 |

**시안 외 결정사항 (계획 확정):**
- `HERO_TONES`를 페이지별 8키에서 **색상별 3키**로 재편: `navy`(#0B1F5C·흰 글자·eyebrow 골드), `royal`(#2153B4·흰 글자·eyebrow #F2D48A), `beige`(#F0EEE3·네이비 글자·eyebrow #B8860B).
- 시안에 없는 페이지 톤 배정: about 계열·faq·news·bulletins·gallery = `navy`, sermons·praise·happiness = `royal`, worship = `beige`.
- `font-serif`는 이미 `--font-sans` 별칭(globals.css:42)이므로 **나눔명조 로드 제거만** 하면 산세리프 통일 완료. 소스의 `font-serif` 클래스는 만지는 파일에서만 정리(전면 치환 안 함).
- 홈 진입 카드·주일학교 사진은 교회 제공 대기 → 기존 `public/images/entry/*.webp`(진입 카드)와 `ImagePlaceholder`(주일학교) 유지. 파일 덮어쓰면 교체됨.
- newfamily의 FAQ·ServiceFlow 시간표·Cta 섹션은 시안에 없으나 제거 지시도 없음 → **유지**하고 새 팔레트에 맞게만 손봄.
- history 인트로 3번째 문단("작은 기도의 자리에서…")은 시안에 없으나 콘텐츠 삭제 지시가 없으므로 유지.

**검증 명령 (전부 npm, repo 루트 `c:\Users\servi\projects\ycc-website`):**
```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run lint        # eslint
npm run build       # next build — Tailwind arbitrary 클래스 오류는 build로만 잡힘 (codex 비판 반영: 각 웨이브 종료 시 필수)
```

**codex 비판 반영 노트 (2026-07-15):**
- 시맨틱 토큰(`bg-surface`/`text-faint`/`shadow-*`) 교체는 이 계획이 직접 수정하지 않는 파일(PostCard, AlbumCard, bulletins, news/gallery 상세, sign-in, error/not-found, admin)에도 **자동 파급된다 — 의도된 동작**(전 페이지 파스텔 제거가 리디자인 목적). 단 surface가 연블루→#F7F8FB로 밝아지므로 `bg-surface` 위 `bg-paper` 카드의 대비 약화 가능성을 Task 11 시각 확인에 포함.
- 잔존 `font-serif` 클래스는 sans로 렌더되어 무해하나 죽은 코드이므로 Task 11에서 전면 제거.
- 기각된 비판: PageHero `image` prop 삭제(삭제 자체가 타입 보호), 메가패널 CTA 중복(메가패널 유지는 README 명시 요구), Task1→3 사이 ken-burns 중간 무효화(빌드 실패 아님·연속 진행).

---

### Task 0: 브랜치 생성

- [ ] **Step 1: feature 브랜치 생성**

```bash
git -C c:/Users/servi/projects/ycc-website checkout -b feature/deep-navy-gold-redesign
```

---

### Task 1: 디자인 토큰 교체 + aurora/ken-burns 제거 (globals.css)

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: `:root` 색 토큰 교체 (11–29줄)**

기존 `:root` 블록 전체를 다음으로 교체:

```css
:root {
  /* 딥 네이비 & 골드 팔레트 — 시안 hifi 값 */
  --royal: 33 83 180; /* #2153B4 보조 블루 */
  --midnight: 11 31 92; /* #0B1F5C 딥 네이비 */
  --navy-deep: 7 21 64; /* #071540 푸터 */
  --gold: 232 181 77; /* #E8B54D 주 포인트 */
  --gold-deep: 184 134 11; /* #B8860B 밝은 배경 위 골드 */
  --gold-soft: 242 212 138; /* #F2D48A 파란 히어로 위 eyebrow */
  --beige: 240 238 227; /* #F0EEE3 홈·예배시간 히어로 */
  --bg: 255 255 255;
  --surface: 247 248 251; /* #F7F8FB 보조 섹션 배경 */
  --paper: 255 255 255;
  --ink: var(--midnight);
  --ink-muted: 58 70 100; /* #3A4664 본문 */
  --faint: 107 119 148; /* #6B7794 캡션 */
  --faint-soft: 138 148 172; /* #8A94AC 장소 표기 */
  --line: 227 232 242; /* #E3E8F2 */
  --line-soft: 237 241 248; /* #EDF1F8 */
  --line-strong: 216 224 239; /* #D8E0EF */
  --card-blue: 243 247 253; /* #F3F7FD 행복선언 고백 카드 */
  --accent: var(--royal);
  --accent-deep: var(--midnight);
}
```

(china/sky/dawn/porcelain/moon 파스텔 토큰 삭제 — 사용처는 Task 5 Footer의 `--china` 2곳과 `--surface: var(--dawn)`뿐. surface는 위에서 새 값으로 대체됨.)

- [ ] **Step 2: `@theme inline`에 신규 색 노출 + 그림자 시안 값으로 교체 (31–46줄)**

```css
@theme inline {
  --color-bg: rgb(var(--bg));
  --color-surface: rgb(var(--surface));
  --color-ink: rgb(var(--ink));
  --color-ink-muted: rgb(var(--ink-muted));
  --color-faint: rgb(var(--faint));
  --color-faint-soft: rgb(var(--faint-soft));
  --color-accent: rgb(var(--accent));
  --color-accent-deep: rgb(var(--accent-deep));
  --color-navy-deep: rgb(var(--navy-deep));
  --color-gold: rgb(var(--gold));
  --color-gold-deep: rgb(var(--gold-deep));
  --color-gold-soft: rgb(var(--gold-soft));
  --color-beige: rgb(var(--beige));
  --color-line: rgb(var(--line));
  --color-line-soft: rgb(var(--line-soft));
  --color-line-strong: rgb(var(--line-strong));
  --color-card-blue: rgb(var(--card-blue));
  --color-paper: rgb(var(--paper));
  --font-sans: var(--font-pretendard), system-ui, sans-serif;
  --font-serif: var(--font-sans);
  --shadow-soft: 0 12px 32px rgb(var(--midnight) / 0.1);
  --shadow-subtle: 0 8px 24px rgb(var(--midnight) / 0.06);
  --shadow-lifted: 0 18px 44px rgb(var(--midnight) / 0.16);
}
```

- [ ] **Step 3: ken-burns·scroll-cue·aurora 블록 삭제 (72–166줄)**

`/* Ken Burns — ... */`부터 `@keyframes aurora-d { ... }` 끝까지 통째로 삭제. `@media (prefers-reduced-motion: reduce)` 안의 `.ken-burns`, `.scroll-cue-line`, `.aurora-blob` 규칙 3개도 삭제 (`[data-reveal]`, `.motion-hover`, `*` 규칙은 유지).

- [ ] **Step 4: 사용처 잔존 확인**

```bash
grep -rn "ken-burns\|aurora-blob\|scroll-cue\|--china\|--dawn\|--sky\|--porcelain\|--moon" c:/Users/servi/projects/ycc-website/src
```
Expected: Task 3(HeroBackdrop 삭제)·Task 5(Footer) 대상 파일 외 매치 없음. 나오면 해당 태스크에서 처리 확인.

- [ ] **Step 5: 검증 & 커밋**

```bash
npm run typecheck && npm test
git add src/app/globals.css && git commit -m "feat: 딥 네이비&골드 디자인 토큰으로 교체 및 aurora/ken-burns 제거"
```

---

### Task 2: 폰트·메타데이터 정리 (layout.tsx)

**Files:**
- Modify: `src/app/layout.tsx:1-18` (나눔명조), `:72-92` (OG)

- [ ] **Step 1: 나눔명조 로드 제거**

- 2줄 `import { Nanum_Myeongjo } from 'next/font/google'` 삭제
- 13–18줄 `const nanumMyeongjo = ...` 블록 삭제
- 101줄 `className={\`${pretendard.variable} ${nanumMyeongjo.variable}\`}` → `className={pretendard.variable}`

- [ ] **Step 2: OG/메타 사이트명 영문 표기**

`openGraph.siteName: '영천중앙교회'`(76줄) → `siteName: 'Yeongcheonjoongangchurch'`. OG 이미지 `alt: '영천중앙교회'`(83줄) → `alt: 'Yeongcheonjoongangchurch 영천중앙교회'`.

- [ ] **Step 3: 검증 & 커밋**

```bash
npm run typecheck && npm test
git add src/app/layout.tsx && git commit -m "feat: 나눔명조 로드 제거(산세리프 통일) 및 OG 사이트명 영문 표기"
```

---

### Task 3: PageHero 단색화 + HeroBackdrop 삭제 + 각 히어로 tone 교체 + Subnav

**Files:**
- Modify: `src/components/layout/PageHero.tsx` (전면 재작성)
- Delete: `src/components/layout/HeroBackdrop.tsx`
- Modify: `src/components/layout/Subnav.tsx:22-43`
- Modify: `src/app/happiness/page.tsx:25`, `src/app/worship/page.tsx:98`, `src/app/faq/page.tsx:109`, `src/components/sermons/SermonsHero.tsx:6`, `src/components/praise/PraiseHero.tsx`, `src/components/news/NewsHero.tsx`, `src/components/bulletins/BulletinsHero.tsx`, `src/components/gallery/GalleryHero.tsx` (tone 값)

- [ ] **Step 1: PageHero.tsx 전면 재작성**

```tsx
import Container from './Container'
import Reveal from '@/components/ui/Reveal'

/**
 * 페이지 히어로 — 단색 배경 3종(PDF 수정요청: 사진·그라디언트 전면 제거).
 * navy(소개·소식·처음), royal(행복선언·설교·찬양), beige(예배 시간).
 */
const HERO_TONES = {
  navy: {
    section: 'bg-accent-deep text-white',
    eyebrow: 'text-gold',
    subtitle: 'text-white/[0.82]',
  },
  royal: {
    section: 'bg-accent text-white',
    eyebrow: 'text-gold-soft',
    subtitle: 'text-white/85',
  },
  beige: {
    section: 'bg-beige text-ink',
    eyebrow: 'text-gold-deep',
    subtitle: 'text-ink-muted',
  },
} as const

export type HeroTone = keyof typeof HERO_TONES

interface PageHeroProps {
  eyebrow?: string
  title: string
  subtitle?: string
  /** 페이지별 히어로 색. 기본은 딥 네이비. */
  tone?: HeroTone
}

export default function PageHero({ eyebrow, title, subtitle, tone = 'navy' }: PageHeroProps) {
  const colors = HERO_TONES[tone]
  return (
    <section className={`${colors.section}`}>
      <Container size="wide" className="py-16 sm:py-[4.5rem]">
        <Reveal variant="fade">
          {eyebrow && (
            <p className={`text-sm font-extrabold uppercase tracking-[0.3em] ${colors.eyebrow}`}>{eyebrow}</p>
          )}
        </Reveal>
        <Reveal variant="fade-up" delay={100}>
          <h1 className="mt-3.5 text-4xl font-extrabold leading-tight tracking-tight sm:text-[58px]">
            {title}
          </h1>
        </Reveal>
        {subtitle && (
          <Reveal variant="fade-up" delay={220}>
            <p className={`mt-4 max-w-2xl text-lg leading-7 sm:text-[19px] ${colors.subtitle}`}>{subtitle}</p>
          </Reveal>
        )}
      </Container>
    </section>
  )
}
```

주의: `image` prop 삭제 — 공개 페이지 사용처 중 image를 넘기는 곳 없음(전수 grep 확인 완료, unsplash image는 별도 컴포넌트 `AdminPageHero`만 사용).

- [ ] **Step 2: HeroBackdrop.tsx 삭제**

```bash
git rm src/components/layout/HeroBackdrop.tsx
```
(사용처는 PageHero뿐 — Step 1에서 import 제거됨.)

- [ ] **Step 3: 각 사용처 tone 교체**

- `src/app/about/page.tsx`, `about/history/page.tsx`, `about/greeting/page.tsx`, `about/serving/page.tsx`: tone 미지정 유지(기본 navy)
- `src/app/happiness/page.tsx:25`: `tone="worship"` → `tone="royal"`
- `src/app/worship/page.tsx:98`: `tone="worship"` → `tone="beige"`
- `src/app/faq/page.tsx:109`: `tone="newfamily"` → 삭제(기본 navy)
- `src/components/sermons/SermonsHero.tsx:6`: `tone="sermons"` → `tone="royal"`
- `src/components/praise/PraiseHero.tsx`: 기존 `tone="praise"` → `tone="royal"`
- `src/components/news/NewsHero.tsx`, `bulletins/BulletinsHero.tsx`, `gallery/GalleryHero.tsx`: 기존 tone prop 삭제(기본 navy)

- [ ] **Step 4: Subnav 활성 탭 = 네이비 텍스트 + 하단 3px 라인 (시안)**

`src/components/layout/Subnav.tsx` 26–43줄의 `Container` 내부를 다음으로 교체:

```tsx
      <Container size="wide" className="flex items-center gap-8 overflow-x-auto">
        {items.map((item) => {
          const active = item.href === activeHref
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex-none whitespace-nowrap py-[18px] text-[16px] font-bold transition ${
                active
                  ? 'text-accent-deep shadow-[inset_0_-3px_0_var(--color-accent-deep)]'
                  : 'text-faint hover:text-accent-deep'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </Container>
```

nav 래퍼 클래스의 `bg-paper/85 backdrop-blur-md`는 `bg-paper`로 단순화(시안: 흰 바), `shadow-subtle` 삭제, `border-b border-line` 유지.

- [ ] **Step 5: 검증 & 커밋**

```bash
npm run typecheck && npm test && npm run lint
git add -A && git commit -m "feat: PageHero 단색 3톤 체계로 교체 및 HeroBackdrop 제거, 서브내비 활성 탭 라인화"
```

---

### Task 4: Header — CTA 분리·nav 순서·색 정리

**Files:**
- Modify: `src/lib/nav.ts:73-79`
- Modify: `src/components/layout/Header.tsx:90-136`
- Modify: `src/components/layout/BrandLogo.tsx:26`

- [ ] **Step 1: nav.ts — "처음 오셨나요?"를 "소식" 앞으로 (PDF)**

`navLinks` 배열(73–79줄)에서 마지막 항목(처음 오셨나요?)을 "소식" 앞(4번째)으로 이동:

```ts
export const navLinks: NavSection[] = [
  { label: '소개', href: '/about', section: '/about', eyebrow: 'About', children: aboutLinks },
  { label: '안내', href: '/happiness', section: '/happiness', eyebrow: 'Guide', children: guideLinks },
  { label: '말씀과 찬양', href: '/sermons', section: '/sermons', eyebrow: 'Worship', children: wordLinks, groups: worshipGroups },
  { label: '처음 오셨나요?', href: '/newfamily', section: '/newfamily', eyebrow: 'Welcome', children: newcomerLinks },
  { label: '소식', href: '/news', section: '/news', eyebrow: 'News', children: newsLinks },
]
```

- [ ] **Step 2: Header 데스크탑 — "처음 오셨나요?"를 filled CTA로 분리 렌더 (시안 1a 헤더)**

`Header.tsx` 127–137줄 데스크탑 nav 블록을 다음으로 교체 (CTA는 항상 마지막):

```tsx
        <nav className="hidden items-center gap-1 min-[960px]:flex" aria-label="주요 메뉴">
          {navLinks
            .filter((link) => link.section !== '/newfamily')
            .map((link) => {
              const active = isActiveItem(link)
              const itemClass = `rounded-full px-4 py-2 text-[16px] font-bold transition ${active ? activeNavClassName : navLinkClassName}`
              return (
                <Link key={link.href} href={link.href} className={itemClass} aria-current={active ? 'page' : undefined}>
                  {link.label}
                </Link>
              )
            })}
          <Link
            href="/newfamily"
            className="ml-2 rounded-full bg-accent-deep px-5 py-2.5 text-[15px] font-extrabold text-white transition hover:bg-gold hover:text-[#1D1503]"
            aria-current={matchesSection('/newfamily') ? 'page' : undefined}
          >
            처음 오셨나요?
          </Link>
        </nav>
```

- [ ] **Step 3: Header 색 분기 정리 — 시안 hover `rgba(11,31,92,0.06)`**

90–100줄의 두 클래스 정의를 다음으로 교체:

```tsx
  const navLinkClassName = isSolid
    ? 'text-ink-muted hover:bg-accent-deep/[0.06] hover:text-accent-deep'
    : heroIsLight
      ? 'text-ink-muted hover:bg-accent-deep/[0.06] hover:text-accent-deep'
      : 'text-white/90 hover:bg-white/10 hover:text-white'

  const activeNavClassName = isSolid
    ? 'bg-accent-deep/[0.07] text-accent-deep'
    : heroIsLight
      ? 'bg-accent-deep/[0.07] text-accent-deep'
      : 'bg-white/15 text-white'
```

(`isImmersive`/`heroIsLight` 로직 자체는 유지 — 홈 히어로는 여전히 밝은 베이지, newfamily는 네이비.)

- [ ] **Step 4: BrandLogo 워드마크 23px + 네이비**

`BrandLogo.tsx` 26줄: `text-[24px]` → `text-[23px]`, `font-serif` 클래스 삭제:

```tsx
      <span className="text-[23px] font-extrabold tracking-tight">영천중앙교회</span>
```
(글자색은 헤더 상태별 currentColor 상속 유지.)

- [ ] **Step 5: 검증 & 커밋**

```bash
npm run typecheck && npm test && npm run lint
git add -A && git commit -m "feat: 헤더 CTA 분리 및 모바일 메뉴 순서 변경(처음 오셨나요를 소식 앞으로)"
```

---

### Task 5: Footer — #071540 배경 + 골드 컬럼 헤딩

**Files:**
- Modify: `src/components/layout/Footer.tsx:24,27,59,70`

- [ ] **Step 1: 색 교체**

- 24줄: `bg-[rgb(var(--midnight))]` → `bg-navy-deep`
- 27줄: `font-serif` 삭제 → `<h2 className="text-2xl font-extrabold tracking-tight text-white">`
- 59줄·70줄: `text-[rgb(var(--china))]` → `text-gold`, `tracking-[0.18em]` → `tracking-[0.2em]`

(menuLinks 순서는 이미 "처음 오셨나요?"가 "소식" 앞 — 변경 없음. 3단 풀 푸터 유지 — 시안의 1줄 푸터는 지면 절약용.)

- [ ] **Step 2: 검증 & 커밋**

```bash
npm run typecheck && npm test
git add src/components/layout/Footer.tsx && git commit -m "feat: 푸터 딥 네이비(#071540) 배경 및 골드 컬럼 헤딩 적용"
```

---

### Task 6: 홈 — HomePrimitives + 4개 섹션

**Files:**
- Modify: `src/components/home/HomePrimitives.tsx`
- Modify: `src/components/home/ImmersiveHero.tsx` (전면)
- Modify: `src/components/home/Manifesto.tsx` (전면)
- Modify: `src/components/home/FullBleedBand.tsx` (전면)
- Modify: `src/components/home/EntryCards.tsx` (전면)

- [ ] **Step 1: HomePrimitives — 버튼 변형 재정의 + Eyebrow 기본 골드**

`HomeButton`의 `classes`(13–20줄)를 교체하고 variant 타입 확장:

```tsx
export function HomeButton({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'outline' | 'white' | 'ghost'
}) {
  const classes = {
    // 밝은 배경 위: 네이비 filled / 네이비 outline
    primary: 'border-transparent bg-accent-deep text-white hover:bg-accent',
    outline: 'border-[1.5px] border-accent-deep text-accent-deep hover:bg-accent-deep/[0.06]',
    // 어두운(네이비) 배경 위: 흰 filled(hover 골드) / 흰 outline
    white: 'border-transparent bg-white text-accent-deep hover:bg-gold hover:text-[#1D1503]',
    ghost: 'border-[1.5px] border-white/50 text-white hover:bg-white/10',
  }

  return (
    <Link
      href={href}
      className={`motion-hover inline-flex items-center justify-center rounded-full border px-7 py-4 text-base font-extrabold transition ${classes[variant]}`}
    >
      {children}
    </Link>
  )
}
```

`Eyebrow`(32–34줄): `text-accent` → `text-gold-deep`, 크기 `text-[13.5px] font-extrabold`:

```tsx
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13.5px] font-extrabold uppercase tracking-[0.28em] text-gold-deep ${className}`}>{children}</p>
}
```

`ImagePlaceholder`는 유지(주일학교 사진 제공 대기 슬롯). 내부 그라디언트가 accent 토큰 기반이라 새 팔레트로 자동 정합.

주의: 기존 `variant="accent"`/`variant="light"` 사용처 전수 확인:
```bash
grep -rn "HomeButton" c:/Users/servi/projects/ycc-website/src
```
사용처(FullBleedBand, newfamily)는 이 계획의 Task 6·10에서 새 variant로 함께 수정. 그 외 사용처가 나오면 primary/outline으로 치환.

- [ ] **Step 2: ImmersiveHero 전면 재작성 (시안 1a 히어로 — 중앙 정렬·베이지 단색)**

```tsx
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { HomeButton } from './HomePrimitives'

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
        <Reveal delay={300}>
          <p className="mx-auto mt-7 max-w-[640px] break-keep text-[clamp(16px,2vw,21px)] font-medium leading-[1.7] text-ink-muted">
            오래된 믿음 위에, 새로운 은혜가 머무는 곳.
            <br />
            주일 오전 11시, 본당에서 함께 예배합니다.
          </p>
        </Reveal>
        <Reveal delay={380}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <HomeButton href="/worship">예배 시간 안내</HomeButton>
            <HomeButton href="/newfamily#visit" variant="outline">
              오시는 길
            </HomeButton>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
```

- [ ] **Step 3: Manifesto 전면 재작성 (흰 배경·골드 라인·PDF 지정 줄바꿈)**

```tsx
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'

// 홈 #2 — 환영 메시지. 흰 단색 배경 + 골드 라인 (페리윙클 제거, PDF 지정 줄바꿈).
export default function Manifesto() {
  return (
    <section className="bg-paper py-28 min-[960px]:py-32">
      <Container size="wide" className="text-center">
        <Reveal>
          <div className="mx-auto h-1 w-14 bg-gold" aria-hidden />
        </Reveal>
        <Reveal delay={120}>
          <p className="mx-auto mt-9 max-w-[56rem] break-keep text-[clamp(22px,3.2vw,38px)] font-bold leading-[1.6] text-accent-deep">
            오래된 믿음 위에, 새로운 은혜가 머무는
            <br />
            영천중앙교회에 오신
            <br />
            여러분 환영합니다
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
```

- [ ] **Step 4: FullBleedBand 전면 재작성 (단색 네이비 + 우측 사진 카드)**

```tsx
import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { HomeButton } from './HomePrimitives'

// 홈 #3 — 소개 밴드. 배경 사진·블러 제거 → 단색 딥 네이비 + 골드 포인트 (PDF).
export default function FullBleedBand() {
  return (
    <section className="bg-accent-deep py-24 text-white min-[960px]:py-28">
      <Container size="wide" className="grid items-center gap-12 min-[960px]:grid-cols-[1.1fr_0.9fr] min-[960px]:gap-16">
        <Reveal>
          <p className="text-[13.5px] font-extrabold uppercase tracking-[0.28em] text-gold">About</p>
          <h2 className="mt-5 text-[clamp(26px,3.4vw,42px)] font-extrabold leading-[1.4] tracking-tight">
            예수 그리스도의 복음 위에 세워진
            <br />
            <span className="text-gold">믿음의 공동체</span>입니다
          </h2>
          <p className="mt-6 max-w-xl text-[clamp(15px,1.6vw,18px)] leading-[1.85] text-white/85">
            대한예수교장로회 영천중앙교회는 예배와 말씀 위에 서서, 기도로 하나님의 통치를 구하며,
            이웃과 다음 세대를 섬김으로 하나님 나라가 이루어지기를 갈망합니다.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <HomeButton href="/about" variant="white">
              교회 소개
            </HomeButton>
            <HomeButton href="/about/greeting" variant="ghost">
              담임목사 인사
            </HomeButton>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <div className="relative h-[320px] overflow-hidden rounded-2xl shadow-[0_28px_60px_rgb(0_0_0/0.35)] min-[960px]:h-[420px]">
            <Image
              src="/images/church-spire.webp"
              alt="영천중앙교회 전경"
              fill
              unoptimized
              sizes="(min-width: 960px) 45vw, 100vw"
              className="object-cover object-[center_28%]"
            />
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
```

- [ ] **Step 5: EntryCards 전면 재작성 (상단 사진 250px + 하단 흰 캡션 영역·골드 화살표)**

```tsx
import Link from 'next/link'
import Image from 'next/image'
import Container from '@/components/layout/Container'
import Reveal from '@/components/ui/Reveal'
import { Eyebrow } from './HomePrimitives'

// 홈 #4 — 핵심 진입 3종(말씀/주일학교/찬양). 사진 위 텍스트 오버레이 없음(PDF):
// 상단 사진 + 하단 흰 캡션 영역. 사진은 public/images/entry/*.webp 덮어쓰면 교체(교회 제공 대기).

interface EntryCard {
  key: string
  title: string
  photo: string
  desc: string
  href: string
  items: string[]
}

const cards: EntryCard[] = [
  {
    key: 'word',
    title: '말씀',
    photo: '/images/entry/word.webp',
    desc: '매 예배의 말씀을 다시 듣고 묵상합니다.',
    href: '/sermons',
    items: ['주일예배', '주일찬양예배', '수요예배'],
  },
  {
    key: 'school',
    title: '주일학교',
    photo: '/images/entry/school.webp',
    desc: '다음 세대가 말씀 위에 자랍니다.',
    href: '/worship',
    items: ['유치부', '아동부', '중고등부'],
  },
  {
    key: 'praise',
    title: '찬양',
    photo: '/images/entry/praise.webp',
    desc: '찬양으로 하나님께 영광을 올려 드립니다.',
    href: '/praise',
    items: ['찬양대', '특송'],
  },
]

export default function EntryCards({ sermonSummary }: { sermonSummary?: string | null }) {
  return (
    <section className="bg-paper py-24 min-[960px]:py-28">
      <Container size="wide">
        <Reveal className="text-center">
          <Eyebrow>Worship · Community</Eyebrow>
          <h2 className="mt-4 text-[clamp(26px,3.4vw,40px)] font-extrabold tracking-tight text-accent-deep">
            함께 예배하고, 함께 자랍니다
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {cards.map((card, i) => {
            const description = card.key === 'word' && sermonSummary ? `“${sermonSummary}”` : card.desc
            return (
              <Reveal key={card.key} delay={80 + i * 80} className="h-full">
                <Link
                  href={card.href}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-subtle transition duration-300 hover:-translate-y-1 hover:shadow-lifted"
                >
                  <div className="relative h-[250px] overflow-hidden">
                    <Image
                      src={card.photo}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 px-7 pb-8 pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[26px] font-extrabold text-accent-deep">{card.title}</h3>
                      <span className="text-xl font-extrabold text-gold-deep" aria-hidden>
                        →
                      </span>
                    </div>
                    <p className="line-clamp-3 text-base leading-[1.7] text-ink-muted">{description}</p>
                    <p className="mt-auto text-[14.5px] font-semibold text-faint">{card.items.join(' · ')}</p>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
```

- [ ] **Step 6: 검증 & 커밋**

```bash
npm run typecheck && npm test && npm run lint
git add src/components/home && git commit -m "feat: 홈 4개 섹션 딥 네이비&골드 시안(#1a)으로 재구현"
```

---

### Task 7: 소개 서브페이지 (history 타임라인·serving 골드 도트·greeting·about 인덱스)

**Files:**
- Modify: `src/app/about/history/page.tsx:36-91`
- Modify: `src/app/about/serving/page.tsx:64-98`
- Modify: `src/app/about/greeting/page.tsx:41-70`
- Modify: `src/app/about/page.tsx` (font-serif·eyebrow 정리)

- [ ] **Step 1: history — OUR STORY eyebrow 골드 + 타임라인 시안화**

39줄 eyebrow: `<p className="text-[13px] font-bold text-accent-deep">OUR STORY</p>` →
```tsx
<p className="text-[13px] font-extrabold uppercase tracking-[0.24em] text-gold-deep">Our Story</p>
```
42줄 h2: `font-serif` 삭제.
68줄 타임라인 래퍼: `<div className="border-t border-line pb-20 pt-20 sm:pb-24 sm:pt-24">` → `<div className="border-t border-line bg-surface pb-24 pt-20 sm:pt-24">`
71줄 중앙선: `bg-line` → `bg-line-strong`
76줄 도트: `border-2 border-bg bg-accent` → `h-3.5 w-3.5 rounded-full border-[3px] border-surface bg-gold` (기존 `h-3 w-3` 대체)
82줄 연도: `font-serif text-3xl font-extrabold tracking-tight text-accent-deep` → `text-3xl font-extrabold tracking-tight text-accent-deep` (30px 유지)

- [ ] **Step 2: serving — 섹션 타이틀 골드 도트, font-serif 정리**

64·97줄 h2: `font-serif` 삭제. 65·98줄 도트: `bg-accent` → `bg-gold`. 85줄 이름·107줄 role의 `font-serif` 삭제.

- [ ] **Step 3: greeting — 리드 문장 추가 (시안 1b: 26px/800 네이비 2줄)**

48줄 본문 컨테이너 첫 문단 `<p>영천중앙교회 홈페이지를 방문해 주신 여러분을 진심으로 환영합니다.</p>`를 리드 스타일로 교체:

```tsx
<p className="text-[clamp(21px,2.4vw,26px)] font-extrabold leading-[1.55] text-accent-deep">
  영천중앙교회 홈페이지를 방문해 주신
  <br />
  여러분을 진심으로 환영합니다.
</p>
```
41·70줄 `font-serif` 삭제.

- [ ] **Step 4: about 인덱스 — eyebrow·font-serif 정리**

72줄: `<p className="text-[13px] font-bold text-accent-deep">OUR STORY</p>` → history와 동일한 골드 eyebrow로. 75줄 등 `font-serif` 삭제 (파일 내 전수).

- [ ] **Step 5: 검증 & 커밋**

```bash
npm run typecheck && npm test
git add src/app/about && git commit -m "feat: 소개 서브페이지 골드 포인트 적용(타임라인 도트·섹션 도트·리드 문장)"
```

---

### Task 8: 행복선언 + 예배 시간

**Files:**
- Modify: `src/app/happiness/page.tsx:50-89`
- Modify: `src/app/worship/page.tsx:82-92`

- [ ] **Step 1: happiness — 고백 카드 #F3F7FD + 마 6:33 골드 출처**

53줄 고백 카드 클래스 교체:
```tsx
className="rounded-2xl border border-line-strong bg-card-blue px-7 py-[30px] text-center text-[clamp(20px,2.6vw,25px)] font-extrabold leading-[1.5] tracking-tight text-accent-deep"
```
(`font-serif`·`bg-paper`·`shadow-subtle` 제거.)

75줄 blockquote: `font-serif` 삭제, `text-[clamp(19px,2.4vw,24px)] font-extrabold leading-[1.75] text-accent-deep`.
86줄 figcaption: `text-accent` → `text-gold-deep`.

- [ ] **Step 2: worship — ScheduleRow 시안화 (시간 골드·장소 연회색)**

`ScheduleRow`(82–92줄)를 교체:

```tsx
function ScheduleRow({ item }: { item: WorshipScheduleItem }) {
  return (
    <div className="grid items-baseline gap-x-3.5 gap-y-1 border-b border-line-soft py-[15px] last:border-b-0 sm:grid-cols-[8rem_1fr_auto]">
      <strong className="text-[17px] font-bold text-accent-deep">{item.name}</strong>
      <span className="text-[14.5px] text-faint-soft">{item.place}</span>
      <span className="text-[15px] font-extrabold text-gold-deep sm:justify-self-end sm:whitespace-nowrap">
        {item.displayTime}
      </span>
    </div>
  )
}
```

113줄 섹션 h2: `font-serif` 삭제 → `text-2xl font-extrabold tracking-tight text-accent-deep`.
(주일학교 데이터는 `worship.ts:111-116`에 PDF 구성 그대로 반영돼 있고 school 섹션에 설명 문구 없음 — 변경 불필요.)

- [ ] **Step 3: 검증 & 커밋**

```bash
npm run typecheck && npm test
git add src/app/happiness src/app/worship && git commit -m "feat: 행복선언 고백 카드 및 예배 시간표 딥 네이비&골드 적용"
```

---

### Task 9: 설교 카드 — 썸네일 폴백 단색 네이비 + 흰 제목

**Files:**
- Modify: `src/components/sermons/SermonCard.tsx:13-38`
- Test: `src/components/sermons/SermonCard.test.tsx` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

기존 테스트 컨벤션 확인 후(`src/components/sermons/SermonSummary.test.ts` 참고 — node 환경이므로 렌더 테스트가 없다면 컴포넌트 순수 로직 없음 → 이 경우 렌더 스냅샷 대신 폴백 분기를 데이터로 검증할 수 없으므로 **테스트 생략하고 Step 2로** — vitest environment가 node라 DOM 렌더 불가. 판단 근거를 커밋 메시지에 남기지 말고 그냥 진행).

- [ ] **Step 2: 폴백 분기 교체**

`SermonCard.tsx` 23–25줄의 폴백 `<div className="h-full w-full bg-[linear-gradient(...)]" />`를 교체:

```tsx
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-accent-deep p-6 text-center">
              <p className="line-clamp-3 text-[clamp(17px,1.8vw,22px)] font-extrabold leading-[1.5] text-white">
                {title}
              </p>
            </div>
          )}
```

14줄 컨테이너: `bg-surface` 유지. 27줄 재생 배지: `bg-accent`(=#2153B4, 시안과 일치) + `shadow-[0_8px_22px_rgb(33_83_180/0.45)]`로 교체. 34줄 메타 행: `text-accent-deep` → `text-accent` (시안: #2153B4). 38줄 h3: `font-serif` 삭제.

- [ ] **Step 3: 검증 & 커밋**

```bash
npm run typecheck && npm test
git add src/components/sermons && git commit -m "feat: 설교 카드 썸네일 부재 시 단색 네이비+제목 폴백 적용"
```

---

### Task 10: 처음 오셨나요(newfamily) — 단색 히어로·주일학교 안내·오시는 길 사진

**Files:**
- Modify: `src/app/newfamily/page.tsx:71-87` (nextGen 데이터), `:103-127` (Hero), `:129-148` (Welcome), `:231-267` (NextGeneration), `:285-310` (Cta)
- Modify: `src/components/layout/VisitBlock.tsx:48-50`

- [ ] **Step 1: Hero — 사진·그라디언트 제거, 단색 네이비 (시안 1g)**

`Hero()` 함수를 교체:

```tsx
function Hero() {
  return (
    <section className="flex min-h-[480px] items-center bg-accent-deep py-28 text-center text-white min-[960px]:min-h-[60svh]">
      <Container size="wide" className="pt-14">
        <Reveal>
          <p className="text-sm font-extrabold uppercase tracking-[0.3em] text-gold">First Visit</p>
        </Reveal>
        <Reveal delay={120}>
          <h1 className="mx-auto mt-6 max-w-4xl text-[clamp(38px,6vw,62px)] font-extrabold leading-[1.2] tracking-tight">
            교회가 처음이세요?
            <br />
            진심으로 환영합니다.
          </h1>
        </Reveal>
        <Reveal delay={240}>
          <p className="mx-auto mt-6 max-w-[640px] text-[clamp(17px,2vw,20px)] leading-[1.75] text-white/85">
            낯설고 조심스러운 마음 그대로 오셔도 괜찮습니다.
            <br className="hidden sm:block" />
            영천중앙교회가 처음 방문의 길을 차분히 안내해드립니다.
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
```
(파일 상단 `next/image` import는 Cta에서 계속 사용 — 유지.)

- [ ] **Step 2: Welcome — 골드 라인 + 32px 네이비 인용**

`Welcome()`의 blockquote 블록을 교체:

```tsx
function Welcome() {
  return (
    <section className="bg-paper py-24 min-[960px]:py-28">
      <Container>
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto h-1 w-14 bg-gold" aria-hidden />
            <blockquote className="mt-8 text-[clamp(24px,3.2vw,32px)] font-extrabold leading-[1.6] tracking-tight text-accent-deep">
              신앙의 문턱이 높게 느껴지신다면
              <br />
              그 마음 그대로 오셔도 괜찮습니다.
              <br />
              한 분 한 분을 귀한 가족으로 맞이하겠습니다.
            </blockquote>
            <p className="mt-7 text-sm font-bold text-faint">영천중앙교회 담임목사 드림</p>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
```

- [ ] **Step 3: nextGen 데이터 — 체크리스트 제거, `장소 · 시간` 한 줄 (PDF)**

71–87줄 `nextGen` 배열을 교체 (worship.ts 스케줄과 값 일치):

```tsx
const nextGen = [
  { title: '유치부', label: '유치부 사진 자리', info: '본당 1층 유치부실 · 주일 오전 9:00' },
  { title: '아동부', label: '아동부 사진 자리', info: '교육관 1층 · 주일 오전 9:00' },
  { title: '중·고등부', label: '중·고등부 사진 자리', info: '교육관 지하 · 주일 오전 9:00' },
]
```

`NextGeneration()`의 카드 내부(249–259줄)를 교체:

```tsx
                <div className="p-6">
                  <h3 className="text-2xl font-extrabold text-accent-deep">{group.title}</h3>
                  <p className="mt-3 text-[15px] font-bold text-gold-deep">{group.info}</p>
                </div>
```

이에 따라 `CheckIcon()` 함수(312–318줄)와 사용처가 사라지므로 함수 삭제. `SectionTitle` eyebrow "For Families"·title "주일학교 안내입니다"는 유지.

- [ ] **Step 4: Cta — 새 팔레트 정리(유지)**

287줄 섹션 배경: `bg-[oklch(0.22_0.05_259)]` → `bg-accent-deep`, 289줄 오버레이: `bg-[oklch(0.14_0.055_258/.82)]` → `bg-accent-deep/[0.82]`, 292줄 h2 `font-serif` 삭제. 301–304줄 버튼: `<HomeButton href={...}>` → `variant="white"`, ghost는 그대로 ghost.

- [ ] **Step 5: 파일 내 잔여 font-serif·oklch 정리**

ServiceFlow(169·187·192줄)·Faq(215줄)의 `font-serif` 삭제. 나머지 클래스는 토큰 기반이라 자동 정합.

- [ ] **Step 6: VisitBlock — 오시는 길에 실제 교회 사진 (PDF)**

`VisitBlock.tsx` 상단에 `import Image from 'next/image'` 추가, 48–50줄 placeholder 블록 교체:

```tsx
              <div className="relative h-52 overflow-hidden rounded-2xl border border-line shadow-subtle">
                <Image
                  src="/images/church-spire.webp"
                  alt="영천중앙교회 전경"
                  fill
                  unoptimized
                  sizes="(min-width: 960px) 45vw, 100vw"
                  className="object-cover object-[center_28%]"
                />
              </div>
```
`ImagePlaceholder` import가 이 파일에서 미사용이 되면 제거. 46줄 address의 `font-serif` 삭제.

- [ ] **Step 7: 검증 & 커밋**

```bash
npm run typecheck && npm test && npm run lint
git add src/app/newfamily src/components/layout/VisitBlock.tsx && git commit -m "feat: 처음 오셨나요 단색 히어로·주일학교 안내 개편·오시는 길 교회 사진 삽입"
```

---

### Task 11: 전체 검증 + 시각 확인

- [ ] **Step 1: 정적 검증 일괄**

```bash
npm run typecheck && npm test && npm run lint && npm run build
```
Expected: 모두 PASS. 실패 시 해당 태스크로 돌아가 수정.

- [ ] **Step 2: font-serif 전면 제거 + 구 토큰 잔존 스캔**

```bash
grep -rn "font-serif" c:/Users/servi/projects/ycc-website/src --include="*.tsx"
grep -rn "7391C7\|184_200_234\|240_238_227\|oklch" c:/Users/servi/projects/ycc-website/src --include="*.tsx"
```
- `font-serif`: sans 별칭이라 렌더는 동일하지만 죽은 코드 — **공개 페이지·컴포넌트에서 전부 클래스 삭제** (PostCard, AlbumCard, BulletinView, PastorKakaoCard, SermonSummary, not-found, error, sign-in, news/[id], gallery/[id], bulletins 등). 클래스 토큰만 지우고 다른 변경 금지. 커밋: `chore: 잔존 font-serif 클래스 정리(산세리프 단일화 마무리)`
- oklch: `admin/` 하위 외 공개 페이지에는 없어야 함.
- 시각 확인 추가 대상: `bg-surface` 위 `bg-paper` 카드 대비(FAQ·ServiceFlow·bulletins), 미수정 파일들(PostCard/AlbumCard/뉴스·갤러리 상세)의 새 팔레트 파급 결과, 데스크탑 메가패널 hover.

- [ ] **Step 3: dev 서버 시각 확인 (홈·서브 7종)**

```bash
npm run dev
```
브라우저에서 `/`, `/about/history`, `/about/greeting`, `/about/serving`, `/happiness`, `/worship`, `/sermons`, `/newfamily` 확인 — 시안 대비 색·타이포·간격. 헤더 투명→스크롤 solid, 모바일 드로어(순서: 소개/안내/말씀과 찬양/처음 오셨나요?/소식) 확인.

- [ ] **Step 4: 커밋 정리 확인**

푸시·PR은 사용자 확인 후 진행(무단 커밋·푸시 금지 원칙 — 각 태스크 커밋은 사용자가 이 계획을 승인한 범위 내).

---

## Self-Review 노트

- README 14개 체크리스트 매핑: 1→Task2, 2→Task6, 3→Task6, 4→대기(사진 제공 시 파일 교체만), 5→Task4, 6→Task2, 7→Task3, 8→확인완료, 9→확인완료, 10→Task8(스타일), 11→Task9, 12→확인완료, 13→Task10, 14→Task10.
- 시안 1a~1g 매핑: 1a→Task7, 1b→Task7, 1c→Task7, 1d→Task8, 1e→Task8, 1f→Task9(+Task3 히어로), 1g→Task10.
- 타입 일관성: `HeroTone = 'navy'|'royal'|'beige'` (Task3에서 정의, 사용처 전부 Task3 Step3에서 교체). `HomeButton variant = 'primary'|'outline'|'white'|'ghost'` (Task6 정의, 사용처 FullBleedBand·ImmersiveHero=Task6, newfamily Cta=Task10에서 함께 교체).
- 렌더 테스트: vitest env가 node(DOM 없음)이므로 스타일 변경은 typecheck+기존 테스트+빌드+시각 확인으로 검증.
