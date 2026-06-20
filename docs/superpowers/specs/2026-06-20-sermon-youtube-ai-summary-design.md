# 설교 YouTube 동기화 + AI 요약 설계

**작성일**: 2026-06-20
**상태**: 설계 확정 (구현 계획 대기)

## 목적

교회 YouTube 채널의 예배/설교 영상을 자동으로 끌어와 사이트의 `sermons`에 등록하고,
Gemini로 **빠른 요약(~10줄)** 과 **타임스탬프별 요약**(secondbrain.ai 스타일)을 생성한다.
관리자는 자동 생성된 초안을 검수한 뒤 공개한다.

## 확정된 의사결정

| 항목 | 결정 |
|---|---|
| 수집 방식 | 교회 YouTube **재생목록 자동 동기화** (채널 전체 아님) |
| AI 요약 소스 | **Gemini에 YouTube URL 직접 입력** (자막 추출 X, STT X) |
| 검수 흐름 | **자동 생성(draft) → 관리자 수동 공개** |
| 동기화 트리거 | **Vercel Cron 자동 + admin "지금 동기화" 버튼** (둘 다) |
| 타임스탬프 저장 | sermons 테이블의 **jsonb 컬럼** (별도 테이블 아님) |
| 요약 실행 단위 | **영상당 개별 호출** (일괄 X — 타임아웃 회피) |
| 플레이어 점프 | **YouTube IFrame Player API** (`seekTo`) |

### 자막 대신 Gemini를 쓰는 이유
- YouTube 공식 API는 **자동 생성 자막을 다운로드할 수 없음**(수동 업로드 자막만 가능).
- 비공식 `timedtext` 스크래핑은 구글이 데이터센터 IP를 차단 → Vercel 서버에서 불안정.
- Gemini는 구글이 서버사이드로 영상을 직접 처리 → OAuth·스크래핑·IP차단 불필요, 자막 없어도 동작.
- 단, 영상이 **공개(public) 또는 미등록(unlisted)** 이어야 한다. 비공개는 불가.

## 동기화 대상 재생목록

설정 맵: `playlistId → { worshipType, autoSummary }`

| 재생목록 | worshipType | autoSummary |
|---|---|---|
| 주일예배 | `주일예배` | ✅ |
| 주일찬양예배 | `주일찬양예배` | ✅ |
| 수요예배 | `수요예배` | ✅ |
| 금요기도회 | `금요기도회` | ✅ |
| 시온찬양대 | `시온찬양대` | ❌ (순수 찬양) |
| 특송 | `특송` | ❌ (순수 찬양) |
| 특별행사 | `특별행사` | ❌ (혼합 — 관리자 수동) |

- `autoSummary=false`인 재생목록도 동기화는 되며, admin의 "요약 생성" 버튼으로 수동 트리거 가능.
- 실제 playlist ID는 구현 시 `.env.local`에 채운다. (주일예배는 YouTube 팟캐스트 형태지만 내부 playlist ID로 접근 가능.)

## 사전 준비물 (env)

```
YOUTUBE_API_KEY=        # YouTube Data API v3
GEMINI_API_KEY=         # Gemini (영상 이해)
CRON_SECRET=            # cron 엔드포인트 보호용
# 재생목록 ID → worshipType/autoSummary 매핑은 코드 상수 + env의 ID로 구성
YT_PLAYLIST_SUNDAY=
YT_PLAYLIST_SUNDAY_PRAISE=
YT_PLAYLIST_WEDNESDAY=
YT_PLAYLIST_FRIDAY=
YT_PLAYLIST_CHOIR=
YT_PLAYLIST_SPECIAL_SONG=
YT_PLAYLIST_SPECIAL_EVENT=
```

## 데이터 모델 (Drizzle: sermons 테이블 확장)

기존 `summary`(text)는 카드/OG용 짧은 한 줄 소개로 유지. 추가 컬럼:

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `youtube_video_id` | text **unique** | 동기화 중복 방지 키 |
| `duration_seconds` | integer | YouTube `contentDetails.duration` 파싱 |
| `quick_summary` | jsonb | `string[]` — 빠른 요약 불릿 ~10개 |
| `chapters` | jsonb | `[{ startSeconds:int, title:string, summary:string }]` |
| `summary_status` | text | `none \| pending \| ready \| failed` (기본 `none`) |
| `summary_generated_at` | timestamptz | 요약 생성 시각 |
| `summary_model` | text | 사용 모델 식별자(감사용) |

- jsonb 선택 근거: 항상 설교와 함께 읽고, 기존 `bulletins.sections` jsonb 패턴과 일치. 조인 불필요.
- `worship_type` 컬럼은 자유 텍스트(check 제약 없음) → enum 확장에 **마이그레이션 불필요**.
- 새 컬럼 추가용 Drizzle 마이그레이션 1건 생성 필요.

### 타입 변경 (`src/lib/types.ts`)
- `WorshipType`을 7종으로 확장: 기존 4종 + `시온찬양대 | 특송 | 특별행사`.
- `SermonChapter { startSeconds:number; title:string; summary:string }` 추가.
- `Sermon`에 `quickSummary?: string[]`, `chapters?: SermonChapter[]`, `durationSeconds?: number`,
  `youtubeVideoId: string`, `summaryStatus: 'none'|'pending'|'ready'|'failed'` 추가.

## 컴포넌트 구조

### 1. YouTube 클라이언트 — `src/lib/youtube/client.ts`
- `listPlaylistVideos(playlistId)`: `playlistItems.list`로 영상 ID/제목/publishedAt/썸네일 수집(페이지네이션).
- `getVideoDetails(ids[])`: `videos.list?part=contentDetails`로 길이(ISO8601 duration) 보강.
- ISO8601 duration → 초 변환 유틸. 403 quota / 404 오류 핸들링.
- 의존: `YOUTUBE_API_KEY`.

### 2. 동기화 — `src/lib/sermons/sync.ts`
- `syncSermons()`: 설정 맵의 모든 재생목록을 순회.
  - 각 영상의 `youtube_video_id`가 이미 있으면 skip(중복 방지).
  - 새 영상만 **draft**로 insert: `isPublished=false`, `summary_status='none'`,
    `worshipType`=재생목록 매핑값, `title`=영상 제목, `sermonDate`=publishedAt(date),
    `thumbnailUrl`=썸네일, `videoUrl`=`https://youtu.be/{id}`, `youtubeVideoId`=id, `durationSeconds`.
  - `preacher`는 YouTube에서 신뢰성 있게 얻기 어려움 → 공란/기본값으로 두고 관리자가 검수에서 채움.
  - 반환: 재생목록별 신규 삽입 건수 요약.
- 메타데이터만 빠르게 처리(요약 호출은 분리).

### 3. AI 요약 — `src/lib/ai/sermon-summary.ts`
- `generateSermonSummary(videoUrl): Promise<{ summary; quickSummary: string[]; chapters: SermonChapter[] }>`
  - Gemini API에 YouTube URL을 `fileData` 파트로 전달 + **구조화 출력(response JSON schema)** 강제.
  - 한국어 출력, 낮은 temperature. 모델: **`gemini-3.5-flash`** (2026-05 GA, YouTube URL 영상 입력 지원), env/상수로 교체 가능.
  - 프롬프트 요구사항: ① 한 줄 소개(`summary`) ② 빠른 요약 불릿 ~10개(`quickSummary`)
    ③ 타임스탬프 구간 요약(`chapters`, `startSeconds` 오름차순).
- 실패 시 throw → 호출부가 `summary_status='failed'`로 기록.

### 4. 요약 오케스트레이션 — `src/lib/sermons/summarize.ts`
- `generateAndStoreSummary(sermonId)`:
  - `summary_status='pending'`으로 표시 → `generateSermonSummary` 호출 → 성공 시 컬럼 저장 +
    `status='ready'`, `summary_generated_at`, `summary_model`. 실패 시 `status='failed'`.
- **영상당 1 요청**으로 처리해 Vercel 함수 타임아웃 회피.
  - ⚠️ Vercel 플랜별 `maxDuration` 한계(Hobby 60s). 해당 라우트에 `maxDuration` 상향 설정.
    60분 영상 1건 ≈ 30~90초 예상.

### 5. 트리거 엔드포인트 / 액션
- Cron: `src/app/api/cron/sync-sermons/route.ts` — `CRON_SECRET` 검증 → `syncSermons()` →
  `autoSummary=true`이고 `summary_status='none'`인 신규 설교에 대해 per-sermon `generateAndStoreSummary` 호출.
  Vercel cron 스케줄은 `vercel.json`에 정의(예: 매주 월요일).
- 수동: admin 서버 액션 `syncNow()`(동기화), `generateSummary(sermonId)`(단건 요약/재생성),
  `updateSermon(...)`, `togglePublish(id)`. 모두 기존 `verifySession`/DAL로 가드.

### 6. Admin UI (현재 스텁 → 실제 구현)
- `src/app/admin/sermons/page.tsx`: DB 기반 실제 테이블.
  - 컬럼: 날짜/제목/설교자/예배종류/공개여부/요약상태 배지.
  - 상단 "지금 동기화" 버튼. 행별 액션: 편집 / 요약 생성 / 공개 토글.
- `src/app/admin/sermons/[id]/edit/page.tsx`: 메타데이터 편집(preacher, worshipType, scripture, series) +
  생성된 빠른요약·챕터 확인/수정 + "요약 재생성" + 공개 토글.

### 7. 공개 페이지 — `src/app/sermons/[id]/page.tsx` + 컴포넌트
- `src/components/sermons/YouTubePlayer.tsx`(신규, client): **IFrame Player API** 래퍼.
  타임스탬프 클릭 시 `player.seekTo(startSeconds)`로 영상 점프.
- 상세 페이지 섹션:
  - **빠른 요약**: `quickSummary` 불릿 목록.
  - **타임라인 요약**: `chapters`를 `MM:SS · 제목` 클릭형 목록 + 구간 요약 텍스트. 클릭 → 플레이어 seek.
  - 요약이 없으면(`summaryStatus !== 'ready'`) 해당 섹션은 숨김(기존 조건부 렌더 유지).

## 에러 처리

- Gemini 실패 → `summary_status='failed'`, admin에 노출, "재생성" 버튼으로 재시도. 공개는 요약 없이도 가능.
- YouTube quota(403)/영상 없음(404) → 동기화 로그에 남기고 부분 성공 허용.
- 중복 → `youtube_video_id` unique 제약 + insert 전 존재 확인.
- 비공개/삭제 영상 → Gemini 오류 → `failed` 처리.

## 테스트 (vitest, 이미 도입됨)

- 외부 API는 **모킹**(실제 호출 금지).
- 단위 테스트 대상:
  - YouTube 응답 파싱 + ISO8601 duration → 초 변환.
  - 동기화 중복 제거 로직(기존 video_id skip).
  - 재생목록 → worshipType/autoSummary 매핑.
  - Gemini 응답 스키마 검증/파싱(잘못된 형태 거부).
  - `MM:SS` 포맷 유틸.

## 비용 (참고)

- Gemini 3.5 Flash: 설교당 1회(≈ 입력 11만 토큰/60분), 수 센트 수준. DB에 1회 저장 후 재사용.
  - 무료 티어는 YouTube 영상 일 8시간 한도, 유료 티어는 영상 길이 무제한.
- YouTube Data API: list 호출은 무료 쿼터(일 10k units) 내 충분.

## 범위 밖 (YAGNI)

- 채널 전체 크롤링(재생목록 한정).
- 자막/STT 파이프라인.
- `worshipType` 필드명 → `category` 리네이밍(의미상 맞지만 별도 작업).
- 별도 `sermon_chapters` 정규화 테이블.
- 요약 다국어 번역, 전체 전사(transcript) 노출.
