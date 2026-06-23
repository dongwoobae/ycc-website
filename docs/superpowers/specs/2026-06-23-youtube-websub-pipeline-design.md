# 설교 YouTube WebSub + Upstash + 자막요약 파이프라인 설계

**작성일**: 2026-06-23
**상태**: 설계 확정 (구현 계획 대기)
**대체 대상**: `2026-06-20-sermon-youtube-ai-summary-design.md`(Vercel Cron + Gemini 영상 직접입력 방식)을 **전면 교체**한다.

## 교체 사유

기존 설계는 Vercel Cron 폴링으로 재생목록을 동기화하고 Gemini에 YouTube URL을 직접 입력했다. 그러나:

- **Vercel Hobby Cron은 하루 1회가 한계** → "30분마다" 같은 주기가 불가능. 즉시성·재시도 주기를 만들 수 없다.
- 업로드 즉시 반영하려면 폴링이 아니라 **푸시(WebSub)** 가 맞다.
- 요약 입력을 **자막 텍스트**로 바꾸면 영상 직접입력(60분 ≈ 11만 토큰) 대비 **토큰/비용을 대폭 절감**하고, 자막 세그먼트의 실제 타임스탬프로 챕터 `startSeconds`를 추정이 아니라 정확히 매길 수 있다.

## 확정된 의사결정

| 항목 | 결정 |
|---|---|
| 업로드 감지 | **YouTube WebSub(PubSubHubbub) 푸시** — "올라왔다" 트리거 전용 |
| 실데이터 소스 | **YouTube Data API v3** — 제목/길이/썸네일 + 재생목록 소속→worshipType (옵션3) |
| 스케줄/큐 | **Upstash QStash** — 단계별 메시지 + 영상별 지연 재시도(패턴 B) + 구독갱신 Schedule |
| 자막 수집 | **RapidAPI YouTube Transcript API** — 배열의 `text`를 공백 결합해 원고 텍스트화 |
| AI 요약 | **Gemini 3.5 Flash** — 자막 원고 텍스트 + 세그먼트 타임스탬프 입력, 구조화 출력 |
| 요약 산출물 | secondbrain.ai 스타일: **빠른 요약 불릿 + 타임스탬프 챕터**(클릭 시 영상 seek) |
| 새 영상 판별 | **DB `youtube_video_id` 비교가 단일 권위 기준** (시간 컷오프 폐기) |
| 요약 중복 방지 | **`summary_status='pending'` 원자적 conditional UPDATE claim** (+ stale 회수) |
| 공개 흐름 | **자동 즉시 공개**(ingest 시 `isPublished=true`). 관리자는 사후 편집·비공개만 |
| 설교자 | YouTube에서 못 얻음 → **기본값 `김선찬 담임목사`**(담임목사가 항상 설교자, `DEFAULT_PREACHER` 상수) |
| 미분류 표시 | worshipType `미분류`는 영상은 공개하되 **필터·뱃지에서만 숨김**, 관리자 지정 시 표시 |
| DB 마이그레이션 | **불필요** — 기존 `sermons` 스키마가 그대로 지원 |

## 아키텍처 / 데이터 흐름

```
[YouTube 채널 업로드]
        │ Atom XML push
        ▼
① WebSub 웹훅  GET/POST  /api/youtube/websub
   - GET : 구독 검증 — hub.challenge 에코
   - POST: HMAC(WEBSUB_SECRET) 검증 → videoId/published 파싱
           → QStash "ingest" 메시지 1건 발행 → 즉시 200 반환
        │
        ▼
② QStash 워커  /api/jobs/ingest-video           (패턴 B, 서명검증)
   a. DB에 youtube_video_id 존재? → 있으면 종료(이미 처리/중복 푸시)
   b. YouTube Data API: videos.list(제목/길이/썸네일/publishedAt)
      + 설정 재생목록 순회로 소속 확인 → worshipType + autoSummary 결정
   c. 재생목록 아직 미등록? → 30분 delay로 재발행(최대 INGEST_MAX_RETRY).
      한도 초과 시 worshipType='미분류'로 진행
   d. sermons에 upsert — **isPublished=true(즉시 공개)**, preacher=DEFAULT_PREACHER,
      youtube_video_id unique, summary_status='none'
   e. autoSummary 대상이면 → QStash "transcript" 메시지 발행
        │
        ▼
③ QStash 워커  /api/jobs/fetch-transcript        (패턴 B, 서명검증)
   a. RapidAPI Transcript 호출
   b. 자막 아직 없음? → 30분 delay 재발행(최대 TRANSCRIPT_MAX_RETRY).
      한도 초과 시 summary_status='failed'(관리자 수동 폴백)
   c. 배열의 text 공백 결합 → 원고 텍스트 + 세그먼트 타임스탬프 동봉
      → QStash "summarize" 메시지 발행
        │
        ▼
④ QStash 워커  /api/jobs/summarize               (claim 기반, 서명검증)
   a. 원자적 claim: UPDATE ... SET summary_status='pending' WHERE id=? AND status IN('none','failed')
      RETURNING * → 0건이면 이미 누가 처리중 → 종료(중복 호출 방지)
   b. Gemini 3.5 Flash(자막 원고 + 타임스탬프) → 구조화 출력
   c. Zod 검증(quickSummary 개수 상한, chapters startSeconds 오름차순·duration 이하)
   d. 성공 → quick_summary/chapters 저장 + summary_status='ready' + generated_at/model
      실패 → summary_status='failed' + summary_next_retry_at 백오프
        │
        ▼
⑤ ingest 시점에 이미 공개됨 → 공개페이지(IFrame seekTo 점프). 요약은 ④ 완료 후 채워짐.
   Admin은 사후 편집(worshipType 지정 등)·비공개 전환만 담당(검수 게이트 아님).

[별도] QStash Schedule(하루 1회) → /api/jobs/websub-renew → Google 허브에 재구독(임대 갱신)
```

### 핵심 원칙
- 단계마다 **QStash 메시지로 분리** → Vercel 함수 타임아웃 회피, 단계별 독립 재시도.
- 모든 워커 엔드포인트는 **QStash 서명검증**으로 보호(외부 무단 호출 차단). 웹훅 POST는 **WEBSUB_SECRET HMAC** 검증.
- 웹훅은 **무거운 작업 없이 즉시 200** 반환(전부 QStash 위임) → Google 재시도 폭주 방지.
- **QStash는 at-least-once 전송** → 모든 워커는 멱등(중복 수신해도 안전)해야 한다.

## 새 영상 판별 (멱등성)

- **단일 기준 = DB `youtube_video_id` 비교.** ingest 워커 진입부에서 존재하면 종료.
- 시간 컷오프(now-N일)는 폐기 — WebSub은 재구독 시에도 채널 **최근 피드 몇 건**만 재전송하므로 DB 비교만으로 과거 영상 유입이 차단된다.
- 엣지:
  - **삭제 알림**(`<at:deleted-entry>`): 새 영상 아님 → 무시(필요 시 해당 draft 비공개 처리는 범위 밖).
  - **수정 알림**(이미 DB 존재): 새 영상 아님 → 요약 재실행 안 함.

## 요약 중복 방지 (claim)

neon-http는 interactive transaction 미지원 → 읽고-쓰기 분리 시 경쟁조건. 따라서 **단일 원자적 conditional UPDATE**로 1건 선점:

```sql
UPDATE sermons
SET summary_status='pending', summary_attempts = summary_attempts + 1
WHERE id = :id
  AND ( summary_status IN ('none','failed')
        OR (summary_status='pending' AND summary_next_retry_at < now() - interval '10 min') )  -- stale 회수
  AND summary_attempts < :MAX_ATTEMPTS
RETURNING *;
```

- 0건 반환 = 이미 다른 워커가 점유 → 현재 워커 종료. Gemini는 1회만 호출.
- 크래시로 `pending` 고착 시 10분 경과 후 재claim 가능.

## 공개 표시 정책 (자동 즉시 공개에 따른 처리)

검수 게이트가 없으므로 ingest 시점에 바로 공개되고, 빈틈은 공개 페이지에서 다음과 같이 흡수한다.

- **요약 섹션 상태별 표시** (`SermonSummary`):
  - `summary_status='ready'` → 빠른요약·챕터 정상 표시.
  - 진행중(`none`/`pending`, 자막·요약 대기) → **"설교 요약 대기중.."** placeholder 표시.
  - `failed`(재시도 소진) → 요약 섹션 **숨김**(영상·메타데이터는 정상 노출).
- **설교자 기본값**: ingest 시 `preacher = DEFAULT_PREACHER`(상수 `'김선찬 담임목사'`). 담임목사가 항상 설교자이므로 null 공백 문제 없음. 향후 변경 대비 코드 상수 1곳에서 관리(특별 설교자는 관리자가 사후 수정).
- **`미분류` worshipType 노출 정책**: 영상 자체는 공개. 단 `WorshipFilter`(필터 탭)·`SermonCard`/상세 **뱃지에서는 `미분류`를 제외**해 노출하지 않음. 관리자가 worshipType를 지정하면 그때부터 필터·뱃지에 표시. (영상을 숨기는 것이 아님.)

## 데이터 모델

**마이그레이션 불필요.** 기존 `sermons`(`src/lib/db/schema.ts`)가 이미 보유:
`youtube_video_id`(unique), `duration_seconds`, `quick_summary`(jsonb string[]), `chapters`(jsonb `[{startSeconds,title,summary}]`), `summary_status`(`none|pending|ready|failed`), `summary_attempts`, `summary_next_retry_at`, `summary_generated_at`, `summary_model`, `preacher`(nullable).

- transcript 대기 재시도 횟수는 **QStash 메시지 페이로드**에 담아 재발행마다 증가(DB 컬럼 불필요).
- summarize 재시도 상한은 기존 `summary_attempts`로 판정.
- `worship_type`은 자유 텍스트(check 제약 없음) → `미분류` 등 신규 값에 마이그레이션 불필요.

## 컴포넌트 (재사용 / 변경 / 신규 / 제거)

### 재사용
- `src/lib/db/schema.ts` — 컬럼 그대로.
- `src/lib/ai/sermon-summary.ts`의 `parseSermonSummary`·Zod 스키마·`responseSchema` — 검증 로직 유지.
- `src/lib/youtube/client.ts`(`getVideoDetails`·duration 파싱), `src/lib/sermons/playlists.ts`(재생목록→worshipType 매핑) — 옵션3 소속 판별에 사용.
- Admin 테이블/편집(`src/app/admin/sermons/**`), 공개 상세(`src/app/sermons/[id]/page.tsx`), `YouTubePlayer`(seekTo) — 그대로.

### 변경
- `src/lib/ai/sermon-summary.ts` — `generateSermonSummary` 시그니처를 **영상 URL(fileData) → 자막 원고 텍스트 + 세그먼트 타임스탬프**로 교체. 프롬프트도 "영상 시청" → "자막 원고 요약, 주어진 타임스탬프로 챕터 startSeconds 산정"으로 수정. `parseSermonSummary`/Zod는 유지.
- `src/lib/sermons/summarize.ts` — claim 쿼리 유지, 요약 입력만 자막 텍스트로. QStash 워커가 호출.
- `src/components/sermons/SermonSummary.tsx` — `ready`/진행중/`failed` 3상태 분기(진행중 시 "설교 요약 대기중.." 표시).
- `src/components/sermons/WorshipFilter.tsx`·`SermonCard.tsx`(및 상세 뱃지) — worshipType `미분류` 제외 렌더.
- ingest 워커(신규) — `preacher = DEFAULT_PREACHER`, `isPublished=true`로 upsert.

### 신규
- `src/lib/youtube/websub.ts` — 구독/갱신(허브 subscribe POST), Atom 파싱(videoId·published), HMAC 검증.
- `src/lib/transcript/rapidapi.ts` — RapidAPI Transcript 호출, 배열→원고 텍스트·타임스탬프 추출, 자막 부재 판별.
- `src/lib/qstash.ts` — QStash publish 헬퍼 + `Receiver` 서명검증.
- `src/app/api/youtube/websub/route.ts` — GET(검증) / POST(알림→ingest 발행).
- `src/app/api/jobs/ingest-video/route.ts` — ②.
- `src/app/api/jobs/fetch-transcript/route.ts` — ③.
- `src/app/api/jobs/summarize/route.ts` — ④(claim 워커 호출, `maxDuration` 상향).
- `src/app/api/jobs/websub-renew/route.ts` — QStash Schedule이 호출, 허브 재구독.
- `scripts/websub-subscribe.ts` — 최초 1회 수동 구독용(배포 후 실행).

### 제거
- `src/app/api/cron/sync-sermons/route.ts`, `src/app/api/cron/summarize-sermons/route.ts`.
- `vercel.json`의 `crons` 블록, `CRON_SECRET`.
- `src/lib/sermons/sync.ts`의 전역 폴링 `syncSermons()`(재생목록 매핑 헬퍼는 별도 모듈로 보존).

## 환경 변수

```
# 신규
QSTASH_TOKEN=                 # 메시지 발행
QSTASH_CURRENT_SIGNING_KEY=   # 워커 서명검증
QSTASH_NEXT_SIGNING_KEY=
RAPIDAPI_KEY=                 # YouTube Transcript API
RAPIDAPI_TRANSCRIPT_HOST=     # RapidAPI 호스트명
WEBSUB_CALLBACK_URL=          # https://<도메인>/api/youtube/websub
WEBSUB_SECRET=                # Atom POST HMAC 검증용 hub.secret
YOUTUBE_CHANNEL_ID=           # 구독 대상 채널(topic feed)
# 유지
YOUTUBE_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=                 # 기본 gemini-3.5-flash
YT_PLAYLIST_*=                # 재생목록→worshipType 매핑 ID
# 제거
CRON_SECRET=
```

## 에러 처리

- **WebSub HMAC 불일치** → 400, 무시(위조 푸시 차단).
- **QStash 서명 불일치**(워커) → 401.
- **재생목록 미등록**(ingest) → 30분 재시도, 한도 초과 시 `미분류`로 진행(누락 방지).
- **자막 부재**(transcript) → 30분 재시도, 한도 초과 시 `summary_status='failed'` → 관리자 수동 공개 가능.
- **Gemini 실패/검증 실패** → `summary_status='failed'` + 백오프, admin "재생성" 버튼으로 재시도. 요약 없이도 공개 가능.
- **요약 무한루프 방지** → `summary_attempts >= MAX_ATTEMPTS`면 자동 워커 중단(수동만).
- **stale pending** → 10분 초과 시 재claim.
- **YouTube quota(403)/없음(404)** → 로그 후 부분 성공 허용.

## 테스트 (vitest, 외부 API 모킹)

- WebSub Atom 파싱(videoId/published 추출, deleted-entry 무시), HMAC 검증.
- RapidAPI 응답 배열 → 원고 텍스트 결합 + 타임스탬프 추출, 자막 부재 판별.
- ingest 멱등성(기존 youtube_video_id 종료), 재생목록→worshipType 매핑·미분류 폴백.
- claim 쿼리(none/failed 선택, stale 회수, MAX_ATTEMPTS 상한).
- Gemini 응답 Zod 검증(역순 startSeconds·duration 초과·빈 구간 거부) — 기존 테스트 재사용.
- QStash 서명검증 가드(잘못된 서명 401).
- `MM:SS` 포맷 유틸.

## 비용 (참고)

- 자막 텍스트 입력은 영상 직접입력 대비 토큰 1/10 수준 → 설교당 1센트 미만 예상.
- RapidAPI Transcript: 요금제별 호출 한도 내(설교당 수회 폴링).
- QStash: 무료 티어 일 메시지 한도 내 충분(설교당 ingest+transcript 폴링+summarize 수 건).

## 범위 밖 (YAGNI)

- 채널 전체 백필(과거 영상 일괄 수집) — 필요 시 별도 스크립트.
- 자막 다국어/전체 전사 노출.
- `worship_type` → `category` 리네이밍.
- 삭제 영상의 draft 자동 정리.
- STT(음성→텍스트) 폴백.
