# ycc-website 코드 리뷰 (2026-06-18)

방법: Superpowers `requesting-code-review` 템플릿으로 5개 파트(책임 계층)별 서브에이전트 리뷰.
핵심 발견은 main 스레드에서 파일 직접 열람으로 **검증 완료**(✅ 표시).

스택: Next.js 16 (App Router, React 19 RSC) · better-auth · Drizzle ORM + Neon(neon-http) · Cloudflare R2(S3) · Tailwind v4.

요약: 아키텍처/플럼빙은 견고. 변경(write) 액션은 인증 재검증 정상. 단 **Critical 4건(보안/데이터 유출·파괴)** 과 다수 Important 존재.

---

## 🔴 Critical (반드시 수정)

### C1. 비인증 공개 서버액션으로 주보 데이터 유출 ✅
- 위치: `src/lib/actions/bulletins.ts:185-192` (`getBulletinForAdmin`, `getBulletinsForAdmin`)
- 문제: 파일 상단 `'use server'` → 모든 export가 공개 호출 가능한 서버액션 엔드포인트. 이 두 getter는 인증 없이 `db.select`만 함.
- 영향: 비인증자가 액션 ID로 주보 전체(미공개 초안·`hwpSourceUrl` 포함) 탈취 가능.
- 수정: `requireSession()` 추가, 또는 읽기 헬퍼를 `'use server'` 밖 `import 'server-only'` 모듈로 이동.

### C2. admin 읽기 페이지가 레이아웃 게이트에만 의존 ✅
- 위치: `src/app/admin/posts/page.tsx:11` 외 gallery/bulletins 목록·edit·new 페이지
- 문제: 페이지 자체 세션 체크 없이 `db.select`. 이 fork의 Next 문서(`node_modules/next/dist/docs/.../authentication.md`)가 "레이아웃은 보안 경계 아님(부분 렌더링)"이라 명시.
- 영향: 부분 렌더링/직접 RSC 페이로드 요청으로 우회 시 admin 데이터(미공개 글/앨범/주보) 노출.
- 수정: DAL `verifySession()`을 페이지 상단·데이터 게터마다 호출.

### C3. 미공개 설교가 공개 페이지로 유출 ✅
- 위치: `src/lib/data/sermons.ts:44-46` (`getSermonById`)
- 문제: `id`만 필터, `isPublished` 누락(형제 getter 4개는 모두 필터). 공개 라우트 `src/app/sermons/[id]/page.tsx:28`가 null일 때만 `notFound()`.
- 영향: UUID만 알면 누구나 미공개 설교(제목·영상·요약·OG) 열람.
- 수정: `where(and(eq(id), eq(isPublished, true)))`. 필요 시 별도 `getSermonForAdmin`.

### C4. 클라이언트 입력으로 임의 R2 객체 삭제 ✅
- 위치: `src/lib/r2.ts:70-82` (`keyFromUrl`) + `src/lib/actions/bulletins.ts` (`hwpSourceUrl` diff 삭제)
- 문제: `hwpSourceUrl`은 자유입력 문자열. `keyFromUrl`이 base 불일치 시 임의 URL pathname/raw 문자열을 키로 반환 → `deleteFromR2`로 전달.
- 영향: 인증된 작성자가 `hwpSourceUrl`을 조작해 버킷 내 임의 객체(다른 주보·갤러리 이미지) 삭제 가능 — 파괴 primitive.
- 수정: `hwpSourceUrl`은 `parseHwpAction`이 반환한 `bulletins/` prefix URL만 저장·삭제 허용. `deleteFromR2` 호출부에 prefix 단언.

---

## 🟠 Important (수정 권장)

### 인증·인가 (Part 1)
- **I1. `VERCEL_URL` 이중 https** — `src/lib/auth.ts:10` `https://${VERCEL_URL}`. 커밋된 `.env*`가 `VERCEL_URL=https://...앞뒤슬래시`라 `https://https://...`로 깨짐 → trustedOrigin(CSRF 방어) 무력화. scheme/trailing-slash 정규화 + `.env` 수정.
- **I2. write 액션이 authn-only, role 미검증** — seed-only라 현재 OK지만 비-super-admin 계정 생기면 전권. `requireAdmin()` 심 마련.
- **I3. authz 로직 중복(4곳)** — posts 인라인 4회 / gallery·bulletins 각자 `requireSession` / 페이지 가드 별도. → `src/lib/dal.ts` 단일화. **DAL 도입 시 C2·I2·I3·getSession중복 동시 해결.**

### 데이터 계층 (Part 2)
- **마이그레이션 파일 깨짐** — `supabase/migrations/001_initial.sql`이 `bulletins`/`gallery_albums`/`gallery_images` 3테이블 누락, 폐기된 Supabase `auth.users`/RLS 참조, 한글 mojibake, category check 값 불일치. 사실상 `drizzle push` 관리 중. → 전략 통일(generate 재생성 후 stale 삭제) + CI `drizzle-kit check`.
- **인덱스 전무** — `gallery_images.album_id`(매 갤러리뷰 join/group), `sermons(is_published, sermon_date)`, `posts(is_published, is_pinned, published_at)`, `bulletins(is_published, bulletin_date)`, `gallery_albums`. auth-schema는 FK 인덱스 정상. → 부분/복합 인덱스 추가.

### 서버 액션·파일 (Part 3)
- **Content-Type 클라통제 + magic-byte 검증 없음** — `src/lib/actions/gallery.ts:35`, `src/lib/r2.ts:54`. 공개 버킷에 attacker MIME 저장 → stored-XSS/스푸핑. → 매직바이트 sniff + 서버 allowlist ContentType.
- **`reorderImages` 비원자** ✅ — `db/index.ts`가 `neon-http`(트랜잭션 불가)인데 `gallery.ts:217,232`가 `Promise.all` N개 UPDATE → 부분 실패 시 sortOrder 깨짐. → 단일 bulk `UPDATE ... CASE` 또는 WebSocket Pool+트랜잭션.
- **삭제 순서 비일관 + R2 실패 무시** — `deleteAlbum`은 R2→DB(역순), 전부 `.catch(()=>undefined)`로 고아 무로깅. → DB-first + 실패 로깅.
- **HWP 고아객체** — `parseHwpAction` 업로드 후 폼 미제출 시 R2에 영속 누적, 정리 경로 없음. → 영속까지 업로드 지연 또는 staged TTL.

### 어드민 UI (Part 4)
- **Gallery 상태 미동기화** ✅ — `GalleryImageManager.tsx:22` `useState(images)`+useEffect 없음. 추가 후 `router.refresh()` 해도 새 사진 안 보임(삭제는 로컬 필터로만). → props 단일소스 또는 동기화.
- **index-as-key** ✅ — `BulletinRowsEditor:21`/`TablesEditor:26`/`OfferingsEditor:26`. 중간 삭제 시 포커스/IME 조합 상태가 엉뚱한 필드로. → 안정 id로 key.
- **파괴적 작업 확인 0건** ✅ — `confirm(` 전무. 앨범 삭제(이미지+R2 캐스케이드 비가역) 포함 즉시 실행. table-row 삭제는 pending/중복클릭 방어도 없음. → 공유 `SubmitButton`(`useFormStatus`)+confirm.
- **BodyEditor split/join 손상** — `BulletinSectionText.tsx:9`. 빈 textarea가 `['']`, 테이블은 탭조인(`TablesEditor:45`)이라 셀 내 탭/열수 불일치 시 무음 손상. → 제출 시 정규화·검증, 탭구분 에디터 교체.

### 공개 페이지·공용 UI (Part 5)
- **sitemap.ts / robots.ts 부재** ✅ — 공개 SEO 사이트인데 없음. → 데이터기반 sitemap + robots.
- **Pretendard `@import` 렌더블로킹** ✅ — `globals.css:1` jsDelivr CSS import. → `next/font`로 이관(self-host).
- **한글 serif subset latin-only** ✅ — `layout.tsx:10` `Nanum_Myeongjo` `subsets:['latin']`. 한글 서브셋/프리로드 불가. → next/font/local 서브셋 self-host.
- **원격/로컬 이미지 raw `<img>`** — 카드/갤러리/`PastorKakaoCard.tsx:8`(로컬 QR). → `images.remotePatterns`+`next/image` 또는 최소 `loading="lazy"`/`decoding="async"`.
- **ISR/revalidate 전무** — 공개 list/detail 매 요청 Neon 직타. → `export const revalidate` 추가.
- **예배시간 사실 불일치** ✅ — 새벽기도가 Footer "매주일 오전 5:00" / about/visit "화-주일 오전 5시" / WorshipTimes "화-주일"로 제각각 하드코딩. → `lib/worship.ts` 중앙화.

---

## 🟡 Minor
- `.env.example` 시크릿 오타 `SCECRET_KEY`, 가이드 부재
- `getLatestPosts` 전체 fetch 후 JS slice (SQL `.limit()` 써야) — `posts.ts:39`
- `select()` 전컬럼 over-fetch (매퍼가 다수 컬럼 버림)
- `view_count` 죽은 컬럼 (읽기/증가 없음) — `schema.ts:48`
- `profiles`(uuid) ↔ better-auth `user`(text) 타입 갭 + FK 미모델
- `updatedAt` `$onUpdate` 누락 (posts/bulletins)
- `bodySizeLimit` 10mb vs HWP 10MB 캡 경계충돌
- `inflateRawSync` 압축해제 무제한 (zip-bomb 여지) — `hwp/parse.ts:75`
- 죽은 스텁: 대시보드 "-", sermons "새 설교 등록" 무동작 버튼, stale `// TODO: Supabase` 주석
- news 메타 description 미truncate — `news/[id]/page.tsx:16`
- skip-to-content 링크 부재, `<main>` id 없음
- Visit 블록 중복 (`home/Visit.tsx` ↔ `newfamily`)
- 홈 placeholder 이미지(실사진 미탑재)

---

## 권장 수정 순서
1. **Critical 4건** (C1·C3·C4 직접 패치, C2는 DAL로)
2. **DAL 도입** (`src/lib/dal.ts`, `server-only`+`cache`) → C2·I2·I3·getSession중복 동시 해결
3. 데이터: 마이그레이션 전략 통일 + 인덱스
4. 업로드 보안: Content-Type 검증, R2 prefix 단언, 삭제순서/로깅
5. UI: Gallery 동기화·index key·삭제확인·BodyEditor
6. 런치품질: sitemap/robots·font·ISR·이미지·예배시간 중앙화
7. Minor 일괄

## 파트별 판정
| Part | 영역 | 판정 |
|------|------|------|
| 1 | 인증·인가 | No (with fixes) — C1·C2 |
| 2 | 데이터 계층 | No — C3 + 마이그레이션 |
| 3 | 서버액션·파일 | No — C4 + 업로드 |
| 4 | 어드민 UI | With fixes (Critical 없음) |
| 5 | 공개·공용 UI | With fixes (Critical 없음) |
