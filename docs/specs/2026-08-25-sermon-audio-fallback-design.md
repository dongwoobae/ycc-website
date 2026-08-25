# 자막 없는 설교 영상 오디오 폴백 설계

**작성일**: 2026-08-25
**상태**: 설계 확정 (구현 계획 대기)
**관련**: `2026-06-23-youtube-websub-pipeline-design.md`의 "범위 밖 — STT(음성→텍스트) 폴백"을 이번 설계로 도입한다. 기존 파이프라인(WebSub→ingest→fetch-transcript→summarize)은 그대로 두고 `fetch-transcript`가 포기하는 지점에 새 단계를 끼워 넣는 확장이다.

## 배경

`fetch-transcript`는 유튜브 자동자막이 준비될 때까지 12회(30분 간격, 총 6시간) 재시도하다가 끝내 실패하면 `summary_status='no_transcript'`로 종결하고, 이 상태는 어떤 스위퍼도 재시도하지 않는다(`selectRetryTargets`가 명시적으로 제외). 최근 2개월간 실제 설교(찬양 계열 제외) 중 3건이 이 종결 상태에 빠져 요약이 전혀 생성되지 않았다. 목회자·성도가 매일 설교 요약을 실사용 중이라 이 공백을 메울 필요가 생겼다.

## 확정된 의사결정

| 항목 | 결정 |
| --- | --- |
| 재시도 축소 | `MAX_TRANSCRIPT_RETRY` 12 → **6**(3시간). 폴백이 이어받으므로 총 대기시간만 3시간 단축, 손해 없음 |
| 오디오 확보 방법 | **자체 오디오 추출 없음.** Gemini `generateContent`에 유튜브 워치 URL을 `fileData.fileUri`로 직접 전달(영상 다운로드는 구글 서버가 수행) |
| 트리거 조건 | `fetch-transcript`가 6회 소진되는 시점 = 기존에 `no_transcript`를 세팅하던 바로 그 지점. 찬양 계열은 애초에 `expectsAutoSummary`가 걸러 이 경로에 들어오지 않으므로 별도 필터 불필요 |
| 받아쓰기 모델 | `gemini-3.1-pro-preview`(1차) → 일시 오류 시 `gemini-3.5-flash`(폴백). `gemini-2.5-pro`는 신규 사용자 대상 서비스 종료(404) 확인되어 후보에서 제외 |
| 받아쓰기 출력 형식 | `"[MM:SS] 발화"` 줄 단위 — 기존 자막 원고와 동일 형식으로 맞춰 `generateSermonSummary`를 그대로 재사용 |
| 요약 프롬프트 개선 | 전체 길이(`durationSeconds`)와 기대 챕터 수를 프롬프트에 명시하고 "챕터당 900초 초과 금지"를 강제 지시로 추가. 오디오 폴백 여부와 무관하게 **전체 파이프라인**에 적용 |
| HTTP 타임아웃 | Node 기본 undici `headersTimeout`(5분)이 긴 오디오 처리(4~5분)와 맞물려 간헐적으로 `fetch failed`를 유발함을 확인. 오디오 변환 호출 경로에 `headersTimeout`/`bodyTimeout`을 10분으로 올린 커스텀 dispatcher 적용 |
| 인프라 | **Vercel Hobby 유지, Python 런타임 불필요.** 오디오 다운로드 자체가 없어졌으므로 새 job(`fetch-audio-transcript`)의 `maxDuration`만 Hobby 상한(300초)으로 올리면 충분 |
| 최종 실패 시 | 폴백까지 실패하면 기존과 동일하게 `no_transcript`로 종결 |
| 수동 재생성 경로 | 관리자 "요약 재생성" 버튼(`fetchAndStoreTranscript`)의 RapidAPI 실패 분기에도 같은 오디오 변환 로직을 태운다 — 자동 경로(잡 체인)와 수동 경로가 오디오 변환 함수를 공유 |
| 기존 `no_transcript` 3건 | 별도 백필 스크립트 없이, 배포 후 관리자가 해당 3건에서 "요약 재생성" 버튼을 눌러 수동으로 해소 |

## 검토했지만 기각한 대안

실제 호출·배포로 검증한 뒤 기각했다.

- **Daglo API**: 개발자 API가 유튜브 URL이 아니라 직접 접근 가능한 미디어 파일 URL만 받는다(`audio.source.url`에 GCS 예시). 결국 오디오 자체 추출이 그대로 필요해 아래 "자체 구축" 안과 문제가 같으면서 벤더만 하나 늘어난다.
- **Lilys AI API**: `sourceType: youtube_video` + `sourceUrl`로 유튜브 URL을 직접 받고 `originalScript`(전체 대본)까지 반환하는 것을 확인했다(`reference.lilys.ai`). 다만 과금이 "Perfect Summary" 기준 유튜브 영상 **10분당 3,000원**으로 확인되어, 설교 1편(40~70분)당 12,000~28,000원 수준 — Gemini 오디오 입력(편당 약 55~80원)의 100배 이상이라 월 1~3건이어도 배제.
- **자체 구축(yt-dlp/youtube-dl 계열) + Vercel Python 함수**: `@distube/ytdl-core`(2025-08 아카이브됨), `youtubei.js`(활발히 유지보수 중이나 "No valid URL to decipher"로 실패) 둘 다 로컬에서 실패. `yt-dlp`(Python)는 로컬(주거용 IP)에서는 성공했지만, **Vercel 익명 임시 배포로 실제 검증한 결과 클라우드 IP에서 유튜브 봇 탐지("Sign in to confirm you're not a bot")에 즉시 차단됨을 확인**. 우회하려면 쿠키 수동 갱신(주기적 로그인 필요) 또는 유료 주거용 프록시가 필요해, "벤더 없이 무료로"라는 전제가 무너진다.
- **y2mate 등 유튜브→mp3 변환 사이트 스크래핑**: 공식 API가 없고 전부 비공식 리버스엔지니어링 래퍼뿐이다. 결국 같은 유튜브 봇 탐지·서명 변경 문제를 남의 서버에서 겪는 구조이며, 이런 서비스는 자체 봇 차단·저작권 소송에 의한 서비스 중단 전례(youtube-mp3.org, 2017)가 있어 공식 파이프라인이 의존하기에 리스크가 크다.
- **Vercel Pro 업그레이드**: Hobby의 함수 실행시간 고정 5분 한계를 넘기 위해 검토했으나, 오디오를 직접 다운로드하지 않는 최종안에서는 실행시간 여유가 충분해 불필요. 월 $20 고정비가 이 기능의 AI 비용(월 200원 미만)보다 훨씬 크다는 점도 배제 사유.

## 아키텍처 / 데이터 흐름

```
③ QStash 워커  /api/jobs/fetch-transcript   (변경: MAX_TRANSCRIPT_RETRY 12→6)
   a. RapidAPI 자막 조회 (기존과 동일)
   b. 자막 미준비 & attempt < 6 → 30분 delay 재발행 (기존과 동일)
   c. 6회 소진 → (신규) QStash "fetch-audio-transcript" 메시지 발행 후 종료
        │
        ▼
③-b QStash 워커  /api/jobs/fetch-audio-transcript   (신규, maxDuration=300)
   a. sermons에서 durationSeconds 조회
   b. Gemini generateContent({ fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` } })
      + "[MM:SS] 발화" 형식 강제 프롬프트
      → gemini-3.1-pro-preview 1차, 일시 오류 시 gemini-3.5-flash 폴백
   c. 성공 → storeTranscript(sermonId, 결과 텍스트) → 기존 ④ summarize 그대로 발행
      실패(비일시 오류, 혹은 폴백까지 소진) → summary_status='no_transcript' (기존과 동일한 최종 상태)
        │
        ▼
④ QStash 워커  /api/jobs/summarize   (변경 없음, 프롬프트만 개선)
   - PROMPT에 durationSeconds·기대 챕터 수 명시, "챕터 900초 초과 금지" 강제 지시 추가

[별도] 관리자 "요약 재생성" 버튼 → generateSummaryAction → manualSummarize
   → fetchAndStoreTranscript: RapidAPI 1회 시도 실패 시 (신규) 같은 오디오 변환 함수 호출
   → 기존 no_transcript 3건은 이 버튼으로 수동 해소(백필 스크립트 불필요)
```

### 핵심 원칙

- 오디오 폴백은 **별도 job으로 분리**한다 — `fetch-transcript`는 지금처럼 가볍게 유지하고, 4~5분 걸리는 Gemini 오디오 호출만 별도 함수(`maxDuration=300`)로 격리해 기존 `fetch-transcript`의 60초 예산에 영향을 주지 않는다.
- 오디오 폴백의 출력 계약은 기존 `transcriptText`와 **동일**하다 — `summarize` job은 자막 출처가 RapidAPI인지 Gemini 오디오 변환인지 구분하지 않는다.
- 오디오 변환 로직은 **자동 job과 수동 재생성 버튼이 같은 함수를 공유**한다 — 트리거 경로만 다르고 구현은 하나.

## 컴포넌트 (변경 / 신규)

### 변경

- `src/app/api/jobs/fetch-transcript/route.ts` — `MAX_TRANSCRIPT_RETRY` 12→6, give-up 분기에서 `no_transcript` 직접 세팅 대신 `fetch-audio-transcript` job 발행.
- `src/lib/qstash.ts` — `JobName` 유니온에 `'fetch-audio-transcript'` 추가.
- `src/lib/ai/gemini.ts` — `generateContentWithFallback`을 모델 배열(`[gemini-3.1-pro-preview, gemini-3.5-flash]`) 순차 시도로 일반화. 기존 텍스트 요약 호출(`[3.5-flash, 2.5-flash]`)도 같은 함수로 통합.
- `src/lib/ai/sermon-summary.ts` — `PROMPT`에 `durationSeconds`·기대 챕터 수(`Math.round(durationSeconds/600)`)를 보간하고 "챕터 900초 초과 금지, 초과 시 반드시 분할" 지시 추가.
- `src/lib/sermons/summarize.ts` — `fetchAndStoreTranscript`가 RapidAPI 실패(`자막 미준비`) 시 바로 던지지 않고, 신규 오디오 변환 함수를 호출해 성공하면 그 텍스트를 저장·반환. 이 함수는 자동 job(`fetch-audio-transcript`)과 수동 `manualSummarize` 양쪽에서 재사용된다.
- `src/app/admin/sermons/[id]/edit` 라우트(또는 서버 액션 파일) — 오디오 변환이 최대 4~5분 걸릴 수 있으므로 `maxDuration`을 300으로 상향.

### 신규

- `src/app/api/jobs/fetch-audio-transcript/route.ts` — 위 아키텍처의 ③-b. QStash 서명검증 필수(기존 워커 패턴과 동일). 실제 오디오 변환은 아래 공용 함수를 호출하기만 한다.
- `src/lib/ai/audio-transcript.ts`(가칭) — 유튜브 URL 기반 오디오 받아쓰기 프롬프트·모델 폴백·`"[MM:SS] 발화"` 파싱을 담은 **공용 함수**(자동 job·수동 재생성 버튼 공통 사용). 커스텀 undici dispatcher(`headersTimeout`/`bodyTimeout` 10분) 적용.

## 에러 처리

- **오디오 변환 자체 오류(비일시)**: 재시도 없이 즉시 `no_transcript`로 종결(기존 정책 유지 — "재시도해도 소용없는 종결 상태").
- **일시 오류(503 등)**: `gemini-3.1-pro-preview` → `gemini-3.5-flash` 1회 폴백. 그래도 실패하면 `no_transcript`.
- **`headersTimeout`으로 인한 `fetch failed`**: 커스텀 dispatcher로 완화하되, 완전히 배제되지는 않으므로 모델 폴백 루프가 이 경우도 함께 흡수한다(재현 시 로그로 빈도 확인 필요 — 미결 사항 참고).

## 비용 (참고)

- Gemini 오디오 입력: 실측 기준 편당(40~70분) 요청 1회당 약 4~5분 소요, Flash 공개 단가(시간당 약 $0.057) 기준 편당 55~80원 수준. Pro 티어 단가는 미확인이나 이 볼륨(월 1~3건)에서는 무시 가능.
- 월 1~3건 기준 총 추가 비용은 수백 원 이내로, 기존 텍스트 요약 비용과 같은 자릿수.

## 테스트

- `fetch-transcript`: `MAX_TRANSCRIPT_RETRY=6` 경계값, 소진 시 `fetch-audio-transcript` 발행(기존 `no_transcript` 직접 세팅 대신).
- `generateContentWithFallback`: 모델 배열 일반화 후 기존 텍스트 요약 폴백 동작 회귀 테스트.
- `audio-transcript`: `"[MM:SS] 발화"` 파싱, 일시 오류 시 폴백 모델 전환.
- `sermon-summary` 프롬프트: `durationSeconds` 보간 값 검증, 챕터 900초 초과 시 실패하는 회귀 케이스(가능하면 스냅샷보다는 프롬프트 문자열 포함 여부 검증).
- `fetchAndStoreTranscript`: RapidAPI 실패 시 오디오 변환 함수 호출로 폴백, 오디오 변환도 실패하면 기존과 동일하게 에러 throw(관리자 화면에 메시지 노출).

## 실측 검증 기록 (참고용 원자료)

같은 실제 설교 영상(69분, `sermons.duration_seconds=4140`)을 RapidAPI 자막 기반 기존 요약과 Gemini 오디오 기반 요약으로 각각 생성해 비교했다.

| | 기존(RapidAPI 자막) | 최종안(유튜브 URL 직접 입력 + 프롬프트 개선) |
| --- | --- | --- |
| 한 줄 요약 | 여호수아 1:9 말씀으로 두려움을 이기고 인생의 문지방을 넘으십시오 | 두려움을 넘어 말씀으로 문지방을 건너는 믿음 (여호수아 1:9) |
| 핵심 요점 개수 | 12 | 12 |
| 챕터 개수 | 7 | 7 |
| 최대 챕터 길이 | 600초 | 708초 (900초 이내) |

프롬프트 개선 이전(전체 길이 미명시) 버전은 같은 오디오 받아쓰기로 챕터 5개(최대 2048초, 900초 제한 위반)가 나와 개선이 필요함을 확인했다.

## 미결 사항

1. `gemini-3.1-pro-preview`가 실제 서비스 시점에도 유튜브 URL 직접 입력을 지원하는지 — 현재 "preview" 태그이므로 정식 버전 전환/모델 교체 가능성을 배포 전 재확인.
2. Gemini의 유튜브 URL 직접 입력 기능 자체가 아직 프리뷰(무료) 상태 — 정식화 시 과금 정책이 붙을 수 있어 유지보수 시 확인 필요.
3. `fetch-audio-transcript`의 `maxDuration=300`이 실제 최장 설교(설교 길이 상한 확인 필요, 현재 최대 확인된 사례는 약 70분)에서도 여유 있게 처리되는지 프로덕션 배포 후 1건은 실측 확인.
4. `headersTimeout` 관련 "fetch failed"가 프로덕션(Vercel Node 런타임)에서도 동일하게 재현되는지 — 로컬에서는 undici 전역 dispatcher로 완화했으나 Vercel 런타임에서 같은 설정이 유효한지 미확인.

## 범위 밖 (YAGNI)

- 오디오 변환 결과와 RapidAPI 자막을 비교해 더 나은 쪽을 자동 선택하는 로직 — 애초에 RapidAPI가 실패한 경우에만 타는 경로라 해당 없음.
- 오디오 변환 결과를 별도로 캐시/재사용하는 기능 — 월 1~3건뿐이라 불필요.
- Lilys AI 등 벤더 API로의 이중 폴백 — 필요성이 확인되면 별도 설계.
