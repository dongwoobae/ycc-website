# 방문자 접속 분석 (Visitor Analytics) 설계

- 날짜: 2026-07-01
- 대상 저장소: ycc-website
- 상태: 승인됨 (구현 대기)

## 1. 목적

관리자(admin)가 홈페이지 접속 현황을 자체 대시보드에서 확인할 수 있게 한다. Vercel Analytics 유사 기능이되, 데이터를 우리 DB에 쌓아 admin 페이지 내에서 직접 조회한다.

보여줄 지표:
- 방문자 수 / 페이지뷰(PV) 수 (오늘·최근 7일·30일)
- 평균 체류시간 (세션 단위)
- 개별 방문(세션) 로그 — 행을 펼치면 그 세션이 거친 페이지 동선 표시
- 지역(Vercel geo 헤더 기반) 및 마스킹 IP

## 2. 핵심 결정 사항 (확정)

| 항목 | 결정 |
|---|---|
| 수집 방식 | 접근법 A — 클라이언트 트래커 + `/api/track` API 라우트 |
| 방문 단위 | 세션(30분 고정 시간버킷 기반 **결정론적 세션ID** — DB 조회·경쟁조건 없음) |
| 방문자 식별 | **쿠키리스 서버해시** — `sha256(ANALYTICS_SALT + KST날짜 + IP + User-Agent)` |
| 동의 배너 | 불필요 (기기에 저장물 없음). 처리방침 고지는 별도 운영 영역 |
| IP | 마스킹 저장(IPv4 끝옥텟 0, IPv6 하위 비트 0) + 지역명 |
| 지역 산출 | Vercel geo 헤더(`x-vercel-ip-city` 등), 없으면 '알수없음' |
| 추적 범위 | 공개 페이지만. 관리자 본인 제외, 봇/크롤러 제외 |
| 보관 기간 | 상세 로그 **90일** 후 삭제, **일별 집계(방문자·PV)는 영구 보존** |
| 대시보드 경로 | `/admin/analytics` |
| 메뉴 권한 | 모든 관리자 (서버로그와 달리 계정 게이팅 없음) |

## 3. 데이터 모델

단일 테이블 `page_views` (drizzle, `src/lib/db/schema.ts`에 추가):

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 클라이언트가 페이지뷰마다 생성하는 `view_id`. duration UPDATE의 키 |
| `visitor_id` | text notNull | 쿠키리스 일일 해시 (날짜별 로테이션) |
| `session_id` | text notNull | 결정론적 세션 식별자 `hash(visitor_id + KST날짜 + 30분버킷)` |
| `path` | text notNull | 방문 경로 (쿼리스트링 제외) |
| `referrer` | text nullable | 유입 경로 (있으면) |
| `region` | text nullable | 지역명 (예: 'Seoul'), 미상 시 null |
| `ip_masked` | text nullable | 마스킹 IP (예: `123.45.67.0`) |
| `user_agent` | text nullable | 원본 UA (봇 판별·디버그용) |
| `duration_seconds` | integer notNull default 0 | heartbeat/beacon로 갱신되는 체류시간 |
| `created_at` | timestamptz defaultNow | 진입 시각 |

인덱스:
- `(created_at, visitor_id)` — 기간 필터 + KST 일별 `count(distinct visitor_id)`
- `(session_id, created_at)` — 세션 그룹핑·세션별 duration 합산·최신순 정렬
- 세션ID가 결정론적이라 "직전 방문 조회" 인덱스는 불필요(조회 자체가 없음).

최근(≤90일) 지표 산출 (이 테이블로):
- 방문자 수 = `count(distinct visitor_id)`
- PV = `count(*)`
- 세션 수 = `count(distinct session_id)`
- 평균 체류시간 = 세션별 `sum(duration_seconds)`의 평균
- 개별 방문 로그 = `session_id`로 그룹 → 펼치면 해당 세션의 `path` 행들(경로 + 개별 체류)

### 일별 집계 테이블 `daily_page_stats` (영구 보존)

런칭일부터 **완료된 모든 날**을 매일 집계해 보존한다(삭제 여부와 무관). `page_views`가 90일 후 삭제돼도 일별 추이는 이 테이블에 온전히 남는다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `date` | date PK | KST 기준 날짜 |
| `unique_visitors` | integer notNull | 그날 `distinct visitor_id` 수 |
| `page_views` | integer notNull | 그날 총 PV |
| `created_at` | timestamptz defaultNow | 롤업 생성 시각 |

- `visitor_id`는 일일 로테이션 해시라 "그날 distinct visitor_id = 그날 순방문자"로 자연 일치.
- 오늘(진행 중)은 미완료라 집계하지 않고, 대시보드에서 `page_views`로 실시간 계산.
- 대시보드 일별 방문자·PV 추이는 이 테이블(완료된 날) + 오늘 실시간을 합쳐 표시.

## 4. 수집 흐름

### 4.1 클라이언트 트래커 (`src/components/analytics/Tracker.tsx`)
- 공개 레이아웃에만 마운트되는 클라이언트 컴포넌트 (admin 레이아웃에는 미포함 → 관리자 화면 자동 배제).
- 페이지 진입 시:
  1. `view_id = crypto.randomUUID()` 생성
  2. `POST /api/track { type: 'pageview', viewId, path, referrer }`
- 체류 측정 (write 부하 최소화):
  - **주 신호는 leave beacon** — `visibilitychange`(hidden) / `pagehide` 시 `navigator.sendBeacon('/api/track', { type: 'leave', viewId, seconds })`
  - heartbeat는 beacon 유실 대비 **폴백**으로 60초 간격(탭 visible일 때만). 정상 이탈 시엔 1회 leave만으로 충분
  - 백그라운드(탭 비활성) 시간은 누적에서 제외, 최대 체류시간 상한(예: 2시간)으로 이상치 컷
- Next App Router 경로 변경 감지: `usePathname`로 경로 바뀌면 이전 view의 leave 처리 후 새 view 시작.

### 4.2 API 라우트 (`src/app/api/track/route.ts`, Node 런타임)
`POST`만 처리. **입력 검증·제외를 라우트 자체에서 수행**(클라 마운트 위치는 심층방어일 뿐, 진짜 게이트 아님). 요청 타입별:
- 공통 선처리:
  - **경로 allowlist** — `path`가 공개 경로 규칙을 벗어나면(`/admin`,`/api`,`/sign-in`,정적자산 등) 즉시 204
  - **관리자 제외** — better-auth 세션 존재 시 204
  - **봇 제외** — User-Agent 크롤러 패턴이면 204 (best-effort)
  - **레이트리밋** — visitor_id 기준 단순 상한(과도한 write·스팸 차단)
- `pageview`:
  1. IP 추출(`x-forwarded-for` 첫 값) → 마스킹, 지역(`x-vercel-ip-city`/`region`) 추출
  2. `visitor_id = sha256(ANALYTICS_SALT + kstDate + ip + ua)`
  3. `session_id = hash(visitor_id + kstDate + floor(epochMs / 1800000))` — **결정론적, DB 조회 없음**(경쟁조건 제거). 30분 고정버킷 경계에서 방문이 갈리는 근사는 감수
  4. `insert page_views (id=viewId, visitor_id, session_id, path, referrer, region, ip_masked, user_agent, duration_seconds=0)`
- `heartbeat` / `leave`:
  - `update page_views set duration_seconds = greatest(duration_seconds, :seconds)`
    `where id = :viewId and visitor_id = :recomputedVisitorId and created_at > now() - interval '3 hours'`
  - **visitor_id 재계산 일치**를 요구해 남의 view 조작 차단, 3시간 창으로 오래된 행 갱신 차단, `greatest`로 순서 무관 최댓값 유지, 상한으로 이상치 컷

### 4.3 유틸리티
- `src/lib/analytics/ip.ts` — `maskIp(ip)` (IPv4/IPv6), `hashVisitor(salt, date, ip, ua)`, `sessionId(visitorId, date, epochMs)`
- `src/lib/analytics/bots.ts` — `isBot(userAgent)` (googlebot/bingbot/crawler/spider/bot 등 패턴)
- `src/lib/analytics/paths.ts` — `isTrackablePath(path)` (공개경로 allowlist)
- `ANALYTICS_SALT` env 미설정 시 부팅/최초 사용 시점에 명확한 에러(가드). `.env`는 사용자가 직접 설정.

### 4.4 롤업 + 보관 정리 잡 (QStash 크론)

기존 QStash 패턴 재사용 (`verifyQStash` + `/api/jobs/{job}` + `scripts/qstash-schedules.ts` 등록).

- 신규 잡: `JobName`에 `analytics-rollup` 추가, 라우트 `src/app/api/jobs/analytics-rollup/route.ts`.
- 서명 검증: `verifyQStash`로 QStash 서명 확인, 실패 시 401 (기존 잡과 동일).
- 매일 1회 실행 (예: KST 00:10 = UTC 15:10, cron `10 15 * * *`; QStash cron은 UTC 기준임에 유의).
- 동작:
  1. **롤업** — `daily_page_stats`에 아직 없는 **완료된 모든 날**(어제까지, 누락분 백필 포함)을 `page_views`에서 KST 날짜별 `distinct visitor_id`·`count(*)`로 집계해 upsert. 오늘은 미완료라 제외.
  2. **삭제** — `created_at < now() - 90 days`인 `page_views` 행 삭제.
- 순서 보장: 반드시 롤업 완료 후 삭제. 롤업이 매 실행마다 미집계 완료일을 **전부 백필**하고 보관선(90일)이 일별 갭(1일)보다 훨씬 크므로, 집계 안 된 날이 삭제되는 일은 없음.
- 타임존: 롤업 집계 키는 KST 날짜, 삭제 임계는 절대시각(`now()-90d`) — 둘은 목적이 달라 혼용 문제 없음(집계 우선 후 삭제).
- 스케줄 등록: `scripts/qstash-schedules.ts`에 `upsertSchedule({ job: 'analytics-rollup', cron: '10 15 * * *', scheduleId: 'ycc-analytics-rollup' })` 추가.

## 5. 대시보드 UI (`src/app/admin/analytics/page.tsx`)

- admin 레이아웃 nav에 "접속 분석"(`/admin/analytics`) 추가 — 모든 관리자 노출.
- 인증: `verifySession()`만 (계정 게이팅 없음).
- 상단 요약 카드 3개: 오늘 / 최근 7일 / 최근 30일 각각 방문자·PV·평균 체류시간.
- 기간 선택(오늘/7일/30일 토글 또는 from~to).
- 하단 세션 목록 테이블: 컬럼 = 시작시각 · 지역 · IP(마스킹) · 페이지수 · 총 체류시간.
  - 행 클릭 시 드롭다운으로 해당 세션의 페이지 동선(경로 + 진입시각 + 개별 체류) 펼침.
- 일별 방문자·PV 추이: `daily_page_stats`(완료된 날) + 오늘은 `page_views` 실시간. 세션 상세 드릴다운은 최근 90일 `page_views` 사용.
- 페이지네이션: 기존 `/admin/log` 패턴(PAGE_SIZE+1 조회) 재사용.
- 서버 컴포넌트로 집계 쿼리 수행, 드롭다운 펼침은 서버에서 세션별 rows를 미리 내려 클라이언트 토글(또는 `<details>`)로 처리.

## 6. 에러 처리 / 엣지 케이스

- 트래커/track 라우트 실패는 **조용히 무시**(사용자 경험에 영향 0). 서버 로거로만 남김.
- `view_id` 위조/중복: id는 클라 생성값이라 신뢰 불가 → duration UPDATE를 `visitor_id 재계산 일치 + 최근 3h`로 스코프하고 상한·레이트리밋으로 방어(§4.2).
- 로컬 개발: Vercel geo 헤더 없음 → region='알수없음', IP는 `127.0.0.x`.
- SPA 내비게이션·프리페치: 트래커가 실제 pathname 변경만 pageview로 기록.

### 정확도·한계 (대시보드에 명시)

- **방문자 수는 "일일 순방문자 근사치"** — 쿠키리스 해시라 공유 IP/NAT·모바일 IP 변동·UA 변화로 과소·과대 오차가 있고, 날짜 넘는 동일인 식별은 불가(의도된 트레이드오프).
- **체류시간은 "근사(하한 경향)"** — sendBeacon/heartbeat 유실·모바일 백그라운드·강제종료로 실제보다 짧게 잡힐 수 있음. 대시보드 라벨에 '근사'를 표기.
- **SALT 정책** — `ANALYTICS_SALT`(정적) + KST날짜로 일 단위 로테이션. 정적 솔트라 솔트 유출 시 특정일 재식별 이론상 가능 → 교회 사이트 수준에선 수용, 필요 시 주기적 솔트 교체로 강화 가능.

## 7. 테스트 (vitest)

- `maskIp` — IPv4/IPv6 마스킹 정확성
- `hashVisitor` — 동일 입력 동일 해시, 날짜 바뀌면 다른 해시, 솔트 없으면 에러
- `isBot` — 대표 크롤러 UA true, 일반 브라우저 UA false
- `sessionId` 결정론 — 같은 버킷=동일ID(조회 없이), 30분 버킷 경계 넘으면 다른 ID
- 경로 allowlist — 공개경로 통과 / `/admin`·`/api`·정적 차단
- duration UPDATE 스코프 — visitor_id 불일치·3h 초과 행은 갱신 안 됨, greatest 최댓값 유지
- 대시보드 집계 — 방문자/PV/세션/평균체류 계산 (샘플 rows fixture)

## 8. 범위 밖 (YAGNI)

- 실시간(라이브) 접속자 뷰
- 유입 채널/UTM 분석, 이탈률, 전환 퍼널
- 인기 페이지 순위 (요청 시 추후 추가 — 데이터는 이미 있음)
- 차트 라이브러리 도입 (초기엔 숫자 카드 + 테이블, 필요 시 후속)
- 일별 외 주/월 단위 롤업 (일별 집계로 충분, 필요 시 후속)
