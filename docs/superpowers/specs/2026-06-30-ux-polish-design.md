# YCC 홈페이지 UX 완성도 보강 — 설계

작성일: 2026-06-30
범위: UX/완성도 polish (양방향 기능·콘텐츠 보강 제외 — 디모데 앱으로 운용 중)

## 배경

영천중앙교회 홈페이지(Next.js App Router)는 콘텐츠/아카이브 측면이 이미 성숙하다.
기본 위생(skip link, prefers-reduced-motion, 페이지별 메타데이터 18곳, sitemap/robots,
aria 다수)도 양호하다. 빠진 "마지막 한 겹"을 메우는 것이 목표다.

확정된 제약:
- **양방향 기능·행사 캘린더·생중계 추가하지 않음** (디모데 앱 운용 / 생중계 미운영).
- **Vercel Hobby tier** — `next/image`의 Image Transformations 쿼터를 소모하면 안 됨.

## 작업 항목

### 1. 로딩 / 에러 / 404 상태

현재 `loading.tsx` / `error.tsx` / `not-found.tsx`가 한 개도 없다.

- `app/not-found.tsx` — 브랜드 톤 404. 홈·주요 메뉴 복귀 링크. 상세 페이지에서
  `notFound()` 호출 시 자동 적용된다.
- `app/error.tsx` — 클라이언트 에러 바운더리. `reset()` 재시도 버튼 + 브랜드 톤.
- `app/global-error.tsx` — 루트 레이아웃 에러용 최소 폴백.
- `loading.tsx` — 데이터 의존 공개 라우트에 스켈레톤 추가:
  `/sermons`, `/sermons/[id]`, `/news`, `/news/[id]`, `/bulletins`, `/bulletins/[id]`,
  `/gallery`, `/gallery/[id]`.
  - 각 라우트 레이아웃 골격에 맞춘 공용 `Skeleton` 프리미티브 1개를 만들어 재사용한다.
- `/admin/*`는 내부용이라 이번 범위에서 제외(필요 시 후속).

### 2. SEO 구조화 데이터 (JSON-LD)

JSON-LD가 0건이다. 공용 `<JsonLd>` 컴포넌트(`<script type="application/ld+json">`,
`dangerouslySetInnerHTML`로 직렬화)를 만들어 주입한다.

- **전역(root layout)**: `Church` 스키마
  - name=영천중앙교회, url(canonical origin), logo, address(경북 영천시 완산중앙8길 21),
    telephone(054-334-6644), `sameAs`[YouTube, 네이버 블로그].
  - 데이터 출처: `src/lib/church.ts`의 `churchInfo` 재사용.
- **설교 상세(`/sermons/[id]`)**: `VideoObject`
  - name, description(AI 요약), thumbnailUrl, uploadDate(발행일), embedUrl(YouTube).
- **상세 페이지 공통**: `BreadcrumbList` — 설교·소식·주보 상세에 경로 노출.
- `Article` 스키마(소식/게시물)는 선택 — 여유가 있을 때만.

### 3. 이미지 — 트랜스포메이션 쿼터 제거

`next/image`가 **이미 최적화된** 소스를 재변환하며 쿼터를 낭비하는 구조다.
- 갤러리 업로드: `src/lib/actions/gallery.ts`에서 sharp로 1920px webp(q75) 변환 후 R2 저장.
- YouTube 썸네일 / Unsplash 히어로: CDN이 이미 사이즈 지정해서 제공.
- 로컬 정적: webp 15 + png 6.

**선택된 방식: `unoptimized` 플래그.**
- `next.config.ts`에 `images: { unoptimized: true }` 추가.
  → 모든 트랜스포메이션 즉시 0. 컴포넌트 API·lazy 로딩·width/height(CLS 방지) 유지.
- `placeholder="blur"` 이미지 사용처 없음 확인 → 회귀 없음.
- `remotePatterns`는 unoptimized에선 불필요하나 무해 → 유지(후속 정리 가능).
- png 6개 → webp 변환은 선택적 후속(unoptimized가 원본을 그대로 서빙하므로 필수 아님).

## 작업 성격 / 검증

- 세 항목 모두 **추가형(additive)** — 기존 동작 회귀 위험 낮음.
- 검증: `next build` 통과 + 기존 테스트(vitest) 통과. 라우트별 로딩/에러/404 수동 확인.
- 구조화 데이터: 빌드 산출 HTML에 JSON-LD 포함 여부 + 스키마 유효성 점검.

## 범위 밖 (Non-goals)

- 양방향 폼(새가족 등록·기도제목·문의), 행사 캘린더, 생중계 임베드.
- 통합 검색(설교 외).
- 관리자(`/admin/*`) 로딩/에러 상태.
- 자연사진 교체·갤러리 시드(별도 작업).
