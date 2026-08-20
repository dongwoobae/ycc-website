# 설교 동기화 실시간 진행률 (SSE) — 설계

작성일: 2026-06-29

## 배경 / 문제

관리자 설교 페이지의 "지금 동기화" 버튼은 yt-api(RapidAPI)로 채널 영상을 가져와
신규 영상을 등록하고, 정기예배는 자막+AI요약까지 인라인으로 처리한다. 처리에 수십 초~수 분이
걸릴 수 있으나 현재 UI는 진행상황을 전혀 보여주지 않는다. 비개발자(목사님·장로님)가
관리할 때 멈춘 것으로 오해해 창을 닫거나 재클릭할 위험이 있다.

ENMAD_FE_Admin의 FAQ 전체 임베딩 재생성(`/api/admin/faq/embed-all/stream`)이
SSE 스트리밍 + 프로그레스바 모달로 이 문제를 해결한 선례가 있어 동일 패턴을 적용한다.

## 결정 사항

1. **실제 진행률** — FAQ와 동일한 SSE(Server-Sent Events) 스트리밍.
2. **확인 후 시작** — 모달 phase: `confirm → progress → done`.
3. **인라인 요약 유지** — 프로그레스바가 실제 자막+요약 진행을 반영. (현재 동작 보존)
4. **진행률 분모 = 신규 영상 수** — 목록 가져오는 동안은 부정형 표시,
   신규가 확정되면 `current/total` 바, 신규 0건이면 즉시 완료.

## 아키텍처 (3계층)

### ① 백엔드 — 신규 SSE 라우트
`src/app/api/admin/sermons/sync/stream/route.ts` (GET)

- **인증**: `auth.api.getSession({ headers })`로 세션 확인, 없으면 `401` 반환.
  (쿠키 자동 전송 → Bearer 토큰 불필요. `requireAdmin`은 미로그인 시 redirect라 API엔
  부적합하므로 직접 세션 체크 후 401.)
- **스트림**: `ReadableStream`을 만들어 `resyncAllSermons(onProgress)` 실행.
  - 콜백마다 `event: progress\ndata: {current,total,title,phase}` enqueue
  - 정상 종료 시 `event: done\ndata: {inserted,summarized}`
  - 예외 시 `event: error\ndata: {message}` 후 종료
- **헤더**: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`.
- **`export const maxDuration = 300`** — 인라인 요약 고려.
  ⚠️ Vercel 플랜 의존: Hobby는 60초 상한. 신규 영상 다수 시 끊길 수 있으며,
  이 경우 재실행으로 이어받는다(insert는 `onConflictDoNothing` 멱등). 상수로 명시해 조정 가능.

### ② 도메인 — `resyncAllSermons` 리팩터
`src/lib/sermons/sync.ts`

```ts
interface SyncProgress { current: number; total: number; title: string; phase: string }
export async function resyncAllSermons(
  onProgress?: (p: SyncProgress) => void,
): Promise<{ inserted: number; summarized: number }>
```

- `fetchChannelVideos` 후 **신규 영상을 먼저 선별**해 `total` 확정.
- 영상별 처리 직전 `onProgress({ current, total, title, phase })` 호출.
  - `phase`: `'등록'` → (정기예배면) `'자막·요약 중'`.
- 기존 insert / transcript / summarize 흐름·멱등성 그대로.
- `onProgress`가 없으면 기존처럼 동작(하위호환).
- `syncNowAction` 서버액션은 SSE로 대체되어 미사용 → 제거.

### ③ 프론트 — 훅 + 모달 분리
컴포넌트 50줄 규칙·관심사 분리를 위해 둘로 나눈다.

- `src/components/admin/useSermonSync.ts`
  - phase / progress / doneMsg 상태 관리.
  - SSE 스트림 리더(FAQ `handleEmbedAll` 패턴: `fetch` → `body.getReader()` 루프 →
    `\n\n` 분할 → `event:` / `data:` 파싱).
  - 10분 타임아웃(`AbortController`), 중복 실행 락(`useRef`), 연결끊김(done 미수신) 처리.
  - 완료 시 `useRouter().refresh()`로 표 갱신.
  - 반환: `{ phase, progress, doneMsg, open, start, close }`.
- `src/components/admin/SermonSyncModal.tsx`
  - 모달 UI: `confirm` / `progress` / `done` 단계.
  - 프로그레스바: `width = total>0 ? current/total*100% : 0`.
  - "진행 중엔 창을 닫지 마세요" 안내, `progress` 단계에선 닫기 버튼 숨김.
  - 순수 표현 컴포넌트 — 훅 상태로 구동.
- `src/components/admin/SermonAdminTable.tsx`
  - 기존 "지금 동기화" 버튼이 훅의 `open()`(confirm 모달) 호출하도록 교체.
  - `<SermonSyncModal>` 렌더. publish 토글 로직은 유지.

## 데이터 흐름

```
[지금 동기화] 클릭 → 모달 confirm
  → [시작] → fetch(/api/admin/sermons/sync/stream)
     → 서버: 채널 목록 → 신규 선별(total=N)
        → 영상별: insert → (정기예배면) 자막+요약 → progress 송출
     → 클라: progress 이벤트마다 바 갱신 (current/total, 제목, phase)
  → done(inserted, summarized) → done 모달 → router.refresh()
```

## SSE 이벤트 스키마

| event    | data                                   |
|----------|----------------------------------------|
| progress | `{ current, total, title, phase }`     |
| done     | `{ inserted, summarized }`             |
| error    | `{ message }`                          |

## 에러 처리

- 서버 예외 → `event: error{message}` 후 스트림 종료 → 모달 done 단계에 실패 메시지.
- 연결 끊김(done 미수신) → "연결이 끊겼습니다. 다시 실행해 주세요"
  (insert 멱등이라 재실행 안전).
- 클라 10분 타임아웃(AbortController) → 시간 초과 메시지.

## 테스트

- 순수 단위: SSE 포맷 헬퍼(`event:`/`data:` 직렬화), 신규영상 선별 로직.
- `resyncAllSermons` onProgress 호출 검증(기존 db 목 활용).
- 그 외 build + lint + 수동 검증(ycc 기존 방침).

## 변경 파일 요약

신규:
- `src/app/api/admin/sermons/sync/stream/route.ts`
- `src/components/admin/useSermonSync.ts`
- `src/components/admin/SermonSyncModal.tsx`

수정:
- `src/lib/sermons/sync.ts` (`resyncAllSermons`에 onProgress 추가)
- `src/lib/actions/sermons.ts` (`syncNowAction` 제거)
- `src/components/admin/SermonAdminTable.tsx` (버튼 → 모달 연결)

## 범위 밖 (YAGNI)

- 요약 비동기(QStash) 전환 — 인라인 유지 결정. (단, 자막 실패 시 폴백으로 QStash는 사용 — 아래 개정 참조)
- 일시정지/재개, 부분 취소 — 미지원(닫기 차단으로 충분).
- 진행률 영속화·새로고침 후 복원 — 단발 작업이라 불필요.

## 개정 (2026-06-29, codex 비판 반영)

- **라우트 GET→POST**: 상태변경에 GET은 CSRF 노출. fetch 스트리밍(EventSource 아님)이라 POST 가능.
- **Vercel 스트리밍 보강**: 라우트에 `runtime='nodejs'`, `dynamic='force-dynamic'`, heartbeat(`: ping`, 15s) 추가. 실배포 curl로 flush 확인.
- **공개 ISR 갱신**: 라우트 done 직전 `revalidatePath('/','/sermons','/admin/sermons')` (기존 syncNowAction 동작 복원). 클라는 추가로 `router.refresh()`.
- **SSE 파서 분리**: 파싱을 `sse.ts`의 순수 `drainSseEvents(buffer)`로 추출(comment/heartbeat skip·멀티 data join·rest 보존) + 단위테스트. 훅은 언마운트 시 abort.
- **자막 미준비 QStash 폴백**: `resyncAllSermons`에서 자막 실패 시 `publishJob('fetch-transcript')` best-effort 발행 → 배경 재시도로 "영구 미요약" 갭 완화(insert 후 요약 전 중단 잔여 갭은 known limitation).
- **클라 타임아웃 330s**: 서버 maxDuration 300s 직후 backstop. 보통은 스트림 close로 먼저 종료.
- **동시실행 가드 보류**: pg advisory lock은 neon-http(stateless HTTP 드라이버)에서 작동 불가, row-lock은 마이그레이션 비용. 폐쇄몰·관리자 소수 전제로 클라 lockRef만 유지, 다탭 동시실행은 known limitation.
