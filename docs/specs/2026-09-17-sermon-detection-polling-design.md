# 설교 업로드 감지를 폴링 주력으로 전환하는 설계

**작성일**: 2026-09-17
**상태**: 구현 완료 (2026-09-17)
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

| 항목                      | 결정                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 업로드 감지 주경로        | **YouTube Data API v3 폴링** — uploads 재생목록(`UU` + 채널 ID 뒷부분)을 `playlistItems.list`로 조회                                                                           |
| 업로드 감지 부경로        | **WebSub 푸시 유지** — 갱신 크론은 계속 돌리되 실패를 장애로 취급하지 않는다. 복구되면 지연 없이 다시 들어온다                                                                 |
| 폴링 주기                 | 예배 시간대 집중(주일 낮·수요 저녁 매시간) + 매일 1회 안전망                                                                                                                   |
| 폴링 소스에서 yt-api 제외 | yt-api `channel/videos`는 캐시가 수시간 뒤처진다(2026-07-05 `d7588c4`에 기록). 시간 단위 폴링과 양립하지 않는다                                                                |
| Data API 인증             | **API 키**(공개 데이터 읽기). 채널 소유권·OAuth 불필요. 쿼터는 키를 만든 프로젝트에 붙는다                                                                                     |
| Data API 실패 시 동작     | **키 미설정뿐 아니라 호출 실패 전반**에서 기존 yt-api 경로로 폴백. 폐기된 키가 설정돼 있어도 주경로가 멈추지 않는다                                                            |
| 로그 레벨                 | `app_logs.action`에 **`warning`** 추가. `action`은 `text` 컬럼이라 마이그레이션 불필요                                                                                         |
| 등록 출처 기록            | `insertSermon`이 `create` 로그 메시지에 출처를 남긴다. 푸시 복구를 이 한 줄로 알아챈다. 인자는 영문 리터럴(`websub`/`reconcile`/`sync`/`seed`)이고 표시할 때만 한국어로 바꾼다 |
| QStash 스케줄 폐기        | 등록 스크립트가 `ycc-` 접두 스케줄의 **desired set**을 소유한다. 목록에서 사라진 ID는 `--apply`를 붙였을 때만 삭제한다(기본은 후보만 출력)                                     |

## 폴링 스케줄의 근거

최근 설교 40건의 실제 업로드 시각(watch 페이지의 `uploadDate`, KST 환산):

| 요일 | 건수 | 범위          | 시간대 분포                             |
| ---- | ---- | ------------- | --------------------------------------- |
| 일   | 25   | 10:31 ~ 15:37 | 12시 10, 13시 8, 14시 4, 15시 2, 10시 1 |
| 수   | 13   | 19:49 ~ 20:54 | 20시 11, 19시 2                         |
| 금   | 2    | 19:01 ~ 20:33 | —                                       |

금요일 2건은 금요 예배가 아니라 수요·주일 설교를 뒤늦게 올린 것이다. 정기 창 밖의 이런 지각 업로드는 매일 안전망이 줍는다.

QStash 스케줄(cron은 UTC):

| scheduleId                  | cron            | KST              | 주당 실행 |
| --------------------------- | --------------- | ---------------- | --------- |
| `ycc-reconcile-sermons-sun` | `0 2-8 * * 0`   | 일 11~17시       | 7         |
| `ycc-reconcile-sermons-wed` | `0 11-14 * * 3` | 수 20~23시       | 4         |
| `ycc-reconcile-sermons`     | `0 0 * * *`     | 매일 09시 (기존) | 7         |

스케줄 ID를 둘 늘리므로 폐기 경로를 같이 만든다. 현재 `upsertSchedule`은 `schedules.create`만 부르고 목록 조회·삭제가 없어, 스크립트에서 항목을 지우거나 ID를 바꿔도 QStash에는 옛 스케줄이 그대로 남아 계속 실행된다. 등록 스크립트가 `ycc-` 접두 스케줄의 desired set을 소유하게 하고, 목록에 없는 ID는 삭제한다. 삭제는 실행 취소가 안 되는 연산이라 **`--apply`를 붙였을 때만 실제로 지우고, 기본은 후보만 출력한다**(이 저장소의 `cleanup-thumbnails.ts`·`audit-bulletin-r2.ts`와 같은 기본값). `desired`가 비거나 접두사 없는 ID를 담고 있으면 배열 편집 실수로 보고 호출 전에 막는다 — 비면 관리 대상 전체가 삭제 후보가 되고, 접두사가 없으면 그 스케줄은 desired에서 빠져도 삭제 대상으로 잡히지 않아 영원히 고아로 남기 때문이다. 지금은 파일 두 곳을 고치면 되지만, 나중에는 같은 수정에 더해 QStash 외부 상태를 감사하고 고아 ID를 손으로 지워야 한다.

창 안의 최악 감지 지연은 59분. 창 밖 업로드는 다음 매일 실행까지 기다린다.

### 쿼터

Data API 무료 쿼터는 일 10,000 units이고 `playlistItems.list`·`videos.list` 모두 호출당 1 unit이다. 주 18회 폴링에 신규 영상이 있을 때만 `videos.list`를 덧붙이므로 월 100 units 안쪽이다.

RapidAPI yt-api 무료 플랜은 응답 헤더 실측으로 **월 300회**(`X-RateLimit-Requests-Limit: 300`)다. 폴링이 Data API로 옮겨가면 yt-api는 단건 조회·자막·수동 재동기화에만 쓰여 여유가 커진다.

이 여유는 Data API가 정상 동작하는 해피패스에서만 성립한다. 폴백이 지속되는 상태에서는 reconcile의 매 실행이 yt-api를 호출하므로, 주당 실행 수만큼 그대로 yt-api 호출이 늘어 주 7회(폴링 전환 전 매일 1회 기준)에서 주 18회로, 월 78회가 된다. 한도(월 300회)를 넘지는 않지만 같은 한도를 자막 조회와 나눠 쓰므로 여유가 그만큼 줄어든다.

## 데이터 흐름

```
[주경로] QStash 스케줄 ─→ /api/jobs/reconcile-sermons
                              │
                              ├─ playlistItems.list (1 unit, maxResults=50) → videoId·제목·업로드시각
                              ├─ DB youtube_video_id 대조 → 누락분만 남김
                              ├─ videos.list (1 unit, 누락분 있을 때만) → 길이·라이브 여부
                              └─ insertSermon(…, origin='reconcile') → fetch-transcript 발행

[부경로] YouTube 업로드 ─ping→ 허브 ─push→ /api/youtube/websub
                              └─ ingest-video → insertSermon(…, origin='websub')
```

`videos.list`가 필요한 이유는 `playlistItems.list`가 길이를 주지 않기 때문이다. `durationSeconds`는 `fetch-audio-transcript`의 `transcribeFromAudio`·`assertCoversFullAudio`와 `summarize` 경로, 설교 상세 페이지가 쓴다. 제목은 `playlistItems.list`가 이미 주므로 `videos.list`에서 다시 받지 않는다.

`maxResults`는 상한인 50으로 둔다. 쿼터는 메서드 단위라 10을 받든 50을 받든 1 unit이고, 10으로 두면 **폴링 간격 사이에 11건 이상이 올라올 때 11번째부터는 영구 누락된다** — 다음 회차에도 최신 10건만 보이고 그 전부가 이미 DB에 있어 누락분으로 잡히지 않는다. 업로드가 주 3건 안팎이라 실현 가능성은 낮지만, 이 값은 "에러 처리"의 "다음 회차가 같은 누락분을 다시 잡는다"를 떠받치는 전제라 여유를 둔다.

`playlistItems.list` 결과는 길이가 없어 `YouTubeVideo`를 만족하지 못한다. 목록 단계의 후보 타입을 따로 두고, `insertSermon`에는 `videos.list`까지 거친 완성 타입만 넘긴다 — 후보 단계에서 길이 `0`을 채워 넣으면 그 값이 그대로 DB에 저장된다.

### 실호출로 확인한 것 (2026-09-17)

| 확인 대상                                                                        | 결과                                                                                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `playlistItems.list?part=snippet,contentDetails&playlistId=UUzB3…&maxResults=10` | HTTP 200, 10건 최신순, `pageInfo.totalResults` 225 (검증은 10으로 했고 구현은 50을 쓴다)                          |
| 업로드 시각 필드                                                                 | **`contentDetails.videoPublishedAt`**. `snippet.publishedAt`은 재생목록에 담긴 시각이라 쓰면 안 된다              |
| `videos.list?part=contentDetails,snippet,status&id=…`                            | HTTP 200, `contentDetails.duration`이 `PT34M37S` 형식                                                             |
| 길이 값 정합성                                                                   | `c-oLFHUSx8A` 2077초, `cnwtLTol8Bw` 3803초, `Un6WJA0Np4w` 217초 — **DB에 저장된 yt-api 산출값과 세 건 모두 일치** |
| 라이브 판별                                                                      | `snippet.liveBroadcastContent`(`none`/`live`/`upcoming`), `status.privacyStatus`                                  |

파생 결론:

- 썸네일은 API에서 받지 않는다. 기존 `thumbnailUrlFor(videoId)`가 만드는 고정 주소(`img.youtube.com/vi/{id}/hqdefault.jpg`)를 그대로 쓴다
- 진행 중 라이브·예약 공개는 `liveBroadcastContent !== 'none'`으로 걸러 등록을 미룬다. yt-api `fetchVideoInfo`가 `null`을 돌려주던 것과 같은 역할이다
- 쿼터는 메서드 단위라 `part`를 여러 개 붙여도 호출당 1 unit이다
- **API 키에 HTTP 리퍼러 제한을 걸면 안 된다.** 서버에서 호출하므로 리퍼러가 없다. 제한이 필요하면 API 제한(YouTube Data API v3만 허용)으로 건다

## 로그 설계

`app_logs.action`에 `warning`을 추가한다. 손대는 곳은 세 군데다.

- `src/lib/logger.ts` — `LogAction` union에 `'warning'` 추가
- `src/app/admin/log/actions.ts` — `ACTION_OPTIONS`(필터 드롭다운 겸 쿼리 파라미터 화이트리스트), `ACTION_BADGE`(색상). 뱃지를 등록하지 않으면 미등록 액션 폴백인 회색으로 떨어져 `login`/`logout`과 구분되지 않는다. **이 두 상수를 별도 모듈로 분리한 이유**: `page.tsx`는 서버 컴포넌트라 vitest가 직접 import할 수 없다. 테스트가 상수를 읽을 수 있게 서버 컴포넌트 밖으로 빼낸다
- `src/app/admin/log/page.tsx` — `actions.ts`에서 `ACTION_OPTIONS`와 `ACTION_BADGE`를 import

행동 변경:

| 위치                     | 현재                                                                           | 변경 후                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `reconcile.ts` 보정 등록 | `error` `[reconcile] WebSub 알림 소실 감지 — 보정 등록됨(푸시 경로 점검 필요)` | **행 자체를 삭제.** 폴링이 주경로가 된 이상 정상 동작이고, `insertSermon`의 `create` 행과 중복된다 |
| `insertSermon` 등록      | `create` `제목 (유형)`                                                         | `create` `제목 (유형) — 폴링`처럼 출처를 덧붙인다                                                  |
| `websub-renew` 실패      | `error` + HTTP 500(QStash 재시도 3회 → 하루 4행)                               | `warning` + HTTP 200(재시도 없음 → 하루 1행)                                                       |
| Data API 폴백            | (없음)                                                                         | `warning` 한 줄. 어느 공급자를 탔는지가 여기에만 남는다                                            |

`websub-renew`가 500을 버리는 근거: 폴링이 주경로가 되면 갱신 한 번을 놓치는 비용이 거의 없다. 리스는 5일이고 갱신은 매일이라 4회 연속 실패까지 견딘다. 실측으로도 재시도가 구해준 사례가 없다 — 09-15에는 우리 쪽 4회가 전부 503이었는데 허브는 `Last subscribe request`를 `09-15 00:00:23`로 기록하고 만료를 그 +5일로 연장했다. 첫 요청을 이미 접수해 놓고 응답만 503으로 돌려준 것이다.

푸시 복구 감지는 별도 로그를 두지 않는다. 복구되면 `ingest-video` 경로가 돌아 `create … — 푸시` 행이 자연히 나타난다.

## 에러 처리

- **Data API가 못 쓰이는 모든 경우 → yt-api 폴백.** 키 미설정, 403(키 폐기·API 미활성·쿼터 소진), 5xx, 네트워크 실패를 가리지 않는다. 폴백으로 내려갔다는 사실을 `warning` 한 줄로 남긴다(정상 경로에서는 남기지 않는다).

  폴백 조건을 "키 미설정"으로만 두면 **폐기된 키가 설정돼 있을 때 주경로가 무기한 정지한다** — 키는 "설정됨"이라 폴백이 안 걸리고 매 회차 403으로 건너뛰며 `{checked: 0, inserted: 0}`으로 끝난다. 능동 알림이 없으므로 사람이 로그를 보기 전까지 아무도 모른다. 폴백은 그 상태에서도 하루 지연으로 버티게 해 주는 안전장치다.

- `playlistItems.list`가 빈 목록을 돌려주면 등록 없이 종료한다. 빈 응답을 "전부 삭제됨"으로 해석하지 않는다.
- 한 영상의 실패가 나머지 누락분을 막지 않아야 한다. **현재 코드는 이 불변식을 절반만 지킨다** — `reconcile.ts`의 `try/catch`가 `insertSermon`만 감싸고 바로 다음 `revalidateSermonPaths` 호출은 밖에 있다. `revalidatePath`가 던지면 회차 전체가 죽어 남은 누락분은 시도조차 되지 않는다. 같은 함수 위의 주석도 불변식을 실제보다 넓게 주장하고 있다. `revalidateSermonPaths`를 `try` 안으로 들이고 주석을 실제 범위에 맞춘다.
- **에러 로그에 요청 URL을 넣지 않는다.** Data API는 키를 쿼리스트링에 실어 보내므로 URL을 그대로 남기면 `app_logs`와 Vercel 로그에 키가 남는다. 메서드명·HTTP 상태·정제한 사유만 기록한다.

## 테스트 계획

**이 변경이 무효화하는 기존 단언**

`src/lib/sermons/reconcile.test.ts`의 3개 테스트는 `vi.mock('@/lib/youtube/rapidapi-channel', …)`로 `fetchChannelVideos`를 목킹하고 `YOUTUBE_CHANNEL_ID`만 스텁한다. **이 세 테스트는 소스를 바꿔도 그대로 통과한다** — 테스트 환경에는 `YOUTUBE_API_KEY`가 없어 폴백 분기를 타고 기존 목을 계속 쓰기 때문이다. 즉 주경로가 통째로 검사되지 않는 상태가 된다. 키를 스텁하고 새 Data API 모듈을 목킹하는 케이스를 따로 추가해야 한다.

`src/app/api/jobs/websub-renew/route.test.ts`의 실패 케이스는 `res.status`가 500인지와 `log`가 `'error'`로 불렸는지를 단언하고, 테스트 이름 자체가 "500을 돌려 QStash 재시도를 유도한다"로 그 의도를 못박고 있다. 단언과 이름을 함께 바꾼다. 성공 케이스("200을 돌려주고 로그를 남기지 않는다")는 그대로 유효하다.

`src/lib/sermons/ingest.test.ts`는 `insertSermon`을 세 곳에서 직접 호출하고, 그중 하나가 `create` 메시지를 `'주일예배 - 제목 (주일예배)'`로 고정한다. 출처 인자가 필수가 되면 **세 호출 전부**에 인자를 넘겨야 하고 그 메시지 단언도 바뀐다.

`src/lib/sermons/sync.test.ts`는 `fetchChannelVideos`를 목킹하지만 `insertSermon`도 거치므로, 출처가 `sync`로 넘어가는지 단언을 추가한다.

**추가할 테스트**

- Data API 모듈: `playlistItems.list` 응답 정규화(videoId·제목·publishedAt·썸네일), `videos.list`의 ISO8601 duration → 초 변환, 키 미설정 시 폴백 신호
- `reconcileSermons`: 누락분이 없으면 `videos.list`를 호출하지 않는다(쿼터 절약이 설계 근거이므로 단언으로 고정한다)
- `reconcileSermons`: Data API 403에서 예외를 던지지 않고 `{ checked: 0, inserted: 0 }`으로 끝난다
- 관리자 로그 페이지: `action=warning` 필터가 화이트리스트를 통과한다

**수동 검증**

다음 주일(2026-09-20) 업로드가 폴링 창 안에서 잡히는지, `create … — 폴링` 행이 남는지, 감지 지연이 59분 이내인지 확인한다. 비교 기준은 09-16 수요예배의 12시간 17분이다(20:43 KST 업로드 → `2026-09-17T00:00:10Z` 등록).

## yt-api에 남기는 경로 — 소스는 그대로, 시그니처는 바뀐다

`fetchChannelVideos`는 reconcile 말고도 두 곳이 쓴다. **데이터 소스는 yt-api로 둔다.**

- `src/lib/sermons/sync.ts`(관리자 수동 전체 재동기화)와 `src/lib/sermons/sync.test.ts` — 사람이 누르는 일회성 작업이라 수시간 캐시 지연이 문제되지 않고, 여러 페이지를 훑어야 해 Data API로 옮기면 오히려 호출 수가 는다
- `scripts/seed-from-rapidapi.ts` — 로컬 시드 스크립트
- `docs/specs/2026-06-29-sermon-sync-progress-design.md` — 위 sync 경로를 서술한 문서. 이 설계가 바꾸는 대상이 아니다

**다만 `insertSermon`에 출처 인자가 붙으면 이 두 호출부도 바뀐다.** 직접 호출부는 넷이다 — `reconcile.ts`, `ingest-video/route.ts`, `sync.ts`, `seed-from-rapidapi.ts`. 인자를 선택적으로 두면 새 호출부가 조용히 잘못 분류되므로 필수로 두고, 네 곳을 모두 명시한다. 값은 각각 `reconcile`·`websub`·`sync`·`seed`다.

폴백으로 yt-api를 탄 회차도 출처는 `reconcile`이다. 어느 공급자를 탔는지는 폴백 `warning`이 따로 남기므로 출처 축을 둘로 쪼개지 않는다.

## 함께 고치는 문서

- `.env.example` — **완료(2026-09-17).** `YOUTUBE_API_KEY`를 YouTube 키 묶음에 넣고 리퍼러 제한 금지를 주석으로 적었다. QStash 항목 주석은 주기를 나열하는 대신 등록 스크립트 `main()`의 desired 배열을 유일한 정본으로 가리키게 바꿨다 — README 운영 절 표는 그 사본이라고 명시해, 정본이 둘로 갈리지 않게 했다
- `scripts/qstash-schedules.ts` — 상단 JSDoc의 스케줄 목록과 `console.log` 요약 문자열
- `README.md` — **이번 변경으로 거짓이 되는 문장이 세 곳이다.**
  - 설교 파이프라인 절의 "폴링 없이 실시간으로 등록·자막화·요약까지 자동으로 진행됩니다"
  - WebSub 항목의 "주기적 폴링이 없어 YouTube API 쿼터·함수 호출을 평소엔 0으로 유지합니다"
  - 운영 절의 "`qstash:schedules`는 다음 4개 스케줄을 등록/갱신합니다"와 그 표의 `reconcile-sermons | 매일` 행
- `2026-06-23-youtube-websub-pipeline-design.md` — 머리에 이 문서로의 포인터를 추가한다(완료)

## 알면서 넘기는 것

이번 범위에 넣지 않되 기록은 남긴다. 셋 다 이번 변경이 새로 만든 문제가 아니다.

- **부모 행만 남는 실패는 폴링이 복구하지 못한다.** `insertSermon`은 `sermons` 삽입과 세 자식 행 삽입을 트랜잭션으로 묶지 않는다. 자식 삽입이 깨지면 설교는 공개됐는데 자막·요약·썸네일 행과 `fetch-transcript` 발행이 없고, 이후 reconcile은 `youtube_video_id`만 보고 그 영상을 제외한다. `ingest.ts`의 함수 JSDoc이 이 상태를 이미 기록하고 있다. 폴링 주력 전환이 노출을 늘리지도 줄이지도 않는다.
- **`log()`가 DB 쓰기 실패를 삼킨다.** `websub-renew`가 200을 돌려주게 되면, 허브 503과 `app_logs` 쓰기 실패가 겹쳤을 때 남는 것은 Vercel `console.error`뿐이다. QStash 재전달도 없다. 빈도가 극히 낮고 폴링이 설교 등록을 책임지므로 감수한다.
- **등록 출처를 구조화 컬럼이 아니라 메시지 접미사로 남긴다.** "최근 30일 푸시/폴링 비율" 같은 집계를 하려면 `message` 파싱이 필요해진다. 이 로그의 목적이 사람이 관리자 화면에서 한눈에 보는 것이라 지금은 접미사로 충분하다. 자동 경보나 통계가 필요해지면 `app_logs`에 nullable 컬럼을 추가하는 쪽이 맞다 — 기존 행은 `NULL`로 두면 되므로 백필은 필요 없다.

## 미결정 사항

1. 토픽 URL을 공식 문서 형식(`https://www.youtube.com/feeds/videos.xml?channel_id=`)으로 맞출지. 현재 코드는 `/xml/feeds/`를 쓴다. 이번 장애의 원인이 아니고, 바꾸면 허브에서 새 토픽으로 재구독해야 하는데 푸시가 죽어 있어 검증할 방법이 없다. **이번 범위에서 제외하고 별건으로 남긴다.**
2. 푸시가 상당 기간 복구되지 않으면 WebSub 경로를 걷어낼지. 판단 시점은 정하지 않는다.
3. 폴링 창을 넓힐지. 현재 창은 40건 표본의 범위에 맞췄다. 표본 밖 업로드가 반복되면 재조정한다.
