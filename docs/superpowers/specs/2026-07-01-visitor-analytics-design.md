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
| 방문 단위 | 세션(30분 비활동 시 새 세션) |
| 방문자 식별 | **쿠키리스 서버해시** — `sha256(ANALYTICS_SALT + KST날짜 + IP + User-Agent)` |
| 동의 배너 | 불필요 (기기에 저장물 없음). 처리방침 고지는 별도 운영 영역 |
| IP | 마스킹 저장(IPv4 끝옥텟 0, IPv6 하위 비트 0) + 지역명 |
| 지역 산출 | Vercel geo 헤더(`x-vercel-ip-city` 등), 없으면 '알수없음' |
| 추적 범위 | 공개 페이지만. 관리자 본인 제외, 봇/크롤러 제외 |
| 보관 기간 | 무기한 (삭제 잡 없음) |
| 대시보드 경로 | `/admin/analytics` |
| 메뉴 권한 | 모든 관리자 (서버로그와 달리 계정 게이팅 없음) |

## 3. 데이터 모델

단일 테이블 `page_views` (drizzle, `src/lib/db/schema.ts`에 추가):

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 클라이언트가 페이지뷰마다 생성하는 `view_id`. duration UPDATE의 키 |
| `visitor_id` | text notNull | 쿠키리스 일일 해시 (날짜별 로테이션) |
| `session_id` | uuid notNull | 서버 판정 세션 식별자 |
| `path` | text notNull | 방문 경로 (쿼리스트링 제외) |
| `referrer` | text nullable | 유입 경로 (있으면) |
| `region` | text nullable | 지역명 (예: 'Seoul'), 미상 시 null |
| `ip_masked` | text nullable | 마스킹 IP (예: `123.45.67.0`) |
| `user_agent` | text nullable | 원본 UA (봇 판별·디버그용) |
| `duration_seconds` | integer notNull default 0 | heartbeat/beacon로 갱신되는 체류시간 |
| `created_at` | timestamptz defaultNow | 진입 시각 |

인덱스:
- `(visitor_id, created_at)` — 세션 판정(직전 방문 조회) 및 방문자 집계
- `(created_at)` — 기간 집계/목록 정렬
- `(session_id)` — 세션 그룹 조회

지표 산출 (별도 테이블 없이 이 테이블로):
- 방문자 수 = `count(distinct visitor_id)`
- PV = `count(*)`
- 세션 수 = `count(distinct session_id)`
- 평균 체류시간 = 세션별 `sum(duration_seconds)`의 평균
- 개별 방문 로그 = `session_id`로 그룹 → 펼치면 해당 세션의 `path` 행들(경로 + 개별 체류)

## 4. 수집 흐름

### 4.1 클라이언트 트래커 (`src/components/analytics/Tracker.tsx`)
- 공개 레이아웃에만 마운트되는 클라이언트 컴포넌트 (admin 레이아웃에는 미포함 → 관리자 화면 자동 배제).
- 페이지 진입 시:
  1. `view_id = crypto.randomUUID()` 생성
  2. `POST /api/track { type: 'pageview', viewId, path, referrer }`
- 체류 측정:
  - 15초마다 heartbeat: `POST /api/track { type: 'heartbeat', viewId, seconds }`
  - `visibilitychange`(hidden) / `pagehide` 시 `navigator.sendBeacon('/api/track', { type: 'leave', viewId, seconds })`
  - 백그라운드(탭 비활성) 시간은 누적에서 제외, 최대 체류시간 상한(예: 2시간)으로 이상치 컷
- Next App Router 경로 변경 감지: `usePathname`로 경로 바뀌면 이전 view의 leave 처리 후 새 view 시작.

### 4.2 API 라우트 (`src/app/api/track/route.ts`, Node 런타임)
`POST`만 처리. 요청 타입별:
- `pageview`:
  1. **관리자 제외** — better-auth 세션 존재 시 즉시 204 (기록 안 함)
  2. **봇 제외** — User-Agent가 크롤러 패턴이면 204
  3. 헤더에서 IP 추출(`x-forwarded-for` 첫 값) → 마스킹, 지역(`x-vercel-ip-city`/`region`) 추출
  4. `visitor_id = sha256(ANALYTICS_SALT + kstDate + ip + ua)`
  5. **세션 판정** — 해당 `visitor_id`의 최신 `page_views.created_at` 조회: 30분 이내면 그 `session_id` 재사용, 아니면 새 uuid
  6. `insert page_views (id=viewId, visitor_id, session_id, path, referrer, region, ip_masked, user_agent, duration_seconds=0)`
- `heartbeat` / `leave`:
  - `update page_views set duration_seconds = greatest(duration_seconds, :seconds) where id = :viewId`
  - (greatest로 heartbeat·beacon 순서 무관하게 최댓값 유지)

### 4.3 유틸리티
- `src/lib/analytics/ip.ts` — `maskIp(ip)` (IPv4/IPv6), `hashVisitor(salt, date, ip, ua)`
- `src/lib/analytics/bots.ts` — `isBot(userAgent)` (googlebot/bingbot/crawler/spider/bot 등 패턴)
- `ANALYTICS_SALT` env 미설정 시 부팅/최초 사용 시점에 명확한 에러(가드). `.env`는 사용자가 직접 설정.

## 5. 대시보드 UI (`src/app/admin/analytics/page.tsx`)

- admin 레이아웃 nav에 "접속 분석"(`/admin/analytics`) 추가 — 모든 관리자 노출.
- 인증: `verifySession()`만 (계정 게이팅 없음).
- 상단 요약 카드 3개: 오늘 / 최근 7일 / 최근 30일 각각 방문자·PV·평균 체류시간.
- 기간 선택(오늘/7일/30일 토글 또는 from~to).
- 하단 세션 목록 테이블: 컬럼 = 시작시각 · 지역 · IP(마스킹) · 페이지수 · 총 체류시간.
  - 행 클릭 시 드롭다운으로 해당 세션의 페이지 동선(경로 + 진입시각 + 개별 체류) 펼침.
- 페이지네이션: 기존 `/admin/log` 패턴(PAGE_SIZE+1 조회) 재사용.
- 서버 컴포넌트로 집계 쿼리 수행, 드롭다운 펼침은 서버에서 세션별 rows를 미리 내려 클라이언트 토글(또는 `<details>`)로 처리.

## 6. 에러 처리 / 엣지 케이스

- 트래커/track 라우트 실패는 **조용히 무시**(사용자 경험에 영향 0). 서버 로거로만 남김.
- `view_id` 위조/중복: id는 클라 생성이므로 신뢰 불가 값. 악용해도 자기 세션 duration만 조작 가능 → 영향 경미. 필요 시 duration 상한으로 방어.
- 로컬 개발: Vercel geo 헤더 없음 → region='알수없음', IP는 `127.0.0.x`.
- SPA 내비게이션·프리페치: 트래커가 실제 pathname 변경만 pageview로 기록.

## 7. 테스트 (vitest)

- `maskIp` — IPv4/IPv6 마스킹 정확성
- `hashVisitor` — 동일 입력 동일 해시, 날짜 바뀌면 다른 해시, 솔트 없으면 에러
- `isBot` — 대표 크롤러 UA true, 일반 브라우저 UA false
- 세션 판정 로직 — 30분 경계(이내=재사용 / 초과=신규)
- 대시보드 집계 — 방문자/PV/세션/평균체류 계산 (샘플 rows fixture)

## 8. 범위 밖 (YAGNI)

- 실시간(라이브) 접속자 뷰
- 유입 채널/UTM 분석, 이탈률, 전환 퍼널
- 인기 페이지 순위 (요청 시 추후 추가 — 데이터는 이미 있음)
- 데이터 보관/삭제 자동화 (무기한 결정)
- 차트 라이브러리 도입 (초기엔 숫자 카드 + 테이블, 필요 시 후속)
