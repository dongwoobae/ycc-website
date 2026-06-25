# 홈페이지 수정 Phase 1 — 상단 네비 + 블루 바 + PCK 휘장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크탑 좌측 사이드바 네비게이션을 상단 우측 가로 메뉴(솔리드 브랜드 블루 바)로 환원하고, 로고를 PCK 공식 휘장(흰 배지+컬러)으로 교체한다.

**Architecture:** 기존에 `Header`(상단 가로바)는 모바일 전용으로만 렌더되고 데스크탑은 `Sidebar`가 차지했다. 이를 뒤집어 `Header`를 전 브레이크포인트에서 사용하고 `Sidebar` 마운트를 제거한다. `BrandLogo`는 자체 SVG 마크 대신 PCK 휘장 이미지를 흰 라운드 배지에 담아 렌더한다. 색은 `Header`의 solid 상태 클래스를 연한 흰색(`bg-bg/85`)에서 브랜드 딥블루(`accent-deep`)+흰 텍스트로 바꾼다.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, `next/image`.

**검증 방식:** 이 Phase는 시각/마크업 변경이 대부분이고 프로젝트 테스트 환경(`vitest` node)에 DOM 테스트가 없다. 따라서 각 Task는 `npm run lint` + `npm run build`(타입체크 포함) + 명시된 수동 시각 확인을 검증 게이트로 사용한다.

**메뉴 항목 주의:** 이 Phase는 네비 "위치·스타일·로고"만 다룬다. 5개 메뉴 IA(소개/안내/말씀과찬양/처음오셨나요?/소식) 재구성은 Phase 3에서 한다. 따라서 여기서는 `Header.tsx`의 기존 `navLinks`(교회소개/예배·설교/주보/교회소식)를 그대로 둔다.

---

## File Structure

- `public/brand/pck-emblem.png` — **생성**. PCK 공식 컬러 휘장(투명 배경). 출처: `C:\Users\servi\Downloads\PCK_Logo\PCK_Logo(컬러-투명).png`
- `src/components/layout/BrandLogo.tsx` — **수정**. PCK 휘장 + 흰 배지 + 워드마크(`YEONGCHEONJOONGANG`)
- `src/components/layout/Header.tsx` — **수정**. solid 상태 색을 브랜드 블루로
- `src/app/layout.tsx` — **수정**. `Sidebar` 마운트 제거, `Header`를 전 브레이크포인트 렌더
- `src/app/globals.css` — **수정**. `body` 좌측 레일 패딩 제거, `.ycc-side` 관련 죽은 스타일 정리, admin 게이팅에서 `.ycc-side` 참조 제거
- `src/components/layout/Sidebar.tsx` — **삭제**(Task 5)

---

### Task 1: PCK 휘장 자산 추가

**Files:**
- Create: `public/brand/pck-emblem.png`

- [ ] **Step 1: 컬러 투명 휘장을 public/brand로 복사**

Git Bash에서 실행:

```bash
cd /c/Users/servi/projects/ycc-website
cp "/c/Users/servi/Downloads/PCK_Logo/PCK_Logo(컬러-투명).png" public/brand/pck-emblem.png
```

- [ ] **Step 2: 복사 확인**

Run: `ls -l public/brand/pck-emblem.png`
Expected: 약 25KB 파일이 존재.

- [ ] **Step 3: 커밋**

```bash
git add public/brand/pck-emblem.png
git commit -m "chore: PCK 공식 휘장(컬러 투명) 자산 추가" --no-gpg-sign
```

---

### Task 2: BrandLogo를 PCK 휘장 + 흰 배지 + 새 워드마크로 교체

**Files:**
- Modify: `src/components/layout/BrandLogo.tsx`

`header` variant를 "흰 라운드 배지 안에 컬러 휘장(next/image) + 워드마크 텍스트"로 바꾼다. 워드마크 텍스트 색은 부모(헤더)의 `currentColor`를 따르도록 명시 색을 빼서, 블루 바에서 흰색으로 나오게 한다. 영문은 `YEONGCHEONJOONGANG`.

- [ ] **Step 1: BrandLogo.tsx 전체 교체**

`src/components/layout/BrandLogo.tsx`를 아래로 교체:

```tsx
import Image from 'next/image'

type BrandLogoProps = {
  variant?: 'header' | 'sidebar'
}

/** PCK 공식 휘장을 흰 라운드 배지에 담아 렌더 (다크 블루 바에서도 또렷하게 분리) */
function EmblemBadge({ size = 44 }: { size?: number }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-2xl bg-white shadow-[0_6px_16px_rgb(30_42_69_/_0.18)]"
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/pck-emblem.png"
        alt="대한예수교장로회 총회 휘장"
        width={size}
        height={size}
        className="h-[78%] w-[78%] object-contain"
        priority
      />
    </span>
  )
}

export default function BrandLogo({ variant = 'header' }: BrandLogoProps) {
  if (variant === 'sidebar') {
    return (
      <>
        <span className="ycc-mark">
          <EmblemBadge size={36} />
        </span>
        <span className="ycc-wordmark">
          <b>영천중앙교회</b>
          <small>YEONGCHEONJOONGANG</small>
        </span>
      </>
    )
  }

  return (
    <span className="inline-flex items-center gap-3 leading-none">
      <EmblemBadge size={44} />
      <span className="flex flex-col">
        <span className="font-serif text-[21px] font-extrabold tracking-tight">영천중앙교회</span>
        <span className="mt-1 text-[10px] font-extrabold tracking-[0.18em] opacity-80">YEONGCHEONJOONGANG</span>
      </span>
    </span>
  )
}
```

참고: 기존 `LogoMark` export는 제거된다. 다른 곳에서 `LogoMark`를 import하지 않는지 Step 2에서 확인한다.

- [ ] **Step 2: LogoMark 잔여 참조 확인**

Run: `grep -rn "LogoMark" src`
Expected: `BrandLogo.tsx` 외에 결과가 없어야 한다. (있으면 해당 import 제거 또는 `BrandLogo` 사용으로 교체)

- [ ] **Step 3: 타입체크/빌드**

Run: `npm run lint && npm run build`
Expected: 에러 없이 통과. (`next/image` 사용, `priority` prop 정상)

- [ ] **Step 4: 수동 시각 확인**

Run: `npm run dev` 후 브라우저에서 모바일 폭(<960px)으로 홈(`/`) 확인.
Expected: 헤더 좌측에 흰 배지 안 PCK 컬러 휘장 + "영천중앙교회 / YEONGCHEONJOONGANG" 워드마크가 보인다.

- [ ] **Step 5: 커밋**

```bash
git add src/components/layout/BrandLogo.tsx
git commit -m "feat: 로고를 PCK 공식 휘장(흰 배지+컬러)·YEONGCHEONJOONGANG 워드마크로 교체" --no-gpg-sign
```

---

### Task 3: Header solid 바를 브랜드 딥블루 + 흰 텍스트로

**Files:**
- Modify: `src/components/layout/Header.tsx:93,98-102`

현재 solid 상태는 `border-line bg-bg/85 text-ink ...`(연한 흰색)이다. 이를 딥블루 + 흰 텍스트로 바꾸고, nav 링크/활성/CTA 색을 블루 배경에 맞춰 조정한다. 투명-오버-히어로(immersive 미스크롤) 동작은 유지한다.

- [ ] **Step 1: headerClassName의 solid 분기 교체**

`src/components/layout/Header.tsx`에서 `headerClassName` useMemo 내부의 삼항을 아래로 수정:

```tsx
  const headerClassName = useMemo(
    () =>
      [
        isImmersive ? 'fixed' : 'sticky',
        'left-0 right-0 top-0 z-50 border-b transition-[background-color,border-color,color] duration-300',
        isSolid
          ? 'border-accent-deep bg-accent-deep text-white shadow-subtle'
          : 'border-transparent bg-transparent text-white',
      ].join(' '),
    [isImmersive, isSolid],
  )
```

- [ ] **Step 2: nav 링크 색을 블루 바 기준으로 통일**

같은 파일에서 아래 세 줄을 수정. solid 여부와 무관하게 바탕이 어둡(블루/투명)으로 텍스트는 항상 흰색 계열:

```tsx
  const navLinkClassName = 'text-white/85 hover:bg-white/10 hover:text-white'

  const activeNavClassName = 'bg-white/15 text-white'
```

(기존 `isSolid ? ... : ...` 삼항을 위 고정값으로 교체)

- [ ] **Step 3: 드롭다운 패널은 밝은 카드 유지 확인**

드롭다운 내부 패널(`bg-paper/95 ... text-ink` 등, 약 142-158라인)은 밝은 배경이므로 변경하지 않는다. 코드 확인만 하고 그대로 둔다.

- [ ] **Step 4: 모바일 버거 버튼 색 정리**

버거 버튼 클래스(약 175-177라인)의 `isSolid ? 'border-line text-ink hover:bg-surface' : 'border-white/40 text-white hover:bg-white/10'`를 아래 고정값으로 교체(바탕이 항상 어두우므로):

```tsx
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/40 text-white transition hover:bg-white/10 min-[960px]:hidden`}
```

- [ ] **Step 5: 모바일 오버레이 메뉴 배경 확인**

모바일 펼침 메뉴(`#mobile-navigation`, 약 201-202라인)는 `bg-bg`(밝음) + `text-ink`라 그대로 두면 가독성 OK. 변경하지 않는다. 코드만 확인.

- [ ] **Step 6: 타입체크/빌드**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 7: 수동 시각 확인**

`npm run dev` 후:
- 비-immersive 페이지(예: `/sermons`): 상단 바가 **딥블루 + 흰 메뉴**로 보인다.
- 홈(`/`): 최상단에선 투명(히어로 위), 스크롤하면 딥블루 바로 전환.
- 드롭다운(교회소개) 열면 밝은 카드 + 잉크 텍스트로 가독성 유지.

- [ ] **Step 8: 커밋**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: 헤더 솔리드 바를 브랜드 딥블루+흰 메뉴로 변경" --no-gpg-sign
```

---

### Task 4: 레이아웃을 사이드바→상단 헤더(전 브레이크포인트)로 전환

**Files:**
- Modify: `src/app/layout.tsx:101-105`
- Modify: `src/app/globals.css:175-211`(레일 패딩/`.ycc-side` 표시), `:184-188`(admin 게이팅)

데스크탑에서도 `Header`가 보이게 하고 `Sidebar` 마운트를 제거한다. `body`의 좌측 레일 패딩과 `.ycc-side` 표시 규칙을 제거해 본문이 전체폭을 쓰게 한다.

- [ ] **Step 1: layout.tsx에서 Header 노출 + Sidebar 제거**

`src/app/layout.tsx`의 아래 블록:

```tsx
        {/* 데스크톱(≥960px)에서는 사이드바가 헤더를 대체, 모바일은 기존 헤더(버거) 유지 */}
        <div className="site-chrome contents min-[960px]:hidden">
          <Header />
        </div>
        <Sidebar />
```

을 아래로 교체:

```tsx
        <div className="site-chrome contents">
          <Header />
        </div>
```

그리고 파일 상단의 `import Sidebar from '@/components/layout/Sidebar'` 줄을 제거한다.

- [ ] **Step 2: globals.css에서 body 좌측 레일 패딩 제거**

`src/app/globals.css`의 `@media (min-width: 960px)` 블록 안 아래 규칙을 삭제:

```css
  /* 본문을 레일 폭만큼 밀어 사이드바와 겹치지 않게 (히어로는 100vh 유지, 폭만 줄어듦) */
  body {
    padding-left: var(--ycc-rail);
  }
```

- [ ] **Step 3: admin 게이팅에서 .ycc-side 참조 정리**

`src/app/globals.css`의 admin 게이팅 블록을 아래에서:

```css
body:has(.admin-shell) > .site-chrome,
body:has(.admin-shell) > .ycc-side,
body:has(.admin-shell) > footer {
  display: none;
}
```

아래로 수정(`.ycc-side` 줄 제거):

```css
body:has(.admin-shell) > .site-chrome,
body:has(.admin-shell) > footer {
  display: none;
}
```

`body:has(.admin-shell) { padding-left: 0; }`는 더 이상 필요 없지만 무해하므로 둔다.

- [ ] **Step 4: 타입체크/빌드**

Run: `npm run lint && npm run build`
Expected: 통과. (Sidebar import 제거 후 미사용 경고 없어야 함)

- [ ] **Step 5: 수동 시각 확인 (핵심 게이트)**

`npm run dev` 후:
- 데스크탑(≥960px) 홈/내부 페이지: **좌측 사이드바 없이** 상단 딥블루 가로 메뉴(로고 좌·메뉴 우)만 보인다. 본문이 좌측 레일 여백 없이 전체폭을 쓴다.
- 모바일: 상단 바 + 우상단 버거 정상.
- `/admin`: 공개 헤더/푸터가 안 보이고 admin 자체 레이아웃 정상(레일 잔여 여백 없음).

- [ ] **Step 6: 커밋**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: 데스크탑 네비를 좌측 사이드바에서 상단 헤더로 전환" --no-gpg-sign
```

---

### Task 5: 죽은 사이드바 코드/스타일 정리

**Files:**
- Delete: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/globals.css` (`.ycc-side`/`.ycc-panel`/`.ycc-nav` 등 사이드바 전용 규칙 제거)

Task 4 이후 `Sidebar`는 어디서도 렌더되지 않는다. 죽은 컴포넌트와 CSS를 제거한다.

- [ ] **Step 1: Sidebar 잔여 참조 확인**

Run: `grep -rn "Sidebar\|ycc-side\|ycc-panel" src --include=*.tsx`
Expected: `Sidebar.tsx` 자신 외 참조 없음. (있으면 먼저 정리)

- [ ] **Step 2: Sidebar.tsx 삭제**

```bash
git rm src/components/layout/Sidebar.tsx
```

- [ ] **Step 3: globals.css 사이드바 전용 규칙 제거**

`src/app/globals.css`에서 사이드바 전용 셀렉터 블록을 제거한다. 대상: `.ycc-side`, `.ycc-panel`, `.ycc-panel::before`, `.ycc-logo`, `.ycc-mark`, `.ycc-wordmark`, `.ycc-toggle`, `.ycc-nav`, `.ycc-item`, `.ycc-link`, `.ycc-ico`, `.ycc-txt`, `.ycc-chev`, `.ycc-sub*`, `.ycc-cta`, `.ycc-subtxt` 및 `:root`의 `--ycc-rail`/`--ycc-open`/`--ycc-ease`/`--ycc-accent` 변수. (BrandLogo의 `sidebar` variant는 Task 2에서 `ycc-mark`/`ycc-wordmark` 클래스를 쓰지만 더 이상 렌더되지 않으므로 함께 정리 대상)

> 셀렉터 범위가 크므로, 제거 전후로 `grep -c "ycc-" src/app/globals.css`로 잔여 수를 확인하고, 남는 것이 admin/기타 비-사이드바 용도인지 점검한다. 사이드바 전용만 제거하고 확실치 않은 셀렉터는 남긴다.

- [ ] **Step 4: BrandLogo sidebar variant 단순화(선택)**

`sidebar` variant가 더 이상 쓰이지 않으면 `BrandLogo.tsx`에서 해당 분기를 제거하고 `header` 형태만 남긴다. (호출부 없음을 Step 1 grep로 확인했을 때만)

- [ ] **Step 5: 타입체크/빌드**

Run: `npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 6: 수동 시각 확인**

`npm run dev` 후 데스크탑/모바일 홈·내부 페이지·`/admin`이 Task 4와 동일하게 정상인지 재확인(스타일 회귀 없음).

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore: 미사용 사이드바 컴포넌트·CSS 제거" --no-gpg-sign
```

---

## Self-Review

**Spec 커버리지 (Phase 1 범위):**
- 네비 좌측→상단 우측: Task 4 (layout) + 기존 Header 우측정렬 nav ✓
- 솔리드 블루 바(결정 A): Task 3 ✓
- PCK 휘장(흰 배지+컬러, 결정 C): Task 1·2 ✓
- 워드마크 `YEONGCHEONJOONGANG`: Task 2 ✓
- 모바일 우상단 버거 유지: Task 3 Step 4·Task 4 Step 5 확인 ✓
- (범위 외) 5메뉴 IA·홈 4스크린·푸터·OG → Phase 2~4

**플레이스홀더 스캔:** 없음. 모든 코드 변경 단계에 실제 코드/명령 포함.

**타입 일관성:** `BrandLogo`는 `EmblemBadge` 내부 헬퍼만 추가, export 시그니처 동일. `Header`는 클래스 문자열만 변경(시그니처 무변). `LogoMark` 제거에 따른 외부 참조는 Task 2 Step 2에서 grep로 차단.

**의존성:** Task 1의 소스 파일 경로(`Downloads/PCK_Logo/...`)가 실재함을 사전 확인함.
