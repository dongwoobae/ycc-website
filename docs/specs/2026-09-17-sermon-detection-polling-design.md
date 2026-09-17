# 설교 업로드 감지를 폴링 주력으로 전환하는 설계

**작성일**: 2026-09-17
**상태**: 설계 확정 (구현 계획 대기)
**대체 대상**: `2026-06-23-youtube-websub-pipeline-design.md`의 **"업로드 감지 = YouTube WebSub 푸시"** 결정을 교체한다. 같은 문서의 "실데이터 소스 = YouTube Data API v3" 항목은 구현이 yt-api로 갈라져 나갔던 것을 감지 경로에 한해 되돌리는 셈이고, 단건 조회·자막은 yt-api에 남는다. 자막·요약·큐 설계는 그대로 유효하다.

## 교체 사유

WebSub 푸시가 2026-09-03 이후 한 건도 도착하지 않았고, 원인이 우리 쪽에 없다는 것이 확인됐다.

### 확인된 사실

허브(`pubsubhubbub.appspot.com`) `subscription-details` 실측:

```
State                        verified
Expiration time              Sun, 20 Sep 2026 00:00:23 +0000
Last subscribe request       Tue, 15 Sep 2026 00:00:23 +0000
Last successful verification Mon, 14 Sep 2026 00:00:05 +0000
Content received             Wed, 02 Sep 2026 11:46:11 +0000
Content delivered            Thu, 03 Sep 2026 00:50:32 +0000
Last delivery error          n/a
```

`topic-details` 실측 — 우리 토픽 `Last ping: 2026-09-13 05:43:04 +0000`. 비교군으로 둔 `UC_x5XG1OV2P6uZZ5FSM9Ttw`는 `2026-09-15 19:02:18 +0000`.

`app_logs`에서 2026-09-10 이후 `websub`·`reconcile`을 포함한 행은 20건이었고, 그 안에서:

- `[websub-renew] … 503 Transient error`가 09-13·09-15·09-16·09-17에 각 4행(초기 1 + QStash 재시도 3). 09-14는 0행.
- `2026-09-17T00:00:10Z [reconcile] … 260916 수요예배` — 09-16 업로드 시점에 리스는 09-20까지 유효했고 State도 `verified`였는데 푸시가 오지 않았다.

즉 **구독이 살아 있어도 푸시가 오지 않는다.** `Last delivery error`가 `n/a`라는 것은 허브가 배달을 시도하다 실패한 것이 아니라 배달할 내용을 받지 못했다는 뜻이다.

우리 설정에는 문제가 없다. 콜백 `https://www.ycjc.kr/api/youtube/websub`는 외부에서 GET하면 `hub.challenge`를 200으로 에코하고, 허브가 등록해 둔 콜백도 같은 값이다. 토픽 `https://www.youtube.com/xml/feeds/videos.xml?channel_id=` 는 모든 채널에서 엔트리 없는 정적 스텁을 돌려주는 것이 정상 동작이다(응답 본문에 `This is a static file` 주석이 있고, 비교군 채널도 동일).

YouTube 쪽 공개 신디케이션 전반이 불안정하다. 같은 채널의 RSS `https://www.youtube.com/feeds/videos.xml?channel_id=UCzB3UsqsJhtFUvPEeOtTL6g`는 연속 호출에서 404·404·500을 돌려준 반면, `UCX6OQ3DkcsbYNE6H8uQQuVA`·`UCBJycsmduvYEL83R_U4JriQ`·`UC_x5XG1OV2P6uZZ5FSM9Ttw`는 200에 엔트리 15개를 돌려줬다. 같은 증상이 외부에도 보고돼 있다(Google AI Developers 포럼 "YouTube RSS feed endpoint returns 404 errors" 스레드는 2025-12 시작, 2026-04까지 미해결).

**결론: 우리가 고칠 수 있는 대상이 아니다.** YouTube가 제공하는 업로드 푸시는 WebSub 하나뿐이고 대체 푸시 API는 존재하지 않는다. 폴링을 주력으로 올리는 것이 유일한 실효 수단이다.

## 확정된 의사결정

| 항목 | 결정 |
| --- | --- |
| 업로드 감지 주경로 | **YouTube Data API v3 폴링** — uploads 재생목록(`UU` + 채널 ID 뒷부분)을 `playlistItems.list`로 조회 |
| 업로드 감지 부경로 | **WebSub 푸시 유지** — 갱신 크론은 계속 돌리되 실패를 장애로 취급하지 않는다. 복구되면 지연 없이 다시 들어온다 |
| 폴링 주기 | 예배 시간대 집중(주일 낮·수요 저녁 매시간) + 매일 1회 안전망 |
| 폴링 소스에서 yt-api 제외 | yt-api `channel/videos`는 캐시가 수시간 뒤처진다(2026-07-05 `d7588c4`에 기록). 시간 단위 폴링과 양립하지 않는다 |
| Data API 인증 | **API 키**(공개 데이터 읽기). 채널 소유권·OAuth 불필요. 쿼터는 키를 만든 프로젝트에 붙는다 |
| 키 미설정 시 동작 | 기존 yt-api 경로로 폴백. 키 투입 전에도 배포가 깨지지 않는다 |
| 로그 레벨 | `app_logs.action`에 **`warning`** 추가. `action`은 `text` 컬럼이라 마이그레이션 불필요 |
| 등록 출처 기록 | `insertSermon`이 `create` 로그 메시지에 출처(푸시/폴링/수동)를 남긴다. 푸시 복구를 이 한 줄로 알아챈다 |

## 폴링 스케줄의 근거

최근 설교 40건의 실제 업로드 시각(watch 페이지의 `uploadDate`, KST 환산):

| 요일 | 건수 | 범위 | 시간대 분포 |
| --- | --- | --- | --- |
| 일 | 25 | 10:31 ~ 15:37 | 12시 10, 13시 8, 14시 4, 15시 2, 10시 1 |
| 수 | 13 | 19:49 ~ 20:54 | 20시 11, 19시 2 |
| 금 | 2 | 19:01 ~ 20:33 | — |

금요일 2건은 금요 예배가 아니라 수요·주일 설교를 뒤늦게 올린 것이다. 정기 창 밖의 이런 지각 업로드는 매일 안전망이 줍는다.

QStash 스케줄(cron은 UTC):

| scheduleId | cron | KST | 주당 실행 |
| --- | --- | --- | --- |
| `ycc-reconcile-sermons-sun` | `0 2-8 * * 0` | 일 11~17시 | 7 |
| `ycc-reconcile-sermons-wed` | `0 11-14 * * 3` | 수 20~23시 | 4 |
| `ycc-reconcile-sermons` | `0 0 * * *` | 매일 09시 (기존) | 7 |

창 안의 최악 감지 지연은 59분. 창 밖 업로드는 다음 매일 실행까지 기다린다.

### 쿼터

Data API 무료 쿼터는 일 10,000 units이고 `playlistItems.list`·`videos.list` 모두 호출당 1 unit이다. 주 18회 폴링에 신규 영상이 있을 때만 `videos.list`를 덧붙이므로 월 100 units 안쪽이다.

RapidAPI yt-api 무료 플랜은 응답 헤더 실측으로 **월 300회**(`X-RateLimit-Requests-Limit: 300`)다. 폴링이 Data API로 옮겨가면 yt-api는 단건 조회·자막·수동 재동기화에만 쓰여 여유가 커진다.

## 데이터 흐름

```
[주경로] QStash 스케줄 ─→ /api/jobs/reconcile-sermons
                              │
                              ├─ playlistItems.list (1 unit) → 최근 videoId 목록
                              ├─ DB youtube_video_id 대조 → 누락분만 남김
                              ├─ videos.list (1 unit, 누락분 있을 때만) → 제목·길이·썸네일
                              └─ insertSermon(…, source='폴링') → fetch-transcript 발행

[부경로] YouTube 업로드 ─ping→ 허브 ─push→ /api/youtube/websub
                              └─ ingest-video → insertSermon(…, source='푸시')
```

`videos.list`가 필요한 이유는 `playlistItems.list`가 길이를 주지 않기 때문이다. `durationSeconds`는 `fetch-audio-transcript`의 `transcribeFromAudio`·`assertCoversFullAudio`와 `summarize` 경로, 설교 상세 페이지가 쓴다.

## 로그 설계

`app_logs.action`에 `warning`을 추가한다. 손대는 곳은 세 군데다.

- `src/lib/logger.ts` — `LogAction` union
- `src/app/admin/log/page.tsx` — `ACTION_OPTIONS`(필터 드롭다운 겸 쿼리 파라미터 화이트리스트), `ACTION_BADGE`(색상). 뱃지를 등록하지 않으면 미등록 액션 폴백인 회색으로 떨어져 `login`/`logout`과 구분되지 않는다

행동 변경:

| 위치 | 현재 | 변경 후 |
| --- | --- | --- |
| `reconcile.ts` 보정 등록 | `error` `[reconcile] WebSub 알림 소실 감지 — 보정 등록됨(푸시 경로 점검 필요)` | **행 자체를 삭제.** 폴링이 주경로가 된 이상 정상 동작이고, `insertSermon`의 `create` 행과 중복된다 |
| `insertSermon` 등록 | `create` `제목 (유형)` | `create` `제목 (유형) — 폴링`처럼 출처를 덧붙인다 |
| `websub-renew` 실패 | `error` + HTTP 500(QStash 재시도 3회 → 하루 4행) | `warning` + HTTP 200(재시도 없음 → 하루 1행) |

`websub-renew`가 500을 버리는 근거: 폴링이 주경로가 되면 갱신 한 번을 놓치는 비용이 거의 없다. 리스는 5일이고 갱신은 매일이라 4회 연속 실패까지 견딘다. 실측으로도 재시도가 구해준 사례가 없다 — 09-15에는 우리 쪽 4회가 전부 503이었는데 허브는 `Last subscribe request`를 `09-15 00:00:23`로 기록하고 만료를 그 +5일로 연장했다. 첫 요청을 이미 접수해 놓고 응답만 503으로 돌려준 것이다.

푸시 복구 감지는 별도 로그를 두지 않는다. 복구되면 `ingest-video` 경로가 돌아 `create … — 푸시` 행이 자연히 나타난다.

## 에러 처리

- `YOUTUBE_API_KEY` 미설정 → yt-api 폴백. 폴백으로 내려갔다는 사실을 `warning` 한 줄로 남긴다(정상 경로에서는 남기지 않는다).
- Data API 403(쿼터 소진)·5xx → 예외를 던지지 않고 `warning`을 남긴 뒤 해당 회차를 건너뛴다. 다음 회차가 같은 누락분을 다시 잡는다.
- `playlistItems.list`가 빈 목록을 돌려주면 등록 없이 종료한다. 빈 응답을 "전부 삭제됨"으로 해석하지 않는다.
- 한 영상의 `insertSermon` 실패가 나머지 누락분을 막지 않는 기존 동작은 유지한다.

## 테스트 계획

**이 변경이 무효화하는 기존 단언**

`src/lib/sermons/reconcile.test.ts`의 3개 테스트가 모두 `vi.mock('@/lib/youtube/rapidapi-channel', …)`로 `fetchChannelVideos`를 목킹한다. 소스가 바뀌므로 목 대상을 새 Data API 모듈로 교체해야 하고, 교체 전까지 세 테스트는 "소스를 호출하지 않는다"는 이유로 실패한다.

`src/app/api/jobs/websub-renew/route.test.ts`의 실패 케이스는 `res.status`가 500인지와 `log`가 `'error'`로 불렸는지를 단언하고, 테스트 이름 자체가 "500을 돌려 QStash 재시도를 유도한다"로 그 의도를 못박고 있다. 단언과 이름을 함께 바꾼다. 성공 케이스("200을 돌려주고 로그를 남기지 않는다")는 그대로 유효하다.

`src/lib/sermons/ingest.test.ts`는 `log`가 `('error', 'sermon', …)`로 불렸는지 단언한다. `insertSermon` 시그니처에 출처가 추가되면 `create` 경로의 메시지 단언이 함께 바뀐다.

**추가할 테스트**

- Data API 모듈: `playlistItems.list` 응답 정규화(videoId·제목·publishedAt·썸네일), `videos.list`의 ISO8601 duration → 초 변환, 키 미설정 시 폴백 신호
- `reconcileSermons`: 누락분이 없으면 `videos.list`를 호출하지 않는다(쿼터 절약이 설계 근거이므로 단언으로 고정한다)
- `reconcileSermons`: Data API 403에서 예외를 던지지 않고 `{ checked: 0, inserted: 0 }`으로 끝난다
- 관리자 로그 페이지: `action=warning` 필터가 화이트리스트를 통과한다

**수동 검증**

다음 주일(2026-09-20) 업로드가 폴링 창 안에서 잡히는지, `create … — 폴링` 행이 남는지, 감지 지연이 59분 이내인지 확인한다. 비교 기준은 09-16 수요예배의 12시간 17분이다(20:43 KST 업로드 → `2026-09-17T00:00:10Z` 등록).

## 범위 밖 — 손대지 않는 yt-api 경로

`fetchChannelVideos`는 reconcile 말고도 세 곳이 쓴다. 전부 그대로 둔다.

- `src/lib/sermons/sync.ts`(관리자 수동 전체 재동기화)와 `src/lib/sermons/sync.test.ts` — 사람이 누르는 일회성 작업이라 수시간 캐시 지연이 문제되지 않고, 여러 페이지를 훑어야 해 Data API로 옮기면 오히려 호출 수가 는다
- `scripts/seed-from-rapidapi.ts` — 로컬 시드 스크립트
- `docs/specs/2026-06-29-sermon-sync-progress-design.md` — 위 sync 경로를 서술한 문서. 이 설계가 바꾸는 대상이 아니다

## 함께 고치는 문서

- `.env.example` — `YOUTUBE_API_KEY` 추가. 아울러 QStash 항목 주석의 "WebSub 갱신 2일·요약 재시도 매시간"은 갱신이 이미 매일로 바뀌어 있어 사실과 다르다. 새 스케줄과 함께 고친다
- `scripts/qstash-schedules.ts` — 상단 JSDoc의 스케줄 목록
- `2026-06-23-youtube-websub-pipeline-design.md` — 머리에 이 문서로의 포인터를 추가한다

## 미결정 사항

1. 토픽 URL을 공식 문서 형식(`https://www.youtube.com/feeds/videos.xml?channel_id=`)으로 맞출지. 현재 코드는 `/xml/feeds/`를 쓴다. 이번 장애의 원인이 아니고, 바꾸면 허브에서 새 토픽으로 재구독해야 하는데 푸시가 죽어 있어 검증할 방법이 없다. **이번 범위에서 제외하고 별건으로 남긴다.**
2. 푸시가 상당 기간 복구되지 않으면 WebSub 경로를 걷어낼지. 판단 시점은 정하지 않는다.
3. 폴링 창을 넓힐지. 현재 창은 40건 표본의 범위에 맞췄다. 표본 밖 업로드가 반복되면 재조정한다.
