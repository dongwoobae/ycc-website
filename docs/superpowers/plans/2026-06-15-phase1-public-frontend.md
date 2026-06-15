# Phase 1 — 공개 프론트(디자인) Implementation Plan

> **구현 주체:** Codex (실행자) / Claude (감독). 본 플랜은 Codex가 self-contained 맥락으로 사용.
> **실행 스킬 노트:** superpowers 서브에이전트 대신 **Codex 협업 프로토콜**(CLAUDE.md)로 진행.

**Goal:** Neon/Auth/R2 등 백엔드 없이, **seed 데이터**로 공개 사이트 전 페이지 UI를 "따뜻한 미니멀" 톤으로 완성하고 Vercel 프리뷰 배포 → 목사님 디자인 승인 게이트.

**Architecture:** Next.js 16 App Router + Tailwind v4. 모든 데이터는 `src/lib/seed/*` 타입드 모듈에서 공급(추후 Phase 2에서 DB 호출로 교체). 백엔드/업로드/인증 미구현. 디자인 토큰은 Tailwind theme + CSS 변수로 중앙화하여 목사님 피드백 시 색감/타이포만 바꿔 전체 반영.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Pretendard(본문 sans)+Gowun Batang/Nanum Myeongjo(제목 serif, Google Fonts), TypeScript.

**참고 필수:** `AGENTS.md` — Next.js 16은 breaking change 多. 코드 전 `node_modules/next/dist/docs/` 관련 가이드 확인. App Router 최신 규약 준수.

---

## 범위 (Phase 1)

포함: 홈 / 교회소개(4) / 예배·설교(목록+상세) / 주보(목록+상세) / 갤러리(앨범목록+상세) / 교회소식(목록+상세) + 공통 레이아웃 + 디자인시스템 + seed 데이터.

제외(Phase 2+): Neon 연결, Neon Auth, R2 업로드, 관리자 CRUD, hwp 파서, YouTube WebSub/Cron 동기화, AI 요약. 단, **관리자 라우트는 기존 스텁 유지**(동작 안 해도 됨).

## 디자인 토큰 (중앙화 — 목사님 피드백 시 여기만 수정)

`src/app/globals.css` + Tailwind v4 `@theme`에 정의:

- 배경: `--bg` 아이보리 `#FDFBF7`, `--surface` `#F4EEE4`
- 텍스트: `--ink` `#2E2820`, `--ink-muted` `#6B5E4F`
- 포인트(클레이/우드): `--accent` `#B4724E`, `--accent-deep` `#8F5636`
- 보더: `--line` `#E7DDCD`
- 폰트: 본문 `Pretendard`(sans), 제목 `Gowun Batang`(serif). 둘 다 한글 지원.
- 라운드/그림자: 부드럽게(여백 큼, 그림자 약하게), 고급 미니멀.

## 파일 구조

```
src/
  app/
    layout.tsx              # 폰트·메타·전역 셸 (수정)
    globals.css             # 디자인 토큰 (수정)
    page.tsx                # 홈 (재작성)
    about/
      page.tsx              # 교회소개 인사말 (수정)
      serving/page.tsx      # 섬기는 분들 (신규)
      history/page.tsx      # 교회연혁 (신규)
      visit/page.tsx        # 예배시간·오시는 길 (신규)
    sermons/page.tsx        # 설교 목록 + 종류필터 (재작성)
    sermons/[id]/page.tsx   # 설교 상세 (재작성)
    bulletins/page.tsx      # 주보 목록 (신규)
    bulletins/[id]/page.tsx # 주보 상세 (신규, noindex)
    gallery/page.tsx        # 앨범 목록 (신규)
    gallery/[id]/page.tsx   # 앨범 상세 (신규)
    news/page.tsx           # 공지 목록 (수정)
    news/[id]/page.tsx      # 공지 상세 (수정)
  components/
    layout/Header.tsx       # 드롭다운 네비 (수정)
    layout/Footer.tsx       # (수정)
    layout/Container.tsx    # 공통 폭/여백 (신규)
    ui/SectionTitle.tsx     # serif 섹션제목 (신규)
    sermons/SermonCard.tsx  # (수정)
    sermons/WorshipFilter.tsx # 종류 탭 (신규)
    sermons/YouTubeEmbed.tsx  # iframe 임베드 (신규)
    bulletins/BulletinView.tsx # 구조화 주보 디자인 렌더 (신규)
    gallery/AlbumCard.tsx   # (신규)
    posts/PostCard.tsx      # (수정)
  lib/
    seed/sermons.ts         # 설교 seed (재생목록별 샘플)
    seed/bulletins.ts       # 주보 seed (6/7 파싱데이터 구조화)
    seed/gallery.ts         # 앨범/사진 seed
    seed/posts.ts           # 공지 seed
    types.ts                # 공유 도메인 타입 (Sermon/Bulletin/Album/Post)
    worship.ts              # worshipType 상수·라벨 매핑
```

## 도메인 타입 (`src/lib/types.ts`)

seed와 추후 DB가 공유할 타입. drizzle 스키마(schema.ts)와 정합되게 정의.

- `WorshipType = '주일예배' | '주일찬양예배' | '수요예배' | '금요기도회'`
- `Sermon { id, title, preacher, scripture?, worshipType, sermonDate, videoUrl, youtubeId, thumbnailUrl?, summary?, isPublished }`
- `BulletinSection` 들(예배순서 row[], 청지기표, 헌금명단, 새벽기도표 등) + `Bulletin { id, bulletinDate, volume, issue, theme, scripture, sections, ... }`
- `GalleryAlbum { id, title, description?, coverImgUrl, eventDate, images: GalleryImage[] }`
- `Post { id, title, content, category, isPinned, publishedAt }`

## 작업 순서 (Codex가 따를 단위)

각 작업 후 `npm run build` + `npm run lint` 통과 확인, 의미단위 커밋.

1. **디자인 토큰 + 폰트 + 레이아웃 셸** — globals.css 토큰, layout.tsx 폰트(Pretendard/Gowun Batang), Container/SectionTitle, Header(드롭다운: 교회소개·교회소식)/Footer. 빈 페이지라도 톤 확인.
2. **공유 타입 + worship 상수** — types.ts, worship.ts.
3. **seed 데이터** — sermons(재생목록별 샘플 6~8개, 실제 youtubeId 형식), bulletins(6/7 주보 파싱데이터를 sections 구조로), gallery(앨범 2~3개+placeholder 이미지), posts(공지 4~5개).
4. **홈** — 히어로, 최근 설교 3, 최신 주보 1, 공지 3, 예배시간 요약. (큰 사진형 1안)
5. **교회소개 4페이지** — 인사말, 섬기는 분들(주보의 섬기는 분들 데이터 활용), 교회연혁(2000~ 연표), 예배시간·오시는 길(지도 임베드 placeholder. 카카오맵).
6. **예배·설교** — 목록(WorshipFilter 탭: 전체/주일/주일찬양/수요), 상세(YouTubeEmbed + summary 자리 + 본문/설교자/날짜).
7. **주보** — 목록(주차별 카드), 상세(BulletinView 디자인 렌더). 상세 페이지 `robots: { index: false }` 메타.
8. **갤러리** — 앨범 목록 그리드, 앨범 상세 사진 그리드(lightbox는 선택).
9. **교회소식** — 공지 목록(pin 우선), 상세.
10. **반응형·폴리시 + 배포 확인** — 모바일 점검, 메타/OG, `npm run build` 클린, Vercel 프리뷰 배포.

## 검증 (Phase 1은 시각 중심)

- 단위 테스트는 최소(렌더 스모크 정도, 선택). **1차 게이트 = `npm run build` 무에러 + `npm run lint` 클린 + Vercel 프리뷰에서 전 페이지 육안 확인**.
- 모바일/데스크탑 반응형 확인. 주보 상세 noindex 메타 실제 출력 확인(`<meta name="robots" content="noindex">`).
- 깨진 링크/이미지 없음.

## 주의/컨벤션

- Next.js 16 규약 우선(AGENTS.md). Server Components 기본, 필요한 곳만 client.
- 디자인 변경은 토큰만 고쳐 전체 반영되도록 하드코딩 색/폰트 금지.
- seed 모듈 인터페이스 = 추후 DB 함수 시그니처와 맞춰 Phase 2 교체 쉽게(예: `getSermons(): Promise<Sermon[]>` 형태로 async).
- Supabase 잔재(`supabase/` , admin TODO 주석) 이번엔 건드리지 않음(Phase 2에서 정리).

## 개정 (Codex 비판 반영)

1. **작업 0 (선행 게이트) 추가** — 코딩 전 `node_modules/next/dist/docs/`에서 Next 16 규약 확인: 동적 라우트 `params`는 **Promise**(`await params`), `generateMetadata`/`export const metadata`, `robots` 메타 방식. 확인 결과를 `$env:TEMP\CODEX_REPORT.md`에 메모 후 진행.
2. **Tailwind v4 토큰 강제** — `@theme inline`으로 토큰 정의해 `bg-bg`/`text-ink`/`text-accent` 등 유틸 생성. **raw `gray-*`/hex 색 금지**. 작업 10에서 `grep -rE "#[0-9a-fA-F]{3,6}|gray-[0-9]" src/` 로 잔존 하드코딩 0 확인.
3. **폰트 로딩 확정** — 제목 `Gowun Batang`은 `next/font/google` 사용. 본문 `Pretendard`는 Google Fonts 미제공 → **`globals.css`에서 CDN `@import`**(`https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css`) + `--font-sans`에 `Pretendard` 우선, 시스템 sans 폴백. (Phase 2에서 next/font/local 최적화 검토.)
4. **타입↔schema 정합** — `src/lib/types.ts`는 `src/lib/db/schema.ts` 필드명 따름: `Sermon.videoUrl`(유튜브 URL) 유지하고 `youtubeId`는 URL에서 파생(별도 컬럼 아님). Phase1 `Post.category`는 `공지|소식|행사`만 사용(주보는 별도 `Bulletin` 타입 — schema의 posts '주보' check는 Phase2에서 제거). seed 함수 시그니처는 Phase2 DB 함수와 동일하게.
5. **라우팅 정리** — 기존 `/contact`는 `/about/visit`로 **301 리다이렉트**(`next.config.ts` redirects 또는 route). 네비/내부링크는 `/about/visit`로 통일. about 하위 4라우트 존재 보장.
6. **seed = 실데이터 (사용자 결정)** — 6/7 주보 hwp 파싱 그대로 실명·실계좌 사용(블로그에 이미 공개 중이라 수용). 주보 상세는 noindex 유지. 단, 공개 프리뷰 평문노출 줄이려 **Vercel 프리뷰 비밀번호 보호 켜기 권장**(강제 아님).
7. **검증 보강** — 작업 10에 링크/이미지 깨짐 점검 + 프리뷰 전 페이지 200 확인. build+lint는 유지하되 커밋은 작업단위(과도한 분할 X).

## Self-Review (spec 대비)

- 스펙 4장 사이트맵 → 작업 4~9 전 페이지 커버 ✓
- 스펙 5.2 주보 디자인 렌더 + noindex → 작업 7 ✓ (파싱/업로드는 Phase 2)
- 스펙 5.1 설교 임베드/필터 → 작업 6 ✓ (동기화는 Phase 2)
- 스펙 7 디자인 토큰 중앙화 → 작업 1 ✓
- 스펙 5.6 AI요약 → summary "자리"만(작업 6), 생성 Phase 2 ✓
- 백엔드(Auth/R2/DB/Cron/파서)는 의도적으로 Phase 2 — 본 플랜 범위 밖 ✓
