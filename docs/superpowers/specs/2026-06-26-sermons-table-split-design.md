# sermons 테이블 생명주기별 분할 설계

- 날짜: 2026-06-26
- 브랜치: `feat/sermons-table-split`
- 대상: `src/lib/db/schema.ts`의 `sermons` 테이블 및 연관 데이터/파이프라인 코드

## 배경과 문제

`sermons` 테이블이 30개 컬럼으로 비대해졌다. 성격별로 보면 핵심 도메인(10) 대비 파생/파이프라인 데이터(썸네일 5 + 트랜스크립트 2 + AI 요약 8 = 15)가 더 많다.

핵심 통증은 **파이프라인 결합도**다. AI 자동 요약 스윕(`claimSermonById` / `summarizeClaimed` / `selectRetryTargets`)이 잡(job)을 한 번 돌 때마다 공개 사이트가 읽는 바로 그 `sermons` 도메인 행을 직접 UPDATE한다(`summary_status`, `summary_attempts` 등). 운영 상태와 도메인 데이터가 한 행에 묶여 있다.

이는 엄밀히는 중복 제거형 정규화가 아니라 **1:1 수직 분할(vertical partitioning)** 이다. 각 설교당 요약/썸네일/트랜스크립트가 정확히 하나씩이기 때문이다.

## 목표

1. AI 자동 파이프라인이 `sermons` 도메인 행을 더 이상 쓰지 않게 한다.
2. 관심사별로 테이블 경계를 명확히 분리해 가독성/유지보수성을 높인다.
3. 공개 읽기 경로의 성능 저하를 최소화한다(PK 1:1 조인만 허용).

비목표(YAGNI): 미디어 컬럼 추가 분리, 다대다 관계 도입, 기존 도메인 컬럼 재명명.

**(codex 반영) 분리의 한계 명시.** 이 작업이 줄이는 것은 **물리적·쓰기 결합도**다 — AI 자동 파이프라인이 도메인 행을 더 이상 쓰지 않게 된다. 반면 관리자 화면·썸네일 생성이 `summary`/`quickSummary`/`summaryStatus`를 교차 참조하는 **워크플로(읽기) 결합**은 그대로 남으며, 이는 본 작업 범위가 아니다. "테이블을 나눴다 = 결합이 사라졌다"가 아님을 분명히 한다.

## 테이블 레이아웃

### `sermons` (핵심 도메인 — 유지)

```text
id, title, displayTitle, preacher, seriesId, worshipType, sermonDate,
videoUrl, audioUrl, notesUrl, youtubeVideoId, durationSeconds,
thumbnailUrl, customThumbnailUrl,   -- 최종 표시용 참조 (목록 hot-path)
isPublished, createdBy, createdAt
```

### `sermon_transcripts` (1:1) — 자막 파이프라인

```text
sermonId (PK, FK → sermons.id ON DELETE CASCADE)
transcriptText        text
transcriptFetchedAt   timestamptz
```

### `sermon_summaries` (1:1) — AI 요약 파이프라인

```text
sermonId (PK, FK → sermons.id ON DELETE CASCADE)
summary               text
quickSummary          jsonb (string[])
chapters              jsonb (SermonChapter[])
summaryStatus         text NOT NULL DEFAULT 'none'
summaryAttempts       integer NOT NULL DEFAULT 0
summaryNextRetryAt    timestamptz
summaryGeneratedAt    timestamptz
summaryModel          text
createdAt             timestamptz DEFAULT now()   -- stale-pending 판정용 (아래 참조)
```

### `sermon_thumbnails` (1:1) — 썸네일 생성 작업용

```text
sermonId (PK, FK → sermons.id ON DELETE CASCADE)
thumbnailCandidates   jsonb (ThumbnailCandidate[])
thumbnailBgKeywords   text
thumbnailBackgrounds  jsonb (Partial<Record<ThumbnailStyle, string>>)
```

## 설계 판단 (확정)

1. **`thumbnailUrl` / `customThumbnailUrl`는 `sermons`에 잔류.**
   둘 다 목록 쿼리가 읽는 표시용 최종값이다(`data/sermons.ts`의 `sermonListColumns`). 위성으로 빼면 목록 조회마다 조인이 추가된다. 생성 스크래치(candidates / bgKeywords / backgrounds)만 `sermon_thumbnails`로 분리한다. `customThumbnailUrl` 쓰기는 관리자의 명시적 "적용" 액션(`composeAndApplyThumbnailAction`)이라 자동 백그라운드 스윕과 성격이 다르므로 도메인 행에 남겨도 결합도 문제가 없다.

2. **summary 콘텐츠(summary / quickSummary / chapters)도 `sermon_summaries`로 완전 이동.**
   파이프라인이 `summary_status`와 동일 트랜잭션에서 이 값들을 함께 쓴다(`summarizeClaimed`). 함께 빼야 "AI 자동 스윕이 `sermons` 행을 전혀 안 건드림"이 성립한다. 공개 읽기는 `LEFT JOIN sermon_summaries`(PK 1:1)로 처리하며 비용이 작다.

3. **stale-pending 판정 타임스탬프 이관.**
   기존 `claimSermonById`는 `sermons.created_at`을 stale pending 판정에 사용한다(`summary_status='pending'`이지만 `generated_at`/`next_retry_at`이 비고 `created_at`이 오래된 행을 재클레임). 이 의미를 `sermon_summaries.createdAt`으로 옮긴다. 위성 행은 설교 생성 시 함께 INSERT되므로 신규 행은 시점이 일치한다.
   **(codex 반영)** 단, 마이그레이션 백필 시 `sermon_summaries.createdAt`을 `now()` 기본값이 아니라 **원본 `sermons.created_at`을 복사**해 넣어야 한다. 그러지 않으면 백필 직후 모든 기존 'pending' 행의 나이가 리셋돼 재클레임 기준이 왜곡된다.

## 결합도 해소 (핵심 효과)

- `claimSermonById`: `UPDATE sermons` → `UPDATE sermon_summaries`. `RETURNING duration_seconds, transcript_text`는 더 이상 한 테이블에서 나오지 않는다. **(codex 반영)** 별도 SELECT는 claim 스냅샷과 입력 데이터를 분리시켜 동시성 틈을 만들므로, **단일 CTE문**으로 처리한다: `WITH claimed AS (UPDATE sermon_summaries ... WHERE ... RETURNING sermon_id) SELECT s.duration_seconds, t.transcript_text FROM claimed JOIN sermons s ... LEFT JOIN sermon_transcripts t ...`. UPDATE와 입력 조회가 한 문장·한 스냅샷에서 끝난다.
- `summarizeClaimed`: 성공/실패 set 대상이 `sermon_summaries`.
- `selectRetryTargets`: `summary_status`(summaries) + `transcript_text`(transcripts) + `worship_type`(sermons) 조인 쿼리로 변경.
- `fetchAndStoreTranscript`: `transcript_text`/`transcript_fetched_at` set 대상이 `sermon_transcripts`(upsert).
- 썸네일 store/actions: candidates/bgKeywords/backgrounds set 대상이 `sermon_thumbnails`(upsert). `customThumbnailUrl`/`thumbnailUrl`은 그대로 `sermons`.

결과적으로 AI 자동 요약 스윕은 `sermon_summaries`만 쓴다. 공개 사이트가 읽는 `sermons` 행은 자동 파이프라인에 의해 변경되지 않는다.

## 위성 행 생성(존재 보장)

1:1 위성 행은 claim/store UPDATE가 동작하려면 반드시 존재해야 한다. 두 가지 전략:

- **설교 생성 시 함께 INSERT**: seed / ingest / sync / 관리자 생성 경로에서 `sermon_summaries`, `sermon_transcripts`, `sermon_thumbnails` 기본 행을 함께 만든다.
- **쓰기 시점 upsert**: store/transcript 쓰기는 `INSERT ... ON CONFLICT DO UPDATE`. claim의 원자적 UPDATE는 행이 없으면 0건이 되므로, 안전하게 하려면 claim 전에 `INSERT ... ON CONFLICT DO NOTHING`으로 행을 보장한다.

채택: **생성 경로에서 함께 INSERT를 기본**으로 하고, 쓰기 경로(store/transcript)는 방어적으로 upsert를 쓴다. 마이그레이션 백필이 기존 행을 모두 채우므로 신규 경로만 보장하면 된다.

**(codex 반영) claim도 방어적으로 행을 보장한다.** "생성 시 INSERT"만으로는 seed/외부 import/수동 SQL/장애 복구 경로에서 위성 행이 빠질 수 있고, claim의 원자적 UPDATE는 행이 없으면 조용히 0건이 돼 요약이 영영 안 돈다. 따라서 위 claim CTE 앞에 `INSERT INTO sermon_summaries (sermon_id) VALUES (...) ON CONFLICT DO NOTHING`을 두어, 행 부재 시에도 안전하게 클레임되게 한다.

## 읽기 경로 변경

- `getSermons` / `getSermonsByWorshipType` / `getLatestSermons` (목록): `sermons LEFT JOIN sermon_summaries`로 `summary`, `summaryStatus` 취득. thumbnail/transcript 위성은 조인 불필요. **(codex 참고)** `getSermons`/`getSermonsByWorshipType`는 현재 `limit`이 없어 전 published 설교의 `summary` text를 다 읽는다 — 이는 분할 **이전부터 존재하던** 특성이라 본 작업 범위 밖이지만, 조인 추가 시 함께 페이지네이션/limit 도입을 검토할 수 있다.
- `getSermonById` / `getSermonForAdmin` (상세): 목록 컬럼 + `quickSummary`, `chapters`까지 `sermon_summaries`에서 취득.
- `toSermon` / `SermonListRow` 타입: 컬럼 출처가 바뀌어도 매핑 형태는 유지(조인 결과를 평탄화해 넘김).

## 마이그레이션 전략 (Neon 라이브 DB)

drizzle 마이그레이션으로 단계적 적용:

1. **마이그레이션 A — 위성 생성 + 백필**: 3개 위성 테이블 생성, `INSERT INTO <satellite> SELECT ... FROM sermons`로 기존 데이터 이관. `sermon_summaries.created_at`은 원본 `sermons.created_at`을 복사한다(위 판단 3). 이 시점엔 `sermons`의 원본 컬럼도 그대로 둔다(롤백 안전).
   - **백필 SQL은 drizzle 자동 생성에 의존하지 말고 마이그레이션 파일에 직접 작성한다.** drizzle-kit이 스키마 diff로 만드는 마이그레이션은 보통 `DROP COLUMN`만 넣고 데이터 이관 SQL은 넣지 않는다. `drizzle-kit push`(자동 동기화)는 이번 작업에 사용 금지 — 반드시 generate → 백필 SQL 수동 추가 → migrate 순서.
2. **코드 배포**: 모든 읽기/쓰기를 위성 기준으로 전환. 위성이 SoT(source of truth).
3. **마이그레이션 B — 원본 컬럼 DROP**: 배포 안정화 확인 후 `sermons`에서 이관된 13개 컬럼 DROP (`summary`, `quickSummary`, `chapters`, `summaryStatus`, `summaryAttempts`, `summaryNextRetryAt`, `summaryGeneratedAt`, `summaryModel`, `transcriptText`, `transcriptFetchedAt`, `thumbnailCandidates`, `thumbnailBgKeywords`, `thumbnailBackgrounds`).

**(codex 반영) A→배포 전환 창(window) 처리.** A 이후 신코드 배포 전까지 구버전이 `sermons` 원본 컬럼에 쓴 값은 위성에 반영되지 않는다. ycc-website는 Vercel **단일 atomic 배포**이고 해당 쓰기는 관리자 액션/크론(저동시성)이라 dual-write·트리거까지는 과하다. 대신 **B 직전에 백필을 한 번 더 멱등(idempotent)하게 재실행**(`INSERT ... ON CONFLICT DO UPDATE`로 위성이 비었거나 더 오래된 경우만 갱신)해 전환 창의 누락분을 흡수한 뒤 DROP한다.

**(codex 반영) 인덱스.** `selectRetryTargets`/claim이 `summary_status`, `summary_attempts`, `summary_next_retry_at`로 필터하므로 `sermon_summaries(summary_status, summary_next_retry_at)` 부분 인덱스(또는 복합 인덱스)를 추가한다. `sermons_published_date_idx`는 `(is_published, sermon_date)`로 sermons에 남는다(목록 정렬·필터는 sermons 컬럼만 사용).

## 영향 받는 코드

- `src/lib/db/schema.ts` — 위성 테이블 3개 추가, sermons 컬럼 정리, `$inferSelect` 타입 추가.
- `src/lib/data/sermons.ts` — 목록/상세 조인 쿼리, 컬럼셋, `toSermon` 매핑.
- `src/lib/sermons/summarize.ts` — claim / summarize / retry / transcript 저장 테이블 교체.
- `src/lib/thumbnails/store.ts`, `src/lib/actions/thumbnails.ts` — candidates/bgKeywords/backgrounds 테이블 교체(upsert), summary 조회 출처 변경(`resolveBgKeywords`, `suggestThumbnailTextAction`이 `summary`/`quickSummary`를 읽음).
- 생성 경로: `src/lib/seed/sermons.ts`, `scripts/seed*.ts`, `src/lib/sermons/ingest.ts`, `src/lib/sermons/sync.ts` — 위성 기본 행 함께 생성.
- 잡 라우트: `src/app/api/jobs/summarize`, `fetch-transcript`, `retry-summaries`, `ingest-video` — 위성 기준으로 동작 확인.
- **(codex 반영) 추가 누락 지점**: `src/lib/data/admin-dashboard.ts`(`summaryStatus` groupBy·`failed` 카운트), `src/lib/actions/sermons.ts`(`summaryStatus` 조회), `scripts/summarize-sermons.ts`(배치 요약) — 모두 이관 컬럼을 직접 읽으므로 위성 조인으로 전환.
- 테스트: `schema.test.ts`, `data/sermons.test.ts`, `sermons/sync.test.ts`, `actions/thumbnails.test.ts`, `ai/sermon-summary.test.ts` 등.

## 테스트 전략

- **단위**: claim의 원자성(중복 클레임 차단), stale-pending 재클레임, 백오프(next_retry) 계산은 위성 기준으로 기존 테스트 이식·보강.
- **조인 정합성**: `getSermons`/`getSermonById`가 위성 NULL(요약 미생성)일 때도 `summaryStatus='none'` 기본값으로 올바르게 매핑되는지(LEFT JOIN).
- **위성 행 존재**: 신규 설교 생성 시 3개 위성 행이 생기는지, store/transcript upsert가 행 부재 시에도 동작하는지.
- **마이그레이션 백필**: 기존 행 → 위성 이관 후 데이터 일치(샘플 비교).

## 롤백

마이그레이션 A는 비파괴(원본 컬럼 잔류)라 코드 롤백만으로 복구 가능. 마이그레이션 B(DROP) 이후엔 위성이 SoT이므로 롤백 시 역방향 백필 필요 — B는 충분한 안정화 후 별도 PR로 분리한다.
