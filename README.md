# 영천중앙교회 홈페이지

> 영천중앙교회 공식 홈페이지 및 교회 콘텐츠 운영자 관리 시스템

[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F)](https://orm.drizzle.team/)
[![Neon](https://img.shields.io/badge/Neon-Postgres-00E599?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare_R2-Storage-F38020?logo=cloudflare&logoColor=white)](https://www.cloudflare.com/developer-platform/r2/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-black?logo=vercel)](https://vercel.com/)

---

## 📖 프로젝트 소개

영천중앙교회의 예배, 설교, 주보, 소식, 갤러리, 새가족 안내를 한곳에서 제공하는 공식 웹사이트입니다.

교회를 처음 방문하는 성도와 지역 주민이 예배 시간, 오시는 길, 새가족 안내, 교회 사역 정보를 쉽게 확인할 수 있도록 공개 페이지를 구성했고, 운영자는 `/admin`에서 소식 게시글, 주보, 갤러리 앨범을 직접 관리할 수 있습니다.

주보는 HWP 업로드와 구조화된 편집 UI를 함께 제공하여, 단순 파일 게시를 넘어 주보 내용을 웹에서 읽기 좋은 형태로 관리할 수 있도록 설계했습니다.

---

## ✨ 주요 기능

### 공개 페이지

- 🏠 **홈** — 몰입형 Hero, 교회 비전, 예배 시간, 갤러리, 최신 설교, 방문 안내
- ⛪ **교회 소개** — 교회 소개, 섬기는 사람들, 교회 연혁
- 🙋 **새가족 안내** — 처음 방문하는 성도를 위한 등록/정착 안내
- 📍 **오시는 길** — 주소, 대표 전화, 카카오맵 기반 위치 안내
- 🎧 **설교** — 예배 유형별 설교 목록, YouTube 영상 임베드, 상세 페이지
- 📰 **교회 소식** — 공지, 소식, 행사 게시글 목록/상세
- 📖 **주보** — 주보 목록/상세, 날짜별 발행본 조회
- 🖼️ **갤러리** — 교회 행사와 공동체 사진 앨범 목록/상세
- 🔎 **SEO 기본 구성** — sitemap, robots, metadata, OG 정보
- ♿ **접근성 보조** — 본문 바로가기 링크, 의미 있는 레이아웃 구조

### 관리자 페이지 (`/admin`)

Better Auth 이메일/비밀번호 로그인으로 보호되며, 공개 회원가입은 비활성화되어 있습니다.

- 🔒 **관리자 로그인** — `/sign-in`에서 로그인, 세션 기반 관리자 접근
- 📝 **게시글 관리** — 공지/소식/행사 작성, 수정, 발행 여부, 고정 여부 관리
- 📖 **주보 관리** — 날짜, 권/호, 주제, 본문, 섹션 JSON 기반 편집
- 📄 **주보 HWP 업로드** — HWP 파일 파싱 후 주보 편집 UI에 반영
- 🧩 **주보 섹션 편집** — 텍스트, 행 목록, 표, 헌금자 명단 등 구조화 편집
- 🖼️ **갤러리 관리** — 앨범 생성/수정, 커버 이미지, 이미지 업로드/삭제
- ☁️ **R2 파일 업로드** — 갤러리 이미지와 주보 업로드 파일을 Cloudflare R2에 저장
- 🧯 **운영 로그** — 주요 관리자 작업과 서버 로그 확인
- 👤 **관리자 계정 스크립트** — CLI로 관리자 생성/삭제

### 보안·운영 기능

- 🛑 **공개 회원가입 차단** — Better Auth `disableSignUp: true`
- 🌐 **Trusted Origin 정규화** — `BETTER_AUTH_URL`, `VERCEL_URL`, production URL 기반 origin 구성
- 🗂️ **R2 key prefix 제한** — `gallery/`, `bulletins/` 범위만 삭제 key로 인정
- 🧪 **업로드 MIME 검증** — 허용된 파일 타입만 업로드 처리
- 🧹 **파일명 정규화** — 업로드 filename을 안전한 R2 key로 변환
- 📊 **Vercel Analytics** — 공개 사이트 방문 분석 적용
- 🧭 **동적 sitemap** — 정적 라우트와 DB 콘텐츠를 함께 sitemap에 반영

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19 |
| Styling | Tailwind CSS v4, CSS variables |
| Font | Pretendard, Nanum Myeongjo |
| Auth | Better Auth, nextCookies plugin |
| Database | Neon Postgres |
| ORM | Drizzle ORM, Drizzle Kit |
| Storage | Cloudflare R2, AWS S3 SDK |
| HWP Parsing | cfb 기반 HWP 파싱 유틸 |
| Analytics | Vercel Analytics |
| Test | Vitest |
| Lint | ESLint 9, eslint-config-next |
| Deploy | Vercel |

---

## 📁 프로젝트 구조

```text
src/
  app/
    page.tsx                         # 메인 홈
    layout.tsx                       # 전역 레이아웃, 폰트, Header/Footer, Analytics
    sitemap.ts                       # Next.js sitemap route
    robots.ts                        # robots.txt route
    sign-in/page.tsx                 # 관리자 로그인
    about/
      page.tsx                       # 교회 소개
      serving/page.tsx               # 섬기는 사람들
      history/page.tsx               # 교회 연혁
      visit/page.tsx                 # 오시는 길
    newfamily/page.tsx               # 새가족 안내
    sermons/
      page.tsx                       # 설교 목록
      [id]/page.tsx                  # 설교 상세
    news/
      page.tsx                       # 교회 소식 목록
      [id]/page.tsx                  # 교회 소식 상세
    bulletins/
      page.tsx                       # 주보 목록
      [id]/page.tsx                  # 주보 상세
    gallery/
      page.tsx                       # 갤러리 앨범 목록
      [id]/page.tsx                  # 갤러리 앨범 상세
    admin/
      layout.tsx                     # 관리자 레이아웃
      page.tsx                       # 대시보드
      posts/                         # 게시글 목록/작성/수정
      bulletins/                     # 주보 목록/작성/수정
      gallery/                       # 갤러리 목록/작성/수정
      sermons/page.tsx               # 설교 관리 진입점
      log/page.tsx                   # 운영 로그
    api/auth/[...all]/route.ts       # Better Auth route handler
  components/
    layout/                          # Header, Footer, PageHero, KakaoMap, VisitBlock
    home/                            # ImmersiveHero, WorshipTimes, RecentSermons 등 홈 섹션
    sermons/                         # SermonCard, SermonsGrid, YouTubeEmbed, WorshipFilter
    bulletins/                       # BulletinView
    gallery/                         # AlbumCard
    posts/                           # PostCard
    admin/                           # PostForm, BulletinForm, AlbumForm, 이미지/주보 편집 컴포넌트
    ui/                              # Reveal, SectionTitle
  lib/
    auth.ts                          # Better Auth 설정
    auth-client.ts                   # 클라이언트 auth helper
    dal.ts                           # 세션 검증/서버 데이터 접근 레이어
    db/                              # Drizzle DB 클라이언트와 스키마
    data/                            # 공개 페이지 데이터 조회
    actions/                         # 관리자 Server Actions
    hwp/parse.ts                     # HWP 파싱 유틸
    r2.ts                            # Cloudflare R2 업로드/삭제/key 처리
    upload-sniff.ts                  # 업로드 MIME 검증
    bulletin-editor.ts               # 주보 편집 데이터 유틸
    sitemap.ts                       # sitemap 데이터 생성 유틸
    church.ts                        # 교회 기본 정보
scripts/
  seed.ts                            # 개발/초기 데이터 시드
  reset-db.ts                        # 개발 DB 초기화
  create-admin.ts                    # 관리자 계정 생성
  delete-user.ts                     # 사용자 계정 삭제
drizzle/                             # Drizzle 마이그레이션과 메타데이터
public/                              # 정적 이미지, map.html, 교회 이미지 자산
```

---

## 🗄️ DB 스키마 (Drizzle / Neon Postgres)

```sql
-- 운영자 프로필
profiles
  id          uuid primary key
  full_name   text
  role        text default 'staff'
  created_at  timestamptz default now()

-- 설교 시리즈
sermon_series
  id             uuid primary key default gen_random_uuid()
  title          text not null
  description    text
  cover_img_url  text
  started_at     date
  ended_at       date
  created_at     timestamptz default now()

-- 설교
sermons
  id             uuid primary key default gen_random_uuid()
  title          text not null
  preacher       text not null
  scripture      text
  series_id      uuid references sermon_series(id) on delete set null
  worship_type   text default '주일예배'
  sermon_date    date not null
  video_url      text
  audio_url      text
  notes_url      text
  thumbnail_url  text
  summary        text
  is_published   boolean default false
  created_by     uuid references profiles(id) on delete set null
  created_at     timestamptz default now()

-- 교회 소식
posts
  id             uuid primary key default gen_random_uuid()
  title          text not null
  content        text
  category       text default '공지' -- '공지' | '소식' | '행사'
  thumbnail_url  text
  attachment_url text
  is_pinned      boolean default false
  is_published   boolean default false
  published_at   timestamptz
  created_by     uuid references profiles(id) on delete set null
  created_at     timestamptz default now()
  updated_at     timestamptz default now()

-- 주보
bulletins
  id             uuid primary key default gen_random_uuid()
  bulletin_date  date not null
  volume         text
  issue          text
  theme          text
  scripture      text
  sections       jsonb default '[]'::jsonb
  is_published   boolean default false
  created_by     uuid references profiles(id) on delete set null
  created_at     timestamptz default now()
  updated_at     timestamptz default now()

-- 갤러리 앨범
gallery_albums
  id             uuid primary key default gen_random_uuid()
  title          text not null
  description    text
  cover_img_url  text
  event_date     date
  is_published   boolean default false
  created_at     timestamptz default now()

-- 갤러리 이미지
gallery_images
  id          uuid primary key default gen_random_uuid()
  album_id    uuid references gallery_albums(id) on delete cascade
  image_url   text not null
  caption     text
  alt         text
  sort_order  integer default 0
  created_at  timestamptz default now()

-- 운영 로그
app_logs
  id           uuid primary key default gen_random_uuid()
  action       text not null
  entity_type  text not null
  entity_id    uuid
  message      text
  created_by   uuid references profiles(id) on delete set null
  created_at   timestamptz default now()
```

Better Auth의 `user`, `session`, `account`, `verification` 테이블은 `src/lib/db/auth-schema.ts`에서 관리하고, `src/lib/db/schema.ts`에서 재노출해 Drizzle 스키마에 포함합니다.

---

## ⚙️ 환경변수 설정

루트에 `.env.local` 파일을 생성하고 `.env.example`을 기준으로 값을 입력합니다.

```env
# Neon Postgres
DATABASE_URL=postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Better Auth
BETTER_AUTH_SECRET=your_strong_random_secret
BETTER_AUTH_URL=http://localhost:3000

# Vercel preview/production hostnames
VERCEL_URL=ycc-website.vercel.app
VERCEL_PROJECT_PRODUCTION_URL=ycc-website.vercel.app
```

---

## 🚀 로컬 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속합니다.

```bash
# ESLint 검사
npm run lint

# Vitest 테스트
npm run test

# 프로덕션 빌드
npm run build
```

---

## 🗃️ 데이터베이스 작업

```bash
# 마이그레이션 생성
npm run db:generate

# 마이그레이션 검증
npm run db:check

# 마이그레이션 적용
npm run db:migrate

# 스키마를 DB에 직접 반영
npm run db:push

# Drizzle Studio 실행
npm run db:studio
```

개발 DB를 다시 만들고 시드 데이터를 넣을 때는 다음 명령을 사용합니다.

```bash
npm run db:reset
npm run db:seed
```

---

## 🔐 관리자 계정

공개 회원가입은 비활성화되어 있으므로 관리자 계정은 스크립트로 생성합니다.

```bash
npm run create-admin -- admin@example.com password123 "관리자"
```

계정 삭제:

```bash
npm run delete-user -- admin@example.com
```

관리자 화면은 `/admin`, 로그인 화면은 `/sign-in`입니다.

---

## 🧪 테스트 범위

현재 Vitest 테스트는 업로드, 인증 origin, sitemap, 주보 편집, HWP 파싱처럼 운영 영향이 큰 유틸 중심으로 구성되어 있습니다.

| 테스트 | 검증 대상 |
|---|---|
| `upload-sniff.test.ts` | 허용 업로드 MIME/파일 시그니처 검증 |
| `r2.test.ts` | R2 파일명 정규화, key 추출, prefix 제한 |
| `auth-origin.test.ts` | Better Auth origin 정규화 |
| `sitemap.test.ts` | sitemap URL 생성 로직 |
| `bulletin-editor.test.ts` | 주보 편집 데이터 변환/보정 |
| `hwp/parse.test.ts` | HWP 파싱 유틸 |
| `worship.test.ts` | 예배 유형/필터 관련 유틸 |

---

## 📦 Cloudflare R2 / 업로드 정책

업로드 파일은 Cloudflare R2에 저장되며, 공개 URL은 `R2_PUBLIC_URL`을 base로 생성됩니다.

허용 key prefix는 다음 두 범위입니다.

- `gallery/`: 갤러리 이미지
- `bulletins/`: 주보 HWP 및 관련 업로드

업로드 처리 흐름:

1. 관리자 화면에서 파일을 선택합니다.
2. `upload-sniff.ts`에서 MIME/파일 시그니처를 검증합니다.
3. `sanitizeR2Filename`으로 안전한 파일명을 만듭니다.
4. `galleryImageKey` 또는 `bulletinHwpKey`로 prefix가 고정된 key를 생성합니다.
5. AWS S3 SDK 호환 클라이언트로 Cloudflare R2에 업로드합니다.
6. 삭제 시에는 `R2_PUBLIC_URL`로 시작하고 허용 prefix에 포함된 key만 추출합니다.

---

## 📖 주보 편집 모델

주보 본문은 `bulletins.sections` JSONB에 구조화되어 저장됩니다.

```ts
interface BulletinSection {
  id: string
  title: string
  body?: string[]
  rows?: { label: string; value: string }[]
  tables?: { title: string; headers: string[]; rows: string[][] }[]
  offerings?: { category: string; names: string[] }[]
}
```

이 구조를 통해 예배 순서, 교회 소식, 표, 헌금자 명단처럼 서로 다른 형태의 주보 콘텐츠를 하나의 편집 UI에서 관리합니다.

---

## 🔎 SEO / 배포

- `src/app/sitemap.ts`: Next.js sitemap route
- `src/app/robots.ts`: robots.txt route
- `src/lib/sitemap.ts`: 정적 라우트와 DB 콘텐츠 URL 생성
- `metadataBase`: 공식 도메인 확정 후 설정 예정
- Open Graph locale: `ko_KR`
- Vercel Analytics 적용

배포는 Vercel에 연결된 GitHub 저장소에 push하면 자동으로 진행됩니다. Vercel 환경변수에는 `.env.local`과 동일한 값을 설정해야 합니다.

공식 도메인 배포 후 Google Search Console에 sitemap을 제출합니다.

```text
https://공식-도메인/sitemap.xml
```

---

## 🎨 디자인 시스템

교회 홈페이지의 차분하고 따뜻한 이미지를 위해 밝은 블루/페이퍼 톤, 넓은 여백, 명조 포인트 폰트, 부드러운 reveal motion을 사용합니다.

| 역할 | 색상 |
|---|---|
| 배경 | `rgb(228 236 246)` |
| 섹션 표면 | `rgb(215 227 242)` |
| 카드/종이 | `rgb(245 249 253)` |
| 주요 텍스트 | `rgb(30 42 69)` |
| 보조 텍스트 | `rgb(88 103 129)` |
| 선 | `rgb(196 210 228)` |
| 포인트 | `rgb(47 108 206)` |
| 깊은 포인트 | `rgb(33 83 180)` |

폰트는 본문에 Pretendard, 타이틀/강조에 Nanum Myeongjo를 사용합니다.

---

## 🔄 개발 현황

### ✅ 완성된 기능

**공개 페이지**
- 홈, 교회 소개, 섬기는 사람들, 교회 연혁, 오시는 길
- 새가족 안내
- 설교 목록/상세, YouTube 임베드, 예배 유형 필터
- 교회 소식 목록/상세
- 주보 목록/상세
- 갤러리 앨범 목록/상세
- sitemap/robots/metadata

**관리자**
- Better Auth 로그인 및 세션 보호
- 게시글 작성/수정/발행 관리
- 주보 작성/수정/HWP 업로드/섹션 편집
- 갤러리 앨범 작성/수정/이미지 관리
- 운영 로그 조회
- 관리자 계정 생성/삭제 스크립트

**운영/품질**
- Neon Postgres + Drizzle 마이그레이션
- Cloudflare R2 업로드/삭제
- 업로드 MIME 검증
- 핵심 유틸 Vitest 테스트
- Vercel Analytics

### 🚧 개선 예정

- [ ] 관리자 설교 CRUD 고도화
- [ ] 주보 HWP 파싱 정확도 개선 및 예외 케이스 확장
- [ ] 이미지 업로드 진행률/실패 재시도 UX 개선
- [ ] 관리자 작업 로그 필터링 강화
- [ ] 접근성 점검 결과 문서화

---

## 🙋 프로젝트 정보

| 항목 | 내용 |
|---|---|
| 프로젝트명 | 영천중앙교회 홈페이지 |
| 대상 기관 | 영천중앙교회 |
| 주소 | 경북 영천시 완산중앙8길 21 |
| 대표 전화 | `054-334-6644~5` |
| 운영 도메인 | 공식 배포 예정 |
| 주요 사용자 | 성도, 새가족, 지역 주민, 교회 운영자 |
| 핵심 목적 | 예배/설교/주보/소식 제공 및 교회 콘텐츠 운영 효율화 |

---

## 📄 라이선스

본 프로젝트는 영천중앙교회의 공식 홈페이지 운영을 위해 제작되었습니다.
