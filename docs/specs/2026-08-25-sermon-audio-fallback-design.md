# 자막 없는 설교 영상 오디오 폴백 설계

**작성일**: 2026-08-25
**상태**: 배포 완료 (2026-08-27). 남은 `no_transcript` 3건까지 해소했으나 미결 #7이 그 과정에서 재현됐다 — "미결 사항" 참고
**관련**: `2026-06-23-youtube-websub-pipeline-design.md`의 "범위 밖 — STT(음성→텍스트) 폴백"을 이번 설계로 도입한다. 기존 파이프라인(WebSub→ingest→fetch-transcript→summarize)은 그대로 두고 `fetch-transcript`가 포기하는 지점에 새 단계를 끼워 넣는 확장이다.

## 배경

`fetch-transcript`는 유튜브 자동자막이 준비될 때까지 12회(30분 간격, 총 6시간) 재시도하다가 끝내 실패하면 `summary_status='no_transcript'`로 종결하고, 이 상태는 어떤 스위퍼도 재시도하지 않는다(`selectRetryTargets`가 명시적으로 제외). 최근 2개월간 실제 설교(찬양 계열 제외) 중 3건이 이 종결 상태에 빠져 요약이 전혀 생성되지 않았다. 목회자·성도가 매일 설교 요약을 실사용 중이라 이 공백을 메울 필요가 생겼다.

## 확정된 의사결정

| 항목                     | 결정                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 재시도 축소              | `MAX_TRANSCRIPT_RETRY` 12 → **6**(3시간). 폴백이 이어받으므로 총 대기시간만 3시간 단축, 손해 없음                                                                                                                                                                                                                                                                           |
| 오디오 확보 방법         | **자체 오디오 추출 없음.** Gemini `generateContent`에 유튜브 워치 URL을 `fileData.fileUri`로 직접 전달(영상 다운로드는 구글 서버가 수행)                                                                                                                                                                                                                                    |
| 트리거 조건              | `fetch-transcript`가 6회 소진되는 시점 = 기존에 `no_transcript`를 세팅하던 바로 그 지점. 찬양 계열은 애초에 `expectsAutoSummary`가 걸러 이 경로에 들어오지 않으므로 별도 필터 불필요                                                                                                                                                                                        |
| 받아쓰기 모델            | `gemini-3.1-pro-preview` → `gemini-3.1-pro`(preview 단종 시 정식 출시명) → `gemini-3.5-flash` → `gemini-2.5-flash`, 4단 순차 폴백. `generateContentWithFallback`은 503 등 일시 오류뿐 아니라 404(모델 단종)도 다음 모델로 넘기도록 판별을 넓힌다. `gemini-2.5-pro`는 신규 사용자 대상 서비스 종료(404) 확인되어 후보에서 제외                                               |
| 받아쓰기 출력 형식       | Gemini에는 `"[MM:SS] 발화"` 줄 단위로 요청하지만, 1시간을 넘는 설교에서 모델이 `[H:MM:SS]`로 바꿔 쓰는 경우를 실측으로 확인함. 그대로 문자열 결합하지 않고 `TranscriptSegment[]`(`{startSeconds, text}`)로 파싱해 `fetchTranscript`와 동일한 반환 타입을 맞추고, 기존 `storeTranscript`/`buildTranscriptText`로 재직렬화해 항상 정규화된 `MM:SS`(총분:초) 형식으로 저장한다 |
| 요약 프롬프트 개선       | 전체 길이(`durationSeconds`)와 기대 챕터 수를 프롬프트에 명시하고 "챕터당 900초 초과 금지"를 강제 지시로 추가. 오디오 폴백 여부와 무관하게 **전체 파이프라인**에 적용                                                                                                                                                                                                       |
| HTTP 타임아웃            | Node 기본 undici `headersTimeout`(5분)이 긴 오디오 처리(4~5분)와 맞물려 간헐적으로 `fetch failed`를 유발함을 확인. 오디오 변환 호출 경로에 `headersTimeout`/`bodyTimeout`을 10분으로 올린 커스텀 dispatcher 적용                                                                                                                                                            |
| 인프라                   | **Vercel Hobby 유지, Python 런타임 불필요.** 오디오 다운로드 자체가 없어졌으므로 새 job(`fetch-audio-transcript`)의 `maxDuration`만 Hobby 상한(300초)으로 올리면 충분                                                                                                                                                                                                       |
| 최종 실패 시             | 폴백까지 실패하면 기존과 동일하게 `no_transcript`로 종결                                                                                                                                                                                                                                                                                                                    |
| 수동 재생성 경로         | 관리자 "요약 재생성" 버튼은 **자동 파이프라인 job을 발행하고 즉시 반환**한다(`requestSummaryRegeneration`). 자막이 캐시돼 있으면 `summarize`를, 없으면 `fetch-transcript`를 `attempt`가 상한에 찬 상태로 발행해 RapidAPI 1회 실패 즉시 오디오 폴백으로 넘긴다. 인라인 실행은 받아쓰기(실측 329초)와 요약(실측 222초)이 한 함수에 겹쳐 Vercel 300초 예산을 넘기므로 폐기     |
| 기존 `no_transcript` 3건 | 별도 백필 스크립트 없이, 배포 후 관리자가 해당 3건에서 "요약 재생성" 버튼을 눌러 해소. 버튼이 job을 발행하므로 결과는 몇 분 뒤 상태 표시로 확인한다                                                                                                                                                                                                                         |

## 검토했지만 기각한 대안

실제 호출·배포로 검증한 뒤 기각했다.

- **Daglo API**: 개발자 API가 유튜브 URL이 아니라 직접 접근 가능한 미디어 파일 URL만 받는다(`audio.source.url`에 GCS 예시). 결국 오디오 자체 추출이 그대로 필요해 아래 "자체 구축" 안과 문제가 같으면서 벤더만 하나 늘어난다.
- **Lilys AI API**: `sourceType: youtube_video` + `sourceUrl`로 유튜브 URL을 직접 받고 `originalScript`(전체 대본)까지 반환하는 것을 확인했다(`reference.lilys.ai`). 다만 과금이 "Perfect Summary" 기준 유튜브 영상 **10분당 3,000원**으로 확인되어, 설교 1편(40\~70분)당 12,000\~28,000원 수준 — Gemini 오디오 입력(편당 약 55\~80원)의 100배 이상이라 월 1\~3건이어도 배제.
- **자체 구축(yt-dlp/youtube-dl 계열) + Vercel Python 함수**: `@distube/ytdl-core`(2025-08 아카이브됨), `youtubei.js`(활발히 유지보수 중이나 "No valid URL to decipher"로 실패) 둘 다 로컬에서 실패. `yt-dlp`(Python)는 로컬(주거용 IP)에서는 성공했지만, **Vercel 익명 임시 배포로 실제 검증한 결과 클라우드 IP에서 유튜브 봇 탐지("Sign in to confirm you're not a bot")에 즉시 차단됨을 확인**. 우회하려면 쿠키 수동 갱신(주기적 로그인 필요) 또는 유료 주거용 프록시가 필요해, "벤더 없이 무료로"라는 전제가 무너진다.
- **y2mate 등 유튜브→mp3 변환 사이트 스크래핑**: 공식 API가 없고 전부 비공식 리버스엔지니어링 래퍼뿐이다. 결국 같은 유튜브 봇 탐지·서명 변경 문제를 남의 서버에서 겪는 구조이며, 이런 서비스는 자체 봇 차단·저작권 소송에 의한 서비스 중단 전례(youtube-mp3.org, 2017)가 있어 공식 파이프라인이 의존하기에 리스크가 크다.
- **Vercel Pro 업그레이드**: Hobby의 함수 실행시간 고정 5분 한계를 넘기 위해 검토했으나, 오디오를 직접 다운로드하지 않는 최종안에서는 실행시간 여유가 충분해 불필요. 월 $20 고정비가 이 기능의 AI 비용(월 200원 미만)보다 훨씬 크다는 점도 배제 사유.

- **`thinkingConfig`로 thinking 토큰 억제**: 받아쓰기에 추론이 불필요해 보여 검토했으나 2026-08-27 실측으로 기각했다. `gemini-3.1-pro-preview`는 `thinkingBudget: 0`을 거부하고(`This model only works in thinking mode`), 2000으로 낮추면 57분 설교를 **7분 37초까지만 받아쓰고 `finishReason=STOP`으로 정상 종료**했다. 4096은 아예 무시되고 18,274 토큰을 썼다. thinking이 긴 오디오를 끝까지 밀고 가는 동력이라 억제하면 조용한 절단을 산다. `maxOutputTokens` 상향(65536)도 기각 — thinking이 그 공간을 채워 26,532 토큰까지 늘고 생성이 389초로 길어져 함수 예산 300초를 넘겼다.

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
      → gemini-3.1-pro-preview → gemini-3.1-pro → gemini-3.5-flash → gemini-2.5-flash, 순서대로 폴백
   c. 성공 → storeTranscript(sermonId, 결과 텍스트) → 기존 ④ summarize 그대로 발행
      실패(비일시 오류, 혹은 폴백까지 소진) → summary_status='no_transcript' (기존과 동일한 최종 상태)
        │
        ▼
④ QStash 워커  /api/jobs/summarize   (변경 없음, 프롬프트만 개선)
   - PROMPT에 durationSeconds·기대 챕터 수 명시, "챕터 900초 초과 금지" 강제 지시 추가

[별도] 관리자 "요약 재생성" 버튼 → generateSummaryAction → requestSummaryRegeneration
   - summary_status='none', summary_attempts=0, summary_next_retry_at=NULL 로 초기화
   - 자막 캐시 있음 → "summarize" job 발행
   - 자막 캐시 없음 → "fetch-transcript" job을 attempt=MAX_TRANSCRIPT_RETRY 로 발행
     (RapidAPI 1회 실패 → 곧바로 ③-b 오디오 폴백)
   - 발행 후 즉시 반환 — 이후는 위 자동 체인과 완전히 동일한 경로
```

### 핵심 원칙

- 오디오 폴백은 **별도 job으로 분리**한다 — `fetch-transcript`는 지금처럼 가볍게 유지하고, 4~5분 걸리는 Gemini 오디오 호출만 별도 함수(`maxDuration=300`)로 격리해 기존 `fetch-transcript`의 60초 예산에 영향을 주지 않는다.
- 오디오 폴백의 출력 계약은 기존 `transcriptText`와 **동일**하다 — `summarize` job은 자막 출처가 RapidAPI인지 Gemini 오디오 변환인지 구분하지 않는다.
- 수동 재생성 버튼은 **자동 체인에 재투입할 뿐** 자체 실행 경로를 갖지 않는다 — 오디오 변환이 도는 곳은 `fetch-audio-transcript` 하나뿐이라 함수 예산도 한 곳에서만 관리된다.

## 컴포넌트 (변경 / 신규)

### 변경

- `src/app/api/jobs/fetch-transcript/route.ts` — `MAX_TRANSCRIPT_RETRY` 12→6, give-up 분기에서 `no_transcript` 직접 세팅 대신 `fetch-audio-transcript` job 발행. 이 발행 자체를 try/catch로 감싸, 발행이 실패하면(QStash 장애 등) 그 자리에서 `no_transcript`로 종결한다 — 실패 시 어떤 job도 이어받지 않아 종결 상태가 안 남는 것을 막기 위함.
- `src/lib/qstash.ts` — `JobName` 유니온에 `'fetch-audio-transcript'` 추가. `publishJob`이 4번째 인자로 `JobPublishOptions`(`retries`·`timeoutSeconds`)를 받도록 확장돼, `fetch-audio-transcript` 발행 시 재전달 상한과 QStash HTTP 타임아웃을 job별로 지정할 수 있다.
- `src/lib/ai/gemini.ts` — `generateContentWithFallback`을 모델 배열 순차 시도로 일반화하고, 503 등 일시 오류 외에 404(모델 단종)도 다음 모델로 넘어가도록 판별을 넓힌다(`isModelUnavailableError` 신규). 오디오 경로는 `[gemini-3.1-pro-preview, gemini-3.1-pro, gemini-3.5-flash, gemini-2.5-flash]` 4단, 기존 텍스트 요약 호출(`[3.5-flash, 2.5-flash]`)도 같은 함수로 통합.
- `src/lib/ai/sermon-summary.ts` — `PROMPT`에 `durationSeconds`·기대 챕터 수(`Math.round(durationSeconds/600)`)를 보간하고 "챕터 900초 초과 금지, 초과 시 반드시 분할" 지시 추가.
- `src/lib/sermons/summarize.ts` — `fetchAndStoreTranscript`가 RapidAPI 실패(`자막 미준비`) 시 바로 던지지 않고, `options.audioFallback`이 켜져 있으면 신규 오디오 변환 함수를 호출해 성공하면 그 텍스트를 저장·반환. 폴백은 기본 꺼짐(옵트인)이다 — 자막이 아직 없는 것이 정상인 채널 동기화 경로(`resyncAllSermons`)까지 영상 한 건당 4~5분 블로킹하면 안 되고(SSE 스트림의 300초 예산을 한 건이 먹는다), 30분 뒤면 무료로 잡힐 자막을 두고 3시간 게이트를 우회하게 되기 때문이다. `manualSummarize`만 명시적으로 켠다 — 이 경로는 이제 로컬 백필 스크립트(`scripts/summarize-sermons.ts`) 전용이라 함수 실행시간 예산을 받지 않는다. 신규 `requestSummaryRegeneration`이 관리자 버튼의 진입점이고, `MAX_TRANSCRIPT_RETRY`도 여기서 export해 `fetch-transcript` 라우트와 공유한다.
- `src/app/admin/sermons/[id]/edit/page.tsx` — `maxDuration=300` 유지. 최초에는 인라인 오디오 변환 때문에 올린 값이지만, 버튼이 job 발행으로 바뀐 뒤로는 같은 페이지의 `suggestThumbnailTextAction`(Gemini 호출)이 이 예산을 쓴다. Server Action의 타임아웃은 그 액션을 호출한 **페이지**의 route segment config를 따른다(서버 액션 파일에 두면 무시된다).
- `src/lib/actions/sermons.ts` — `generateSummaryAction`이 `manualSummarize` 대신 `requestSummaryRegeneration`을 호출하고 값을 반환하지 않는다.
- `src/components/admin/SermonEditForm.tsx` — 버튼이 `ready`/`failed` 대신 요청 접수를 표시한다. `no_transcript` 안내 문구도 "완료까지 기다리라"에서 "나중에 새로고침하라"로 바뀐다.

### 신규

- `src/app/api/jobs/fetch-audio-transcript/route.ts` — 위 아키텍처의 ③-b. QStash 서명검증 필수(기존 워커 패턴과 동일). 설교의 `durationSeconds`를 조회해 `transcribeFromAudio`에 넘기고(절단 검사 기준), 실패하면 `retryAudioTranscriptOrGiveUp`에 처리를 맡긴다. job 본문의 `attempt`로 자동 재시도 횟수를 센다.
- `src/lib/ai/audio-transcript.ts`(가칭) — `transcribeFromAudio(videoId: string): Promise<TranscriptSegment[]>`. 유튜브 URL 기반 오디오 받아쓰기 프롬프트·모델 폴백 호출 후 `[MM:SS]`/`[H:MM:SS]` 양쪽을 다 받는 정규식으로 `TranscriptSegment[]`로 파싱하는 **공용 함수**(자동 job·수동 재생성 버튼 공통 사용, `fetchTranscript`와 동일한 반환 타입이라 `storeTranscript`에 그대로 넘길 수 있음). 커스텀 undici dispatcher(`headersTimeout`/`bodyTimeout` 10분) 적용.

## 에러 처리

- **앞부분만 받아쓰고 정상 종료(조용한 절단)**: `finishReason=STOP`이라 기존 검사를 통과하므로 `assertCoversFullAudio`가 따로 막는다 — 마지막 타임스탬프가 `durationSeconds`의 `MIN_TRANSCRIPT_COVERAGE`(0.8)에 못 미치면 throw. `durationSeconds`가 없는 설교는 비교 기준이 없어 검사하지 않는다(알려진 구멍).
- **오디오 변환 실패(원인 불문)**: `MAX_AUDIO_TRANSCRIPT_RETRY`(1회)까지 job 본문의 `attempt`를 올려 자동으로 다시 태운다. 같은 영상이 한 판은 잘리고 다음 판은 끝까지 가는 것을 2026-08-27 실측으로 확인했다 — 모델 실패가 판마다 흔들리므로 사람이 버튼을 다시 누르지 않아도 회수된다. 재시도 한 번이 4~5분짜리 Gemini 호출을 통째로 다시 돌리므로 그 이상은 두지 않는다. 재시도를 소진하거나 재발행 자체가 실패하면 `no_transcript`로 종결한다. QStash의 `retries: 1`은 네트워크 사고용으로 남고, 모델 실패는 `attempt`가 따로 센다 — 재전달 횟수 헤더는 SDK가 노출하지 않아 의존하지 않는다.
- **일시 오류(503 등) 또는 모델 단종(404)**: `gemini-3.1-pro-preview` → `gemini-3.1-pro` → `gemini-3.5-flash` → `gemini-2.5-flash` 순서로 폴백. 넷 다 실패하면 `no_transcript`.
- **`headersTimeout`으로 인한 `fetch failed`**: 커스텀 dispatcher로 완화하되, 완전히 배제되지는 않으므로 모델 폴백 루프가 이 경우도 함께 흡수한다(재현 시 로그로 빈도 확인 필요 — 미결 사항 참고).

## 비용 (참고)

- Gemini 오디오 입력: 실측 기준 편당(40\~70분) 요청 1회당 약 4\~5분 소요, Flash 공개 단가(시간당 약 $0.057) 기준 편당 55\~80원 수준. Pro 티어 단가는 미확인이나 이 볼륨(월 1\~3건)에서는 무시 가능.
- 월 1~3건 기준 총 추가 비용은 수백 원 이내로, 기존 텍스트 요약 비용과 같은 자릿수.

## 테스트

- `fetch-transcript`: 라우트 자체는 전용 테스트가 없다(이 저장소 관행상 route는 얇게 두고 라이브러리 함수를 테스트한다). `MAX_TRANSCRIPT_RETRY=6` 경계값과 소진 시 `fetch-audio-transcript` 발행 분기는 테스트로 커버되지 않는다. 공유 헬퍼 `publishSummarizeOrMarkFailed`는 `summarize.integration.test.ts`가 테스트한다.
- `generateContentWithFallback`: 모델 배열 일반화 후 기존 텍스트 요약 폴백 동작 회귀 테스트, 404(모델 단종) 시 다음 모델로 전환되는지.
- `audio-transcript`: `"[MM:SS] 발화"` 파싱, 일시 오류 시 폴백 모델 전환.
- `assertCoversFullAudio`: 커버리지 미달 시 throw, 영상 끝까지 닿으면 통과, 경계값(0.8) 통과, `durationSeconds`가 없으면 검사 생략, 세그먼트가 비면 throw.
- `sermon-summary` 프롬프트: `durationSeconds` 보간 값 검증, 챕터 900초 초과 시 실패하는 회귀 케이스(가능하면 스냅샷보다는 프롬프트 문자열 포함 여부 검증).
- `fetchAndStoreTranscript`: RapidAPI 실패 시 오디오 변환 함수 호출로 폴백, 오디오 변환도 실패하면 기존과 동일하게 에러 throw(관리자 화면에 메시지 노출). 회귀 방지: 폴백을 켜지 않은 기본 호출은 `transcribeFromAudio`를 호출하지 않고 바로 `자막 미준비`를 throw한다(`summarize.integration.test.ts`).
- `requestSummaryRegeneration`: 자막 캐시 유무에 따른 발행 job 분기, `attempt`가 `MAX_TRANSCRIPT_RETRY`로 채워져 나가는지, 종결 상태(`no_transcript`)와 시도 소진 행이 초기화돼 `claimSermonById`를 통과하는지, 영상 id가 없으면 throw하는지(`summarize.integration.test.ts`).
- `retryAudioTranscriptOrGiveUp`: 재시도가 남으면 `attempt`를 올려 재발행하고 상태를 건드리지 않는지, 소진하면 `no_transcript`로 종결하는지, 재발행이 throw하면 그 자리에서 종결하는지. `publishAudioTranscript`: 재전달·타임아웃 옵션을 붙여 발행하는지.

## 실측 검증 기록 (참고용 원자료)

같은 실제 설교 영상(69분, `sermons.duration_seconds=4140`)을 RapidAPI 자막 기반 기존 요약과 Gemini 오디오 기반 요약으로 각각 생성해 비교했다.

|                | 기존(RapidAPI 자막)                                              | 최종안(유튜브 URL 직접 입력 + 프롬프트 개선)               |
| -------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 한 줄 요약     | 여호수아 1:9 말씀으로 두려움을 이기고 인생의 문지방을 넘으십시오 | 두려움을 넘어 말씀으로 문지방을 건너는 믿음 (여호수아 1:9) |
| 핵심 요점 개수 | 12                                                               | 12                                                         |
| 챕터 개수      | 7                                                                | 7                                                          |
| 최대 챕터 길이 | 600초                                                            | 708초 (900초 이내)                                         |

프롬프트 개선 이전(전체 길이 미명시) 버전은 같은 오디오 받아쓰기로 챕터 5개(최대 2048초, 900초 제한 위반)가 나와 개선이 필요함을 확인했다.

## 미결 사항

1. `gemini-3.1-pro-preview`가 실제 서비스 시점에도 유튜브 URL 직접 입력을 지원하는지 — preview 단종(404) 자체는 `gemini-3.1-pro` 자동 폴백으로 대비했지만, `gemini-3.1-pro`라는 정식 이름이 실제로 그대로 쓰이는지는 출시 전에는 확인 불가. 이름이 다르게 나올 경우 상수만 갱신하면 된다.
2. Gemini의 유튜브 URL 직접 입력 기능 자체가 아직 프리뷰(무료) 상태 — 정식화 시 과금 정책이 붙을 수 있어 유지보수 시 확인 필요.
3. ~~`fetch-audio-transcript`의 `maxDuration=300`이 실제 최장 설교에서도 여유 있는지~~ — 2026-08-27 프로덕션 3건 실측으로 답이 나왔다. 아래는 `fetch-transcript`의 포기 로그부터 `summarize` 완료 로그까지의 벽시계 시간으로, QStash 큐 지연·오디오 변환·요약이 모두 들어간 값이다.

   | 설교       | 길이           | 소요  |
   | ---------- | -------------- | ----- |
   | 2026-08-16 | 3,661초 (61분) | 490초 |
   | 2026-08-09 | 3,664초 (61분) | 343초 |
   | 2026-08-02 | 4,168초 (69분) | 289초 |

   가장 긴 69분 설교가 가장 빨랐다. 로컬 실측(받아쓰기 329초)보다 프로덕션이 빠르며 길이와 소요가 비례하지도 않는다. **다만 같은 69분 설교의 20분 전 시도는 300초를 넘겨 강제 종료됐다(미결 #7)** — 예산이 빠듯한 게 아니라 편차가 예산 폭보다 크다는 뜻이고, 그래서 `maxDuration` 조정이 아니라 종료 후 회수 경로가 다음 과제가 된다.

4. `headersTimeout` 관련 "fetch failed"가 프로덕션(Vercel Node 런타임)에서도 동일하게 재현되는지 — 로컬에서는 undici 전역 dispatcher로 완화했으나 Vercel 런타임에서 같은 설정이 유효한지 미확인. 대안으로 `@google/genai`가 지원하는 요청 단위 `httpOptions.timeout`(ms)도 확인했다 — 내부적으로 `includeExtraHttpOptionsToRequestInit`(`node_modules/@google/genai/dist/node/index.mjs`)이 전역 dispatcher의 헤더/바디 타임아웃 심볼을 `Math.max`로 올리기만 해 다른 호출자와 안전하게 공존하고, 그 호출 하나에만 걸리는 `AbortController`를 별도로 붙인다. 다만 이 경로는 전역 dispatcher가 **이미 존재할 때만** 작동해, 콜드 프로세스의 첫 호출에서는 분기가 통째로 건너뛰어지고 Node 기본 5분 헤더 타임아웃이 그대로 남을 수 있다 — `setGlobalDispatcher`는 dispatcher의 존재 자체를 보장하므로 현재 방식을 택했다. `transcribeFromAudio`의 `generateContent` 호출에는 이제 `httpOptions: { timeout: 600_000 }`을 안전망으로 병행 적용했다(전역 dispatcher를 대체하는 게 아니라 함께 건다) — 전역 dispatcher가 Vercel에서 무효로 확인되더라도 요청이 무한정 매달리지는 않는다.
5. 배포 전 Vercel 프로젝트의 Node 버전이 22.19 이상(24.x 등)인지 확인할 것 — 저장소에 `engines`/`.nvmrc`/`vercel.json` Node 설정이 없어 Vercel 프로젝트 설정이 버전을 정한다. 설치된 `undici@8`은 `engines.node >= 22.19.0`을 요구해, 미달이면 설치 경고나 런타임 오류로 이어질 수 있다.
6. QStash 플랜의 최대 HTTP 타임아웃이 300초 이상인지 확인할 것 — `fetch-transcript`가 `fetch-audio-transcript` 발행 시 `timeout: 300`(초)을 명시하지만, 플랜 상한이 이보다 낮으면 함수가 오디오 변환을 정상 완료해도 QStash가 응답을 못 받은 것으로 보고 재전달해 오디오 변환이 중복 과금될 수 있다.
7. **`fetch-audio-transcript` 강제 종료 시 상태가 `none`에 잔류한다 — 2026-08-27 프로덕션에서 재현됐다.** 69분 설교(`b5153b79`)의 13:04:10 시도에는 완료 로그도 `오디오 변환 실패` 로그도 남지 않았다. catch가 돌았다면 에러 로그와 자동 재시도가 뒤따랐어야 하므로, Vercel이 300초에서 함수를 끊은 것이다. 관리자가 20분 뒤 상태를 보고 버튼을 다시 눌러 해소했다(13:24:07 재발행 → 13:28:56 완료).

   이 잔류를 주울 자동 경로가 없다:

   - `selectRetryTargets`는 `summary_status = 'failed'`이면서 자막이 있는 행만 고른다. 자막 없이 `none`인 행은 조건 두 개를 모두 벗어난다.
   - `pending` 10분 만료 회수는 `claimSermonById`가 다시 호출될 때만 작동한다. 아무도 부르지 않으면 영원히 잠들어 있다.
   - QStash `retries: 1`의 재전달은 같은 자리에서 다시 300초를 쓰고 조용히 죽는다.
   - `retryAudioTranscriptOrGiveUp`은 catch 안에 있어 이 경로에서 실행되지 않는다.

   관측 문제도 함께 드러났다 — 관리자 화면은 "아직 시작 안 함"과 "돌다가 죽음"을 구분해 보여주지 못한다. 둘 다 `none`이라 사람이 기다려 보는 것 말고는 판단할 방법이 없다. 해결 설계는 별도로 잡는다.

## 범위 밖 (YAGNI)

- 오디오 변환 결과와 RapidAPI 자막을 비교해 더 나은 쪽을 자동 선택하는 로직 — 애초에 RapidAPI가 실패한 경우에만 타는 경로라 해당 없음.
- 오디오 변환 결과를 별도로 캐시/재사용하는 기능 — 월 1~3건뿐이라 불필요.
- Lilys AI 등 벤더 API로의 이중 폴백 — 필요성이 확인되면 별도 설계.
