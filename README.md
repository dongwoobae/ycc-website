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
- 🎧 **설교** — 예배 유형별 목록/상세, YouTube 임베드, AI 요약(한 줄 소개·요점·타임스탬프 챕터), 자동 생성 썸네일
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
- 🎬 **설교 자동화 관리** — 자동 동기화된 설교의 요약 재생성, AI 썸네일 생성·스타일 선택·적용
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

## 🎯 기술 하이라이트

이 프로젝트에서 특히 공들인 엔지니어링입니다. 교회 운영자가 손을 거의 대지 않아도 설교 콘텐츠가 채워지도록, **서버리스 제약 위에서 이벤트 기반 자동화 파이프라인**을 구성한 것이 핵심입니다.

### 🎬 설교 자동 동기화 & AI 요약 파이프라인

새 설교 영상이 YouTube에 올라오면 **폴링 없이 실시간으로** 등록·자막화·요약까지 자동으로 진행됩니다.

```text
[YouTube 업로드]
      │  (WebSub 푸시)
      ▼
/api/youtube/websub  ── 서명검증(HMAC-SHA1) → Atom 파싱(yt:videoId)
      │  publishJob
      ▼
QStash 큐 ── delay/cron ──▶ /api/jobs/ingest-video
                                   │
                                   ▼
                          /api/jobs/fetch-transcript  (RapidAPI yt-api 자막)
                                   │
                                   ▼
                          /api/jobs/summarize  (Gemini 구조화 요약)
                                   │
                          실패 시 ◀┘ 지수 백오프 재발행 / retry-summaries cron
```

- **WebSub(PubSubHubbub) 푸시 구독**: 채널 피드를 Google 허브에 구독(`hub.mode=subscribe`, `verify=async`, `hub.secret`)해 업로드 순간에만 콜백을 받습니다. 주기적 폴링이 없어 YouTube API 쿼터·함수 호출을 평소엔 0으로 유지합니다. 구독 lease는 만료되므로 **QStash cron으로 약 2일마다 재구독**하고, 놓친 영상은 재생목록 동기화를 백필 보조 경로로 둡니다.
- **콜백 보안 2겹**: 구독 검증(GET)은 **우리 채널 토픽일 때만 `hub.challenge`를 에코**해 임의 토픽 구독을 차단하고, 알림(POST)은 **`X-Hub-Signature`(HMAC-SHA1)를 원문 바이트 기준 `timingSafeEqual`로 비교**해 위조를 차단합니다.
- **QStash 다단계 잡 체이닝**: `ingest-video → fetch-transcript → summarize`를 각각 독립 서버리스 함수로 분리하고 QStash 메시지로 연결합니다. 모든 잡 엔드포인트는 QStash `Receiver` 서명으로 검증되며, 한 단계가 실패해도 그 단계만 재시도됩니다.
- **서버리스식 지수 백오프**: Vercel 함수는 프로세스를 붙잡고 `sleep`할 수 없으므로, **QStash 지연 발행(`delay`)으로 백오프를 외부에 위임**합니다. 간격은 `5 × 3ⁿ분`으로 증가하고 `attempts < 3` 한도를 두며, 자막이 영구히 없는 건은 재시도 후보에서 제외해 API 쿼터 소진을 막습니다. 정기 재시도는 `retry-summaries` cron이 수행합니다.
- **원자적 동시성 제어(claim)**: WebSub 중복 알림·재시도 cron·수동 트리거가 겹쳐도 같은 설교가 동시에 여러 번 요약되지 않도록, Postgres CTE `UPDATE ... RETURNING`으로 **선점 가능한 상태일 때만 원자적으로 1건을 선점**합니다. pending이 10분 이상 멈추면 죽은 워커로 보고 회수합니다.
- **Gemini 구조화 출력**: `responseSchema`로 한 줄 소개(핵심 성경구절 포함)·핵심 요점 8~12개·**타임스탬프 챕터 분할**을 JSON 스키마로 강제하고, 받은 결과를 다시 **zod로 검증**(챕터 시작 시각 오름차순·영상 길이 이내)합니다. 모델 응답을 신뢰하지 않고 경계에서 막는 구조이며, 모델 fallback 체인으로 일시 장애에 대응합니다.

### 🎨 AI 설교 썸네일 생성

유튜브 원본 썸네일(대개 목사님 정면 1프레임)을 **디자인된 설교 썸네일로 자동 생성**하는 관리자 기능입니다. "AI 배경 + 코드 텍스트 합성" 하이브리드 방식입니다.

- **하이브리드 합성**: 이미지 생성 모델이 한글을 못 그리는 문제를 피하려 **배경만 AI로 생성하고 글자는 전부 코드로 합성**합니다. 배경 = OpenAI `gpt-image-2`(1280×720, 스타일별 프롬프트 + 설교 키워드 테마), 텍스트 = Next.js `ImageResponse`(`next/og`, Satori)로 한글 폰트를 임베드해 CSS로 합성합니다.
- **3가지 스타일**: ① 정통형(제목 + 성경구절) ② 후킹형(Gemini가 요약에서 후킹 헤드라인 생성) ③ 인물컷형(목사님 누끼 합성).
- **누끼 비용 0원 설계**: remove.bg로 배경을 제거하되, ⓐ 원본 하단 **자막 밴드를 먼저 crop**해 자막이 누끼 전경으로 딸려오는 문제를 없애고, ⓑ 원본이 저해상도(480×360)임을 이용해 **무료 등급 preview 사이즈(≤0.25MP)**로 처리 → 화질 손실 없이 유료 크레딧을 쓰지 않습니다.
- **성경구절 자동 추출**: 요약문에서 `책이름 장:절` 정규식으로 추출하고(실패 시 관리자 입력 유도), 생성된 배경은 `thumbnailBackgrounds`에 보존해 **위치만 재배치할 때 gpt-image-2를 재호출하지 않습니다**.
- **운영 안전장치**: 관리자 모달에서 수동 생성(비용 경고 표기), 후보 이력 보존, 확정 시 `customThumbnailUrl`을 적용하되 **원본 유튜브 썸네일을 폴백으로 보존**(`customThumbnailUrl ?? thumbnailUrl`)해 되돌리기와 생성 실패에 안전합니다.

### 📄 HWP 5.0 바이너리 직접 파싱

주보는 한글(HWP) 파일로 작성되는데, 외부 변환 서비스 없이 **HWP 5.0 포맷을 바이트 레벨에서 직접 파싱**해 웹 구조화 데이터로 변환합니다.

- **CFB 컨테이너 해석**: HWP 5.0은 MS Compound File Binary 구조라, `cfb`로 컨테이너를 열고 `FileHeader`의 플래그 비트로 **본문 압축 여부**를 판별합니다.
- **DEFLATE 해제 + zip bomb 방어**: 압축된 `BodyText/Section*` 스트림을 `inflateRawSync`로 해제하되, **`maxOutputLength`(25MB) 상한**을 둬 악성/과대 파일로 인한 메모리 폭주를 막습니다.
- **레코드 단위 파싱**: 각 섹션을 32비트 레코드 헤더(`tag = header & 0x3ff`, `size = (header >> 20) & 0xfff`, 확장 크기 `0xfff` 처리)로 순회하며, **문단 텍스트 태그(67)만 골라 UTF-16LE로 디코딩**하고 제어문자를 정리해 문단 배열로 만듭니다.
- 추출한 문단은 주보 편집 모델(`bulletins.sections` JSONB)로 이어져, 단순 파일 첨부가 아니라 **웹에서 읽기 좋은 구조화 주보**로 렌더링됩니다.

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
| AI 요약 | Google Gemini (`@google/genai`, `gemini-3.5-flash`) |
| 이미지 생성 | OpenAI `gpt-image-2` (썸네일 배경) |
| 배경 제거(누끼) | remove.bg API |
| 썸네일 합성 | Next.js `ImageResponse`(`next/og`, Satori), sharp |
| 메시지 큐·크론 | Upstash QStash |
| 영상·자막 | RapidAPI yt-api |
| 실시간 구독 | YouTube WebSub (PubSubHubbub) |
| Validation | Zod |
| HWP Parsing | cfb 기반 HWP 5.0 바이너리 직접 파싱 |
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
    api/
      auth/[...all]/route.ts         # Better Auth route handler
      youtube/websub/route.ts        # WebSub 구독검증(GET) + 알림수신(POST)
      jobs/
        ingest-video/route.ts        # 신규 영상 적재
        fetch-transcript/route.ts    # 자막 fetch·캐시
        summarize/route.ts           # Gemini 요약(claim 선점)
        retry-summaries/route.ts     # 실패 요약 재시도 (QStash cron)
        websub-renew/route.ts        # WebSub 재구독 (QStash cron)
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
    actions/                         # 관리자 Server Actions (썸네일 생성/요약 트리거 포함)
    ai/                              # Gemini 클라이언트, 설교 요약 생성
    sermons/                         # 동기화·적재·요약 claim/재시도·제목 분류·재생목록
    youtube/                         # YouTube 클라이언트, RapidAPI 채널, WebSub 구독/검증
    thumbnails/                      # 배경 생성·누끼·자막밴드·텍스트 합성·구절 추출
    transcript/                      # RapidAPI 자막 fetch, 요약 프롬프트 빌드
    qstash.ts                        # QStash 잡 발행/스케줄/서명 검증
    site-origin.ts                   # 표준 사이트 origin/절대 URL
    hwp/parse.ts                     # HWP 5.0 바이너리 파싱 유틸
    r2.ts                            # Cloudflare R2 업로드/삭제/key 처리
    upload-sniff.ts                  # 업로드 MIME 검증
    bulletin-editor.ts               # 주보 편집 데이터 유틸
    sitemap.ts                       # sitemap 데이터 생성 유틸
    church.ts                        # 교회 기본 정보
scripts/
  seed.ts                            # 개발/초기 데이터 시드
  seed-from-rapidapi.ts              # RapidAPI로 실제 설교 데이터 시드
  summarize-sermons.ts               # 설교 일괄 요약 (수동 실행)
  websub-subscribe.ts                # WebSub 최초 구독
  qstash-schedules.ts                # QStash 정기 스케줄 등록 (멱등)
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

-- 설교 (핵심 메타 + 요약 작업 상태)
sermons
  id                    uuid primary key default gen_random_uuid()
  title                 text not null
  display_title         text
  preacher              text
  scripture             text
  series_id             uuid references sermon_series(id) on delete set null
  worship_type          text not null default '주일예배'
  sermon_date           date not null
  video_url             text
  audio_url             text
  notes_url             text
  youtube_video_id      text unique           -- WebSub/동기화 dedup 키
  duration_seconds      integer
  thumbnail_url         text                  -- 유튜브 원본(폴백)
  custom_thumbnail_url  text                  -- 확정된 커스텀 썸네일
  summary               text                  -- 한 줄 소개(핵심 성경구절 포함)
  quick_summary         jsonb                 -- string[]
  chapters              jsonb                 -- 타임스탬프 챕터
  summary_status        text not null default 'none'  -- none|pending|ready|failed
  summary_attempts      integer not null default 0
  summary_next_retry_at timestamptz
  summary_generated_at  timestamptz
  summary_model         text
  is_published          boolean not null default false
  created_by            uuid references profiles(id) on delete set null
  created_at            timestamptz default now()
  -- index (is_published, sermon_date)

-- 설교 자막 (위성 테이블, sermon 1:1)
sermon_transcripts
  sermon_id             uuid primary key references sermons(id) on delete cascade
  transcript_text       text
  transcript_fetched_at timestamptz

-- 설교 요약 (위성 테이블, 요약 작업 큐 상태)
sermon_summaries
  sermon_id             uuid primary key references sermons(id) on delete cascade
  summary               text
  quick_summary         jsonb
  chapters              jsonb
  summary_status        text not null default 'none'
  summary_attempts      integer not null default 0
  summary_next_retry_at timestamptz
  summary_generated_at  timestamptz
  summary_model         text
  created_at            timestamptz default now()
  -- index (summary_status, summary_next_retry_at)

-- 설교 썸네일 (위성 테이블, AI 썸네일 자산)
sermon_thumbnails
  sermon_id             uuid primary key references sermons(id) on delete cascade
  thumbnail_candidates  jsonb                 -- 생성 이력 [{ style, url, createdAt }]
  thumbnail_bg_keywords text
  thumbnail_backgrounds jsonb                 -- 스타일별 배경 재사용 캐시
  thumbnail_cutout_url  text                  -- 인물컷 누끼 PNG

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

> 설교 도메인은 `sermons`(핵심) + `sermon_transcripts` / `sermon_summaries` / `sermon_thumbnails`(위성, 1:1) 구조로 분할 전환 중이며, 전환 기간에는 `sermons`에 일부 레거시 컬럼이 함께 존재합니다.

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

# Vercel preview/production hostnames + 표준 사이트 URL
VERCEL_URL=ycc-website.vercel.app
NEXT_PUBLIC_SITE_URL=https://ycc-website.vercel.app
VERCEL_PROJECT_PRODUCTION_URL=ycc-website.vercel.app

# Gemini (AI 설교 요약)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash

# OpenAI (썸네일 배경 생성, gpt-image-2)
OPENAI_API_KEY=your_openai_api_key

# remove.bg (인물컷형 썸네일 누끼)
REMOVE_BG_API_KEY=your_remove_bg_api_key

# QStash (메시지 큐 + 정기 스케줄)
# 스케줄(WebSub 갱신·요약 재시도)은 `npm run qstash:schedules` 1회 실행으로 멱등 등록
QSTASH_URL=https://qstash-eu-central-1.upstash.io
QSTASH_TOKEN=your_qstash_token
QSTASH_CURRENT_SIGNING_KEY=your_qstash_current_signing_key
QSTASH_NEXT_SIGNING_KEY=your_qstash_next_signing_key

# RapidAPI yt-api (채널 영상 목록 + 자막)
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=yt-api.p.rapidapi.com

# WebSub (콜백 URL은 사이트 origin + /api/youtube/websub 로 코드에서 합성)
WEBSUB_SECRET=your_websub_secret
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxx
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

## 🎬 설교 파이프라인 운영

설교 자동화는 WebSub 구독과 QStash 스케줄에 의존합니다. 배포 후(또는 사이트 URL 변경 시) 다음을 1회 실행합니다.

```bash
# YouTube 채널 WebSub 최초 구독 (이후 갱신은 cron이 담당)
npm run websub:subscribe

# QStash 정기 스케줄 등록 — WebSub 재구독·요약 재시도 (멱등, 재실행 안전)
npm run qstash:schedules
```

실제 설교 데이터 시드와 일괄 요약(수동 보충):

```bash
# RapidAPI로 채널 영상을 받아 설교로 시드
npm run seed:rapidapi

# 요약이 비어있는 설교를 일괄 요약
npm run summarize:sermons
```

> WebSub 콜백과 QStash 잡은 모두 서명 검증을 거치므로, `WEBSUB_SECRET`과 QStash 서명 키가 배포 환경에 설정돼 있어야 합니다.

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
| `youtube/websub.test.ts` | WebSub 서명 검증·Atom 알림 파싱 |
| `sermons/summarize.test.ts` | 요약 claim 선점·지수 백오프·재시도 대상 선별 |
| `sermons/sync.test.ts` | 신규 설교 삽입 계획·중복 방지 |
| `ai/sermon-summary.test.ts` | Gemini 요약 스키마/챕터 검증 |
| `thumbnails/scripture.test.ts` | 요약문 성경구절 정규식 추출 |
| `thumbnails/detect-caption-band.test.ts` | 자막 밴드 감지·crop |
| `transcript/rapidapi.test.ts` | RapidAPI 자막 fetch 파싱 |

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

**설교 자동화**
- YouTube WebSub 실시간 동기화 + QStash 잡 파이프라인
- Gemini 구조화 AI 요약(한 줄 소개·요점·타임스탬프 챕터) + claim 동시성·지수 백오프 재시도
- AI 썸네일 생성(gpt-image-2 배경 + Satori 텍스트 합성 + remove.bg 누끼, 3스타일)

**운영/품질**
- Neon Postgres + Drizzle 마이그레이션
- Cloudflare R2 업로드/삭제
- 업로드 MIME 검증
- 핵심 유틸 Vitest 테스트
- Vercel Analytics

### 🚧 개선 예정

- [ ] 설교 요약/썸네일 파이프라인 관측성(잡 실패 알림·상태 대시보드)
- [ ] sermons 분할 마이그레이션 마무리(위성 테이블 전환 후 레거시 컬럼 DROP)
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
