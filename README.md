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

영천중앙교회의 예배, 설교, 찬양, 특별행사, 주보, 소식, 사진·영상 갤러리, 새가족 안내를 한곳에서 제공하는 공식 웹사이트입니다.

교회를 처음 방문하는 성도와 지역 주민이 예배 시간, 오시는 길, 새가족 안내, 교회 사역 정보를 쉽게 확인할 수 있도록 공개 페이지를 구성했고, 운영자는 `/admin`에서 소식 게시글, 주보, 갤러리 앨범을 직접 관리할 수 있습니다.

주보는 **원본 PDF를 면 이미지로 그대로 보여주는 뷰어**와, 운영자가 직접 입력하는 **「이번 주 한눈에」 카드**를 함께 제공합니다. 원본은 정보 손실 없이 보존하고, 확대 없이 읽어야 하는 핵심 정보(설교 제목·본문·찬송·일정·공지)는 사람이 쓴 텍스트로 분리해 정확성과 접근성을 확보했습니다.

---

## 🚀 핵심 성과

- **1인 개발 전 과정 수행** — 요구사항 정리부터 정보 구조, UI, 백엔드, 데이터베이스, 인프라, 배포·운영까지 단독 수행
- **운영 부담 자동화** — 설교는 YouTube 업로드만으로 등록·자막·AI 요약·썸네일까지 채워지고, 주보는 PDF 한 번 업로드로 면 이미지 3종 변환·R2 업로드·뷰어 렌더링까지 이어짐
- **서버리스 신뢰성 설계** — 서명 검증, 원자적 작업 선점, 지연 발행 기반 백오프, 정합성 cron으로 중복 실행과 일시 장애에 대응
- **운영 품질 확보** — Better Auth, R2 업로드 검증, 쿠키리스 방문 분석, Vitest·PGlite·Playwright와 GitHub Actions 검증 체계
- **서비스 주소** — [https://www.ycjc.kr](https://www.ycjc.kr)

> 설계 배경과 의사결정 과정은 [포트폴리오 케이스 스터디](https://dwoobae.com/projects/ycc-website)에, 구현·운영 상세는 이 문서에 정리했습니다.

---

## ✨ 주요 기능

### 공개 페이지

- 🏠 **홈** — 몰입형 Hero, 교회 비전, 예배 시간, 갤러리, 최신 설교, 이번 주 주보 축약 카드, 방문 안내
- ⛪ **교회 소개** — 교회 소개, 담임목사 인사말, 섬기는 사람들, 교회 연혁
- 🕊️ **행복선언** — 예배 때마다 축도 전에 함께 고백하는 행복선언 소개
- 🙋 **새가족 안내** — 처음 방문하는 성도를 위한 등록/정착 안내
- ⏰ **예배 안내** — 주일예배·주일학교·청년부·수요예배·새벽예배·금요기도회 시간/장소
- ❓ **FAQ** — 처음 방문하는 분들이 자주 묻는 질문과 답변
- 📍 **오시는 길** — 주소, 대표 전화, 카카오맵 기반 위치 안내
- 🎧 **예배·설교** — 주일·찬양·수요설교 목록/상세, 검색·정렬·페이지네이션, YouTube 임베드, AI 요약(한 줄 소개·요점·타임스탬프 챕터), 자동 생성 썸네일
- 🔠 **요약 글자 크기 조절** — 설교 요약을 3단계 글자 크기로 조절해 고령 성도의 가독성 확보 (선택값 유지)
- 🎵 **찬양** — 찬양대·특송 영상을 설교 콘텐츠와 분리해 제공
- 🎉 **특별행사** — 특별행사·사역 보고 영상을 일반 설교/찬양과 분리해 제공
- 📰 **교회 소식** — 공지, 소식, 행사 게시글 목록/상세
- 📖 **주보** — 최신 주보를 크게 강조한 목록 + 지난 주보 날짜 행, 상세는 「이번 주 한눈에」 카드·예배 시간·일정/공지·다음 주 예고 + 원본 면 뷰어 2단 구성
- 🔍 **주보 라이트박스** — 원본 면을 전체화면으로 한 면씩 열람. 핀치·휠 연속 줌과 큰 글자 라벨 버튼(작게/크게/원래대로, 이전 면/다음 면)을 함께 제공
- 🖼️ **갤러리** — 교회 행사와 공동체 사진·영상 앨범, 포스터 그리드와 라이트박스 재생
- 🔎 **SEO·접근성·에러 화면** — sitemap, robots, metadata, OG, JSON-LD(Church), 본문 바로가기 링크, 커스텀 error/404 화면

### 관리자 페이지 (`/admin`)

Better Auth 이메일/비밀번호 로그인으로 보호되며, 공개 회원가입은 비활성화되어 있습니다.

- 🔒 **관리자 로그인** — `/sign-in`에서 로그인, 세션 기반 관리자 접근 (쿠키 캐시로 세션 DB 왕복 절감)
- 📝 **게시글 관리** — 공지/소식/행사 작성·수정, 바로 공개/예약 게시/비공개 상태와 고정 여부 관리
- ⏰ **예약 게시** — 지정한 KST 시각에 소식 자동 공개. QStash 지연 콜백이 공개 시각에 캐시를 재검증해 정시 노출, 저장 시점에 예약 시각이 지났으면 즉시 공개로 낙관 처리
- 🧭 **관리 목록 공통 UX** — 등록 버튼을 히어로 아래 좌측에 통일 배치, 목록 제목 클릭 시 공개 페이지 새 창 열기(공개 항목만), 삭제는 확인 모달로 보호
- 📖 **주보 관리** — 주보일, 권/호와 「한눈에」 필드(설교 제목·본문·설교자·찬송·교독문·다음 주 예고) 입력, 일정·공지 리스트 편집
- 📄 **주보 원본 업로드** — PDF 1개 또는 이미지 여러 장을 올리면 브라우저가 면별로 렌더해 세 크기 이미지로 변환하고 R2에 직접 업로드
- 👀 **주보 미리보기** — 공개 화면 컴포넌트를 그대로 재사용한 미리보기로 게시 전 확인
- 🖼️ **갤러리 관리** — 앨범 생성/수정, 사진 다중 업로드, 캡션·대체텍스트 편집, 순서 변경, 영상 업로드/삭제
- 🎞️ **갤러리 영상 업로드** — 최대 200MB의 MP4/MOV/WebM을 presigned URL로 R2에 직접 업로드하고 진행률·자동 추출 포스터를 제공
- ☁️ **R2 파일 업로드** — 갤러리 사진·영상, 주보 면 이미지·원본 PDF, 설교 썸네일을 Cloudflare R2에 저장
- 🎬 **설교 자동화 관리** — 설교 메타 수정, 요약 재생성, AI 썸네일 생성·스타일 선택·적용, 채널 수동 동기화
- 📡 **SSE 진행 스트림** — 썸네일 생성·채널 동기화 진행 상황을 실시간 스트리밍으로 표시
- 📊 **방문 분석 대시보드** — 자체 수집한 방문 로그 기반 방문자/페이지뷰/체류시간 통계
- 🧯 **운영 로그** — 주요 관리자 작업과 서버 로그 확인
- ⏳ **페이지별 스켈레톤 로딩** — 목록 히어로는 라우트 그룹 layout에 두어 로딩 중 리마운트로 진입 애니메이션이 재생되지 않게 처리
- 👤 **관리자 계정 스크립트** — CLI로 관리자 생성/삭제

### 보안·운영 기능

- 🛑 **공개 회원가입 차단** — Better Auth `disableSignUp: true`
- 🌐 **Trusted Origin 정규화** — `BETTER_AUTH_URL`, `VERCEL_URL`, production URL 기반 origin 구성
- 🗂️ **R2 key prefix 제한** — `gallery/`, `bulletins/`, `thumbnails/` 범위만 삭제 key로 인정
- 🎞️ **영상 업로드 검증** — 서버가 MIME·크기·R2 key를 검증하고 업로드 후 HEAD 요청으로 실제 객체 크기와 타입을 재확인
- 🧪 **업로드 MIME 검증** — 허용된 파일 타입만 업로드 처리
- 🧹 **파일명 정규화** — 업로드 filename을 안전한 R2 key로 변환
- 📊 **자체 방문 분석** — 쿠키리스 수집(`/api/track`), 봇·데이터센터·관리자 제외, IP 마스킹·솔트 해시, 한국어 지역명, 레이트리밋, 일일 통계 롤업 cron
- 📈 **Vercel Analytics · Google Analytics** — 자체 방문 분석과 함께 외부 분석 도구 병행 적용
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

- **WebSub(PubSubHubbub) 푸시 구독**: 채널 피드를 Google 허브에 구독(`hub.mode=subscribe`, `verify=async`, `hub.secret`)해 업로드 순간에만 콜백을 받습니다. 주기적 폴링이 없어 YouTube API 쿼터·함수 호출을 평소엔 0으로 유지합니다. 구독 lease는 만료되므로 **QStash cron으로 약 2일마다 재구독**하고, 놓친 영상은 **일일 정합성 cron(`reconcile-sermons`)이 채널 재생목록과 DB를 대조해 자동 백필**합니다.
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
- **성경구절 자동 추출**: 요약문에서 `책이름 장:절` 정규식으로 추출하고(실패 시 관리자 입력 유도), 생성된 배경은 `thumbnailBackgrounds`에 보존해 **위치만 재배치할 때 gpt-image-2를 재호출하지 않습니다**. 스타일별 마지막 생성/적용 문구도 `thumbnailTexts`에 저장해 모달 재진입 시 프리필합니다.
- **WebP 저장 최적화**: 합성 결과(1280×720 PNG, 수 MB)를 저장 시점에 **sharp로 WebP 변환**해 용량을 10~20배 줄입니다(이미지 최적화 unoptimized 환경에서 원본이 그대로 서빙되기 때문). 기존 PNG는 `backfill-webp` 관리자 API로 일괄 전환합니다.
- **운영 안전장치**: 관리자 모달에서 수동 생성(비용 경고 표기), **SSE로 생성 단계별 진행 상황 스트리밍**, 후보 이력 보존, 확정 시 `customThumbnailUrl`을 적용하되 **원본 유튜브 썸네일을 폴백으로 보존**(`customThumbnailUrl ?? thumbnailUrl`)해 되돌리기와 생성 실패에 안전합니다.

### 📄 주보 PDF 브라우저 변환 파이프라인

주보는 원본 PDF를 **브라우저에서 면별 이미지로 변환**해 R2에 직접 올립니다. 서버 네이티브 의존성이 0이고, Vercel 함수 본문 크기 제한도 타지 않습니다.

> 이전에는 `.hwp` 바이너리를 직접 파싱해 표·문단을 복원했지만, 복원이 불완전해 섹션이 뭉치거나 `표 1`처럼 떨어지는 문제가 있었습니다. **잘못된 정보가 생성될 여지를 없애는 쪽**을 택해 파서를 전량 폐기하고, 원본 이미지 + 사람이 입력한 「한눈에」 카드 구조로 재설계했습니다.

- **왜 브라우저인가**: `sharp`는 Vercel에서 PDF를 읽지 못합니다(libvips에 poppler/pdfium 미포함). 관리자 화면에서 `pdfjs-dist`를 동적 import해 렌더하므로 공개 번들에도 포함되지 않습니다. 워커는 번들러 처리에 의존하지 않고 `prebuild`/`predev` 훅이 `public/`으로 복사한 파일(`/pdf.worker.min.mjs`)을 씁니다.
- **면당 세 크기 사전 생성**: `next.config.ts`가 `images.unoptimized: true`라 `next/image`의 `sizes`로는 축소본이 생기지 않습니다. 그래서 업로드 시점에 긴 변 **2000 / 1000 / 320px**(라이트박스 / 인라인·표지 / 썸네일 스트립)로 직접 인코딩합니다. 원본이 더 작으면 확대하지 않고 **축소만 클램프**합니다.
- **iOS Safari 메모리 방어**: 면을 **순차 처리**하고, 렌더가 끝난 canvas는 크기를 0으로 줄여 즉시 해제하며 `page.cleanup()`을 호출합니다. 병렬 렌더는 몇 면 만에 canvas 메모리를 터뜨립니다.
- **WebP 폴백 전파**: `canvas.toBlob('image/webp')`가 `null`을 주는 브라우저에서는 JPEG로 폴백하고, **이후 모든 면이 같은 mime을 쓰도록** 결과에 mime을 실어 보내 키 확장자와 presign `contentType`이 어긋나지 않게 합니다.
- **업로드 단위 스테이징**: 키를 `bulletins/{YYYY-MM-DD}/{uploadId}/{n}-{size}.webp`로 만듭니다. 날짜만으로 키를 만들면 수정 중 **공개 중인 이미지를 부분적으로 덮어써** 교인이 신·구 면이 섞인 주보를 보게 됩니다. 업로드 id로 스테이징하면 교체가 DB 한 줄 갱신으로 원자적이 되고, 부분 실패는 DB를 쓰지 않는 것으로 처리됩니다.
- **저장 전 검증·정리**: 서버 액션이 presigned URL 배열을 1회 발급하고, 저장 시 각 키를 `headR2Object`로 실제 존재 확인한 뒤 DB에 씁니다. **DB 저장이 성공한 다음에야** 이전 업로드 id의 객체를 best-effort로 지웁니다.
- **PDF 다운로드 헤더**: 교차 출처 리소스에는 `<a download>`가 먹지 않으므로, presign 시 `ContentDisposition: attachment`를 `signableHeaders`에 포함해 R2가 직접 다운로드 응답을 내도록 합니다(Vercel 대역폭 미사용).

### 🔍 노인 사용자 기준으로 설계한 주보 라이트박스

주 사용자가 노인 교인이라는 것이 이 화면의 설계 기준입니다. 제스처를 아는 사람에게만 깔끔한 UI는 처음 보는 사람에게 **버튼이 있다는 사실 자체를 숨깁니다.**

- **조작 요소는 전부 면 바깥 툴바에**: 면 위에 뜨는 반투명 컨트롤을 두지 않고, 항상 보이고 크고 글자 라벨이 붙은 버튼을 하단 바에 둡니다(`－ 작게` `원래대로` `＋ 크게` / `◀ 이전 면` `3 / 6면` `다음 면 ▶`). 읽는 면적을 조금 내주는 대가입니다.
- **연속 줌 + 단계 버튼 병행**: 핀치·휠은 연속값, 버튼·키보드는 한 번에 ×1.4로 **같은 `zoom` 상태**를 건드립니다. 스테이지에 `touch-action: none`을 걸고 휠은 **non-passive 리스너**로 받아 `preventDefault()`합니다 — React의 `onWheel`은 passive로 붙어 막히지 않고, 막지 않으면 맥 트랙패드 핀치가 브라우저 페이지 줌으로 새어 나갑니다.
- **앵커 고정 확대**: 커서 위치(또는 두 손가락 중점)를 고정한 채 확대합니다. 중심 고정이면 읽으려던 지점이 화면 밖으로 밀려납니다. `zoom`과 `offset`은 한 상태 객체로 묶어, 한쪽만 반영된 중간 프레임이 보이지 않게 합니다.
- **드래그는 언제나 화면 이동**: 스와이프로 면이 넘어가지 않습니다. 확대해서 읽는 중에 미는 동작이 면 넘김이 되면 보던 위치를 잃습니다. 양끝에서는 해당 이동 버튼을 **비활성이 아니라 렌더하지 않되 자리는 남깁니다** — 폭까지 사라지면 남은 버튼 위치가 바뀌어 같은 자리를 두 번 누를 수 없습니다.
- **Fullscreen API에 의존하지 않음**: iOS Safari는 임의 요소의 `requestFullscreen()`을 지원하지 않으므로 `position: fixed` 오버레이로 구현하고, Fullscreen API는 지원 환경에서만 부가 적용합니다. `role="dialog"` + 포커스 트랩 + `Escape` 닫기 + 배경 스크롤 잠금·복원을 갖춥니다.
- **판정 로직 분리**: 면 이동(`bulletin-paging.ts`)과 줌·드래그 계산(`bulletin-zoom.ts`)을 DOM 없는 순수 함수로 뽑았습니다. vitest가 node 환경이라 컴포넌트 테스트를 돌릴 수 없으므로, 여기 있어야 검증됩니다. 실제 상호작용은 Playwright로 덮습니다.

---

## 🛠️ 기술 스택

| 구분 | 기술 |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19 |
| Styling | Tailwind CSS v4, CSS variables |
| Font | Pretendard 기반 산세리프 단일 체계 |
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
| 주보 PDF 변환 | `pdfjs-dist` 브라우저 렌더 → canvas → WebP 3종 |
| Analytics | Vercel Analytics + Google Analytics + 자체 방문 분석(`page_views` 수집·일일 롤업) |
| Test | Vitest (+ PGlite 기반 DB 통합 테스트), Playwright E2E |
| Lint | ESLint 9, eslint-config-next |
| Deploy | Vercel |

---

## 📁 프로젝트 구조

```text
src/
  app/
    page.tsx                         # 메인 홈
    layout.tsx                       # 전역 레이아웃, 폰트, Header/Footer, JSON-LD, Analytics
    error.tsx / global-error.tsx     # 전역 에러 화면
    not-found.tsx                    # 404 화면
    sitemap.ts                       # Next.js sitemap route
    robots.ts                        # robots.txt route
    sign-in/page.tsx                 # 관리자 로그인
    about/
      page.tsx                       # 교회 소개
      greeting/page.tsx              # 담임목사 인사말
      serving/page.tsx               # 섬기는 사람들
      history/page.tsx               # 교회 연혁
    newfamily/page.tsx               # 새가족·예배·FAQ·다음세대·오시는 길 통합 안내
    worship/page.tsx                 # 예배 안내
    happiness/page.tsx               # 행복선언
    faq/page.tsx                     # 자주 묻는 질문
    praise/page.tsx                  # 찬양대·특송 영상
    events/page.tsx                  # 특별행사·사역 보고 영상
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
      page.tsx                       # 사진·영상 갤러리 앨범 목록
      [id]/page.tsx                  # 사진·영상 갤러리 앨범 상세
    admin/
      layout.tsx                     # 관리자 레이아웃
      page.tsx                       # 대시보드
      loading.tsx                    # 페이지별 스켈레톤 로딩 (하위 경로에도 각각 존재)
      posts/                         # 게시글 목록/작성/수정
      bulletins/                     # 주보 목록/작성/수정
      gallery/                       # 사진·영상 갤러리 목록/작성/수정
      sermons/                       # 설교 관리 목록/수정
      analytics/page.tsx             # 방문 분석 대시보드
      log/page.tsx                   # 운영 로그
    api/
      auth/[...all]/route.ts         # Better Auth route handler
      track/route.ts                 # 방문 로그 수집 (pageview/heartbeat/leave)
      youtube/websub/route.ts        # WebSub 구독검증(GET) + 알림수신(POST)
      admin/
        gallery/upload/route.ts                # 갤러리 이미지 업로드
        sermons/sync/stream/route.ts           # 채널 수동 동기화 SSE 스트림
        sermons/[id]/thumbnail/stream/route.ts # 썸네일 생성 SSE 스트림
        thumbnails/backfill-webp/route.ts      # 기존 PNG 썸네일 WebP 일괄 전환
      jobs/
        ingest-video/route.ts        # 신규 영상 적재
        fetch-transcript/route.ts    # 자막 fetch·캐시
        summarize/route.ts           # Gemini 요약(claim 선점)
        publish-post/route.ts        # 예약 게시 공개 시각 캐시 재검증 (QStash 지연 콜백)
        retry-summaries/route.ts     # 실패 요약 재시도 (QStash cron)
        websub-renew/route.ts        # WebSub 재구독 (QStash cron)
        reconcile-sermons/route.ts   # 채널↔DB 정합성 백필 (QStash cron)
        analytics-rollup/route.ts    # 방문 통계 일일 롤업 (QStash cron)
  components/
    layout/                          # Header, Footer, PageHero, KakaoMap, VisitBlock
    home/                            # ImmersiveHero, HomeBulletinCard 등 홈 섹션
    about/                           # 교회 소개 섹션 컴포넌트
    worship/                         # 예배 안내 컴포넌트
    sermons/                         # 설교·찬양·행사 그리드, 필터, YouTubePlayer
    bulletins/                       # BulletinView, BulletinGlance, BulletinNotices,
                                     # BulletinWorshipTimes, BulletinPageViewer, BulletinLightbox
    gallery/                         # 앨범 카드, 사진·영상 그리드/라이트박스
    praise/                          # 찬양 페이지 Hero
    news/ posts/                     # 소식 목록/카드
    admin/                           # PostForm, AlbumForm, BulletinForm + 주보 업로드·한눈에·공지 편집
    analytics/                       # Tracker (방문 로그 클라이언트 수집)
    seo/                             # JsonLd
    ui/                              # Reveal, SectionTitle
  lib/
    auth.ts                          # Better Auth 설정
    auth-client.ts                   # 클라이언트 auth helper
    auth-origin.ts                   # Trusted origin 정규화
    dal.ts                           # 세션 검증/서버 데이터 접근 레이어
    admin.ts                         # 관리자 공통 헬퍼
    db/                              # Drizzle DB 클라이언트와 스키마
    data/                            # 공개 페이지·관리자 대시보드 데이터 조회
    actions/                         # 관리자 Server Actions (썸네일 생성/요약 트리거 포함)
    ai/                              # Gemini 클라이언트, 설교 요약 생성
    posts/                           # 게시글 경로 재검증 유틸 (액션·예약 공개 잡 공유)
    sermons/                         # 동기화·적재·요약 claim/재시도·정합성 백필·제목 분류·ISR revalidate
    youtube/                         # YouTube 클라이언트, RapidAPI 채널, WebSub 구독/검증
    thumbnails/                      # 배경 생성·누끼·자막밴드·텍스트 합성·구절 추출·WebP 변환
    transcript/                      # RapidAPI 자막 fetch, 요약 프롬프트 빌드
    analytics/                       # 봇·데이터센터 판별, IP 마스킹/해시, 지역명, 통계 롤업
    seo/                             # JSON-LD 빌더
    qstash.ts                        # QStash 잡 발행/스케줄/서명 검증
    sse.ts                           # SSE 이벤트 파싱 유틸
    logger.ts                        # 서버 로깅 유틸
    site-origin.ts                   # 표준 사이트 origin/절대 URL
    r2.ts                            # Cloudflare R2 업로드/삭제/presign/key 처리
    upload-sniff.ts                  # 업로드 MIME 검증
    client-image-compress.ts         # 갤러리 이미지 클라이언트 압축
    client-video-upload.ts           # 영상 포스터 추출·진행률 PUT
    gallery-video.ts                 # 영상 MIME·크기 정책
    bulletin-pdf.ts                  # (client) PDF·이미지 → 면당 세 크기 blob 렌더
    bulletin-scale.ts                # 면 이미지 긴 변 축소 클램프 (순수 함수)
    bulletin-paging.ts               # 라이트박스 면 이동 계산 (순수 함수)
    bulletin-zoom.ts                 # 라이트박스 줌·드래그 계산 (순수 함수)
    bulletin-assets.ts               # 면·PDF URL → R2 키 추출 (교체 시 정리 대상)
    bulletin-editor.ts               # 공지·면 정규화/검증 유틸
    bulletin-format.ts               # 주보 날짜·권호 표기 포맷
    sitemap.ts                       # sitemap 데이터 생성 유틸
    seed/                            # 시드 데이터 정의
    church.ts                        # 교회 기본 정보
    nav.ts / worship.ts / date.ts    # 내비게이션·예배 유형·날짜 유틸
scripts/
  copy-pdf-worker.mjs                # pdfjs 워커를 public/으로 복사 (predev/prebuild 훅)
  seed.ts                            # 개발/초기 데이터 시드
  seed-from-rapidapi.ts              # RapidAPI로 실제 설교 데이터 시드
  summarize-sermons.ts               # 설교 일괄 요약 (수동 실행)
  websub-subscribe.ts                # WebSub 최초 구독
  qstash-schedules.ts                # QStash 정기 스케줄 등록 (멱등)
  cleanup-thumbnails.ts              # 썸네일 후보 트림 + R2 고아 객체 정리 (dry-run 기본)
  audit-bulletin-r2.ts               # bulletins/ 프리픽스 고아 객체 감사 (조회 기본, --delete)
  reset-db.ts                        # 개발 DB 초기화
  create-admin.ts                    # 관리자 계정 생성
  delete-user.ts                     # 사용자 계정 삭제
drizzle/                             # Drizzle 마이그레이션과 메타데이터
public/                              # map.html, 아이콘 등 경량 정적 자산 (이미지·영상 원본은 R2)
                                     # pdf.worker.min.mjs는 빌드 훅이 복사 (git 미추적)
e2e/                                 # 갤러리 업로드·서브내비·주보·페이지 크롬 Playwright 회귀 테스트
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

-- 설교 (핵심 메타)
sermons
  id                    uuid primary key default gen_random_uuid()
  title                 text not null
  display_title         text
  preacher              text
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
  is_published          boolean not null default false
  created_by            text
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
  thumbnail_texts       jsonb                 -- 스타일별 마지막 생성/적용 문구 (모달 프리필)

-- 교회 소식
posts
  id             uuid primary key default gen_random_uuid()
  title          text not null
  content        text
  category       text not null default '공지' -- check: '공지' | '소식' | '행사'
  thumbnail_url  text
  attachment_url text
  is_pinned      boolean not null default false
  is_published   boolean not null default false
  published_at   timestamptz            -- 게시 시각. 미래면 예약 게시(공개 페이지 비노출)
  created_by     text
  created_at     timestamptz default now()
  updated_at     timestamptz default now()
  -- index (is_published, is_pinned, published_at)

-- 주보
bulletins
  id                 uuid primary key default gen_random_uuid()
  bulletin_date      date not null          -- unique. 같은 날짜 재생성은 항상 실수
  volume             text
  issue              text
  sermon_title       text
  scripture          text                   -- 설교 본문
  preacher           text
  hymns              text                   -- 찬송가 번호 (자유 텍스트)
  responsive_reading text                   -- 교독문 번호
  next_week          text                   -- 다음 주 예고 한 줄
  pdf_url            text                   -- R2 원본 PDF (이미지 직접 업로드 시 없음)
  notices            jsonb not null default '[]'::jsonb  -- 일정·공지 리스트
  pages              jsonb not null default '[]'::jsonb  -- 면 이미지 (배열 순서 = 면 순서)
  is_published       boolean not null default false
  created_by         text
  created_at         timestamptz default now()
  updated_at         timestamptz default now()
  -- index (is_published, bulletin_date), unique (bulletin_date)

-- 갤러리 앨범
gallery_albums
  id             uuid primary key default gen_random_uuid()
  title          text not null
  description    text
  cover_img_url  text
  event_date     date
  is_published   boolean not null default false
  created_at     timestamptz default now()
  -- index (is_published, event_date, created_at)

-- 갤러리 이미지
gallery_images
  id          uuid primary key default gen_random_uuid()
  album_id    uuid not null references gallery_albums(id) on delete cascade
  image_url   text not null
  media_type  text not null default 'image' -- 'image' | 'video'
  poster_url  text                          -- 영상 포스터 이미지
  caption     text
  alt         text
  sort_order  integer not null default 0
  created_at  timestamptz default now()
  -- index (album_id, sort_order)

-- 운영 로그
app_logs
  id           uuid primary key default gen_random_uuid()
  action       text not null
  entity_type  text not null
  entity_id    uuid
  message      text
  created_by   text
  created_at   timestamptz default now()

-- 방문 로그 (자체 방문 분석, 원본 이벤트)
page_views
  id               uuid primary key
  visitor_id       text not null          -- IP+UA 솔트 해시 (쿠키리스)
  session_id       text not null
  path             text not null
  referrer         text
  region           text                   -- Vercel 지역 헤더
  ip_masked        text                   -- 마스킹된 IP
  user_agent       text
  duration_seconds integer not null default 0
  created_at       timestamptz default now()
  -- index (created_at, visitor_id), (session_id, created_at)

-- 일일 방문 통계 (analytics-rollup cron이 집계)
daily_page_stats
  date             date primary key
  unique_visitors  integer not null
  page_views       integer not null
  created_at       timestamptz default now()
```

> 주보의 `pages`는 `gallery_images`처럼 별도 테이블로 두지 않고 jsonb로 둡니다. 면 이미지는 개별 조회·수정 대상이 아니고(고치려면 PDF를 다시 올립니다) 항상 주보와 함께 읽히므로, 조인·삽입 루프·cascade 삭제가 전부 불필요합니다. `notices`·`pages` 모두 JSON 내부를 SQL로 쿼리하지 않습니다.

> 설교 도메인은 `sermons`(핵심 메타) + `sermon_transcripts` / `sermon_summaries` / `sermon_thumbnails`(위성, 1:1) 구조로 분할되어 있습니다. 자막·요약·썸네일 컬럼은 위성 테이블로 이관이 완료되어 `sermons`에는 레거시 컬럼이 남아 있지 않습니다.

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

# 표준 사이트 URL (www가 canonical)
NEXT_PUBLIC_SITE_URL=https://www.ycjc.kr

# VERCEL_URL, VERCEL_PROJECT_PRODUCTION_URL은 Vercel 시스템 변수를 사용합니다.
# 수동으로 설정하면 실제 도메인을 덮어써 인증 origin이 깨질 수 있습니다.

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
# 하위호환: RAPIDAPI_HOST 미설정 시 자막 fetch 폴백 호스트로 사용
RAPIDAPI_TRANSCRIPT_HOST=youtube-transcript3.p.rapidapi.com

# WebSub (콜백 URL은 사이트 origin + /api/youtube/websub 로 코드에서 합성)
WEBSUB_SECRET=your_websub_secret
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxx

# 자체 방문 분석 — visitor_id 해시용 솔트 (랜덤 문자열, 32바이트 이상 권장)
ANALYTICS_SALT=your_analytics_salt
```

---

## 🚀 로컬 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행 (predev가 pdfjs 워커를 public/으로 복사)
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속합니다.

```bash
# ESLint 검사
npm run lint

# TypeScript 검사
npm run typecheck

# Vitest 테스트
npm run test

# Playwright E2E (로컬 개발 서버를 자동 실행)
npm run test:e2e

# 프로덕션 빌드
npm run build

# Lighthouse (빌드 산출물을 npm start 로 띄워서 측정)
npm run lighthouse
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

# QStash 정기 스케줄 등록 (멱등, 재실행 안전)
npm run qstash:schedules
```

`qstash:schedules`는 다음 4개 스케줄을 등록/갱신합니다.

| 스케줄 | 주기 | 역할 |
|---|---|---|
| `websub-renew` | 2일마다 | WebSub 구독 lease 갱신 |
| `retry-summaries` | 매시간 | 실패한 요약 재시도 |
| `reconcile-sermons` | 매일 | 채널 재생목록 ↔ DB 정합성 대조·누락 백필 |
| `analytics-rollup` | 매일 | 방문 로그 → 일일 통계(`daily_page_stats`) 집계 |

실제 설교 데이터 시드와 일괄 요약(수동 보충):

```bash
# RapidAPI로 채널 영상을 받아 설교로 시드
npm run seed:rapidapi

# 요약이 비어있는 설교를 일괄 요약
npm run summarize:sermons
```

썸네일 저장소 정리(일회성 유지보수, 기본 dry-run):

```bash
# 썸네일 후보 이력 트림 + R2 고아 객체 목록 확인 (실제 반영은 -- --apply)
npm run thumbnails:cleanup
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

Vitest 테스트는 운영 영향이 큰 유틸과 파이프라인 로직 중심으로 구성되어 있으며, DB가 필요한 로직은 PGlite 기반 통합 테스트(`*.integration.test.ts`)로 검증합니다.

| 영역 | 테스트 | 검증 대상 |
|---|---|---|
| 업로드/스토리지 | `upload-sniff`, `r2`, `gallery-video` | 허용 MIME/파일 시그니처(`%PDF-` 포함), R2 파일명 정규화·key prefix, 주보 면·PDF key 형식과 presign prefix 가드, 영상 형식·크기·서명 URL 검증 |
| 인증/SEO | `auth-origin`, `sitemap`, `seo/jsonld` | Trusted origin 정규화, sitemap URL 생성, JSON-LD 빌더 |
| 주보 | `bulletin-editor`, `bulletin-format`, `bulletin-scale`, `bulletin-pdf`, `bulletin-paging`, `bulletin-zoom`, `actions/bulletins` | 공지·면 정규화/검증, 날짜·권호 표기, 긴 변 축소 클램프, PDF 면 렌더·WebP→JPEG 폴백·상한 거부, 면 이동 클램프·표기, 줌 클램프·앵커 고정·오프셋 클램프, 미검증 키 저장 거부 |
| 설교 동기화 | `youtube/websub`, `sermons/sync`, `sermons/reconcile` | WebSub 서명 검증·Atom 파싱, 신규 삽입 계획·중복 방지, 정합성 백필 |
| 설교 요약 | `sermons/summarize`(+integration), `ai/gemini`, `ai/sermon-summary`, `transcript/rapidapi`, `transcript/prompt` | claim 선점·지수 백오프·재시도 선별, Gemini 스키마/챕터 검증, 자막 fetch·프롬프트 빌드 |
| 설교 표기 | `sermons/classify-title`, `sermons/format`, `sermons/list-title`, `sermons/sermon-date` | 제목 분류·표시 포맷·날짜 파싱 |
| 썸네일 | `thumbnails/scripture`, `detect-caption-band`, `compose-text`, `generate-background`, `position`, `remove-background`, `store`(+integration), `webp`, `actions/thumbnails` | 성경구절 추출, 자막 밴드 crop, 텍스트 합성·배치, 배경 생성, 누끼, 후보 저장/트림, WebP 변환 |
| 방문 분석 | `analytics/bots`, `analytics/datacenter`, `analytics/ip`, `analytics/paths`, `analytics/region-ko`, `analytics/server` | 봇·데이터센터 판별, IP 마스킹·해시, 지역 한글화, 수집 경로 필터, 체류시간 집계 |
| 기타 유틸 | `worship`, `date`, `sse`, `db/schema`, `data/sermons`, `data/posts` | 예배 유형/필터, 날짜 유틸, SSE 파싱, 스키마 정합성, 설교 조회, 예약 게시 판별 |
| 브라우저 E2E | `gallery-upload`, `gallery-video`, `subnav-scroll`, `bulletins`, `page-chrome` | 관리자 갤러리 업로드 흐름, 영상 폼 검증, 서브내비 라우트 스크롤 회귀, 주보 목록→상세→라이트박스(썸네일 선택과 라이트박스 진입 분리, 한 면 표시, 드래그로 면이 넘어가지 않음, Escape 복귀), 페이지 크롬(히어로 리마운트 방지) 회귀 |

---

## 🤖 CI (GitHub Actions)

`main` 대상 push·PR에서 네 job이 병렬로 돕니다.

| Job | 하는 일 |
|---|---|
| Lint | `eslint` |
| Typecheck | `tsc --noEmit` |
| Test (unit) | `vitest run` — PGlite 인메모리 Postgres라 외부 의존성이 없습니다 |
| Build & Lighthouse | 마이그레이션 검증·적용 → 시드 → `next build` → `lhci autorun` |

Build job은 Postgres 서비스 컨테이너와 Neon HTTP 프록시(`ghcr.io/timowilhelm/local-neon-http-proxy`)를 띄웁니다.
`src/lib/db/index.ts`가 모듈 최상위에서 접속을 만들고 상세 라우트 4개가 `generateStaticParams`에서 DB를 읽기 때문에,
**빌드 자체가 살아 있는 DB를 요구**합니다. 앱은 neon-http로 말하므로 프록시가 그 HTTP 요청을 Postgres로 옮기고,
드라이버 종점은 `NEON_HTTP_PROXY` 환경변수로만 갈아끼웁니다 — 이 변수가 없으면 평소대로 Neon 클라우드로 붙습니다.

Lighthouse 임계값은 `.lighthouserc.json`에 있고 **접근성 0.9 미만이면 CI가 실패**합니다(성능·모범사례·SEO는 경고).
리포트는 실패 여부와 무관하게 `lighthouse-reports` 아티팩트로 올라갑니다.

Playwright e2e는 실제 DB/R2 크리덴셜이 필요해 CI에서 제외하고 로컬에서 돌립니다.

---

## 📦 Cloudflare R2 / 업로드 정책

업로드 파일은 Cloudflare R2에 저장되며, 공개 URL은 `R2_PUBLIC_URL`을 base로 생성됩니다.

허용 key prefix는 다음 세 범위입니다.

- `gallery/`: 갤러리 이미지·영상
- `bulletins/`: 주보 면 이미지와 원본 PDF
- `thumbnails/`: AI 설교 썸네일과 생성 배경

업로드 처리 흐름:

1. 관리자 화면에서 파일을 선택합니다.
2. `upload-sniff.ts`에서 MIME/파일 시그니처를 검증합니다.
3. `sanitizeR2Filename`으로 안전한 파일명을 만듭니다.
4. `galleryImageKey` 등 prefix가 고정된 key 생성 함수를 씁니다.
5. AWS S3 SDK 호환 클라이언트로 Cloudflare R2에 업로드합니다.
6. 삭제 시에는 `R2_PUBLIC_URL`로 시작하고 허용 prefix에 포함된 key만 추출합니다.

주보는 브라우저에서 변환하므로 별도 흐름을 씁니다. 서버 액션 `prepareBulletinUpload`가 업로드 id(`crypto.randomUUID()`)를 발급해 presigned PUT URL을 **배열로 한 번에** 내려주고, 브라우저가 R2에 병렬 PUT합니다. 저장 시 `assertBulletinAssets`가 각 키를 `headR2Object`로 확인하고, DB 저장 성공 후에 이전 업로드 id의 객체를 정리합니다. key 규칙은 다음과 같습니다.

```text
bulletins/{YYYY-MM-DD}/{uploadId}/{n}-full.webp      # 긴 변 2000px — 라이트박스
bulletins/{YYYY-MM-DD}/{uploadId}/{n}-preview.webp   # 긴 변 1000px — 인라인·목록 표지·홈 카드
bulletins/{YYYY-MM-DD}/{uploadId}/{n}-thumb.webp     # 긴 변 320px  — 썸네일 스트립
bulletins/{YYYY-MM-DD}/{uploadId}/original.pdf       # 원본 PDF (이미지 업로드 시 없음)
```

부분 실패한 업로드의 객체는 고아로 남습니다. 다음 성공 업로드 시점의 정리 대상에 포함되며, 남은 것은 `npx tsx scripts/audit-bulletin-r2.ts`로 감사할 수 있습니다(`--delete`로 삭제).

갤러리 영상은 Vercel 함수 본문 크기 제한을 우회하기 위해 별도 흐름을 사용합니다. 서버가 최대 10분 유효한 presigned PUT URL을 발급하면 브라우저가 R2로 직접 업로드하고, 업로드 후 서버가 HEAD 요청으로 객체의 MIME·크기를 재검증한 뒤 DB 레코드를 저장합니다. 브라우저에서 추출한 포스터는 일반 이미지 업로드 경로를 사용합니다. R2 버킷 CORS 설정은 [`docs/r2-cors-video-upload.md`](docs/r2-cors-video-upload.md)를 참고하세요.

---

## 📖 주보 데이터 모델

주보는 **스칼라 「한눈에」 필드 + 두 개의 JSONB 배열**로 구성됩니다.

```ts
/** 「이번 주 일정 · 공지」 통합 리스트. when이 있으면 시간 배지를 앞에 붙인다. */
interface BulletinNotice {
  title: string
  detail: string
  when?: string
}

/**
 * 원본 주보 면 이미지. 배열 순서가 면 순서다.
 * width·height는 full 기준이며 세 크기의 종횡비가 같으므로 한 번만 저장한다.
 */
interface BulletinPage {
  width: number
  height: number
  fullUrl: string     // 긴 변 2000px — 라이트박스
  previewUrl: string  // 긴 변 1000px — 인라인 큰 이미지, 목록 표지, 홈 카드
  thumbUrl: string    // 긴 변 320px  — 인라인 썸네일 스트립
}
```

특별일정과 공지를 한 배열로 합친 이유는, 별도 배열로 두면 특별일정이 2개 이상일 때 카드 그리드가 깨지기 때문입니다. `when` 유무로 배지만 갈리는 단일 리스트면 개수에 무관하게 렌더되고 관리자 에디터도 하나로 줄어듭니다.

### 이미지 방식의 대가

원본을 이미지로 게시하므로 본문 전문 검색이 불가능하고, 스크린리더는 면 내용을 읽지 못합니다. 이를 **「이번 주 한눈에」 카드가 텍스트로 존재하는 것**으로 부분 보완하며, 면 이미지에는 `"{YYYY년 M월 D일} 주보 {n}면"` alt를 붙여 최소한 위치를 알립니다. 종이 주보로 이미 인쇄·배포되는 정보라는 판단에 따라 헌금 명단 등도 원본 그대로 공개하며, 면 단위 비공개 장치는 두지 않습니다.

---

## 🔎 SEO / 배포

- `src/app/sitemap.ts`: Next.js sitemap route
- `src/app/robots.ts`: robots.txt route
- `src/lib/sitemap.ts`: 정적 라우트와 DB 콘텐츠 URL 생성
- `metadataBase`: 표준 사이트 origin(`getCanonicalSiteOrigin`) 기반으로 설정
- JSON-LD(Church) 구조화 데이터를 전역 레이아웃에 삽입
- Open Graph locale: `ko_KR`
- OG 이미지는 파일명에 버전을 붙여 교체합니다. 카카오톡·SNS는 URL 단위로 미리보기를 캐시하므로, 같은 파일명으로 덮어쓰면 갱신되지 않습니다.
- Vercel Analytics + Google Analytics + 자체 방문 분석 적용

배포는 Vercel에 연결된 GitHub 저장소에 push하면 자동으로 진행됩니다. Vercel 환경변수에는 `.env.local`과 동일한 값을 설정해야 합니다.

공식 도메인 배포 후 Google Search Console에 sitemap을 제출합니다.

```text
https://공식-도메인/sitemap.xml
```

---

## 🎨 디자인 시스템

교회 홈페이지의 신뢰감과 명료함을 위해 딥 네이비·로열 블루·골드 팔레트, 넓은 여백, Pretendard 산세리프 단일 체계, 부드러운 reveal motion을 사용합니다. 페이지 Hero는 navy/royal/beige의 단색 3톤으로 구분합니다.

| 역할 | 색상 |
|---|---|
| 딥 네이비 | `#0B1F5C` |
| 푸터 네이비 | `#071540` |
| 로열 블루 | `#2153B4` |
| 골드 포인트 | `#E8B54D` |
| 베이지 Hero | `#F0EEE3` |
| 섹션 표면 | `#F7F8FB` |
| 주요 본문 | `#3A4664` |
| 구분선 | `#E3E8F2` |

폰트는 본문·타이틀 모두 Pretendard를 사용합니다.

---

## 🚧 개선 예정

위 "주요 기능"에 적힌 항목은 모두 운영 중인 기능입니다. 앞으로 다룰 과제는 다음과 같습니다.

- [ ] 설교 요약/썸네일 파이프라인 관측성(잡 실패 알림·상태 대시보드)
- [ ] 주보 변환 실패 시 재시도 UX 및 고아 객체 자동 회수
- [ ] 이미지 업로드 진행률/실패 재시도 UX 개선
- [ ] 관리자 작업 로그 필터링 강화

---

## 🙋 프로젝트 정보

| 항목 | 내용 |
|---|---|
| 프로젝트명 | 영천중앙교회 홈페이지 |
| 대상 기관 | 영천중앙교회 |
| 주소 | 경북 영천시 완산중앙8길 21 |
| 대표 전화 | `054-334-6644~5` |
| 운영 도메인 | `https://www.ycjc.kr` |
| 주요 사용자 | 성도, 새가족, 지역 주민, 교회 운영자 |
| 핵심 목적 | 예배/설교/주보/소식 제공 및 교회 콘텐츠 운영 효율화 |

---

## 📄 라이선스

본 프로젝트는 영천중앙교회의 공식 홈페이지 운영을 위해 제작되었습니다.
