# 주보 재건축 설계 — 원본 이미지 + 「이번 주 한눈에」 카드

날짜: 2026-07-30
기준 브랜치: main
레퍼런스: https://www.jangji.org/ (주보를 면별 이미지로 게시하는 방식)

## 배경

현재 주보는 업로드된 `.hwp` 바이너리를 직접 해독해 표·문단을 복원하고, 그 결과를 섹션 카드로 세로 나열한다. 두 가지 문제가 있다.

**복원이 불완전하다.** `src/lib/hwp/parse.ts`는 CFB 컨테이너에서 레코드 태그를 읽어 표 구조를 되살리지만, "이 문단이 섹션 제목인가"를 주보 서식이 쓰는 사설 글리프(`\u{f0076}`)와 문자 마커로 추측한다. 마커가 없는 블록은 앞 섹션에 뭉치고, 표만 있는 구간은 `표 1`, `표 2` 같은 이름으로 떨어진다.

**한눈에 안 보인다.** 교회를 자주 다니는 교인은 주보를 매주 본다. 이들이 원하는 것은 주간 일정표와 예배 순서·담당자를 빠르게 확인하는 것인데, 현재 화면은 추출된 섹션을 위에서 아래로 균등하게 쌓아 어느 것이 중요한지 드러나지 않는다.

## 방향 결정

AI로 의미를 매핑하는 안(파서는 구조만, Gemini가 분류)을 검토했으나, **잘못된 정보가 생성될 여지를 없애는 쪽**을 택했다. 대신 원본을 이미지로 그대로 띄운다.

원본 이미지만으로는 모바일에서 A4 4면의 글자가 2~3px가 되어 "한눈에"가 성립하지 않는다. 그래서 **관리자가 직접 타이핑한 「이번 주 한눈에」 카드를 상단에 두고, 그 아래에 원본 이미지 뷰어를 붙인다.** 카드는 사람이 쓴 것이라 100% 정확하고, 확대 없이 읽히는 유일한 부분이며, 이미지 방식이 잃는 검색·스크린리더 접근성을 부분적으로 되살린다.

관리자 작업량은 주당 5~10분(PDF 업로드 1회 + 카드 필드 타이핑)으로 잡는다.

### 수용된 리스크 — 헌금 명단 공개

현재 파서는 `stripOfferingBlocks` / `isSensitiveTable` / `stripOfferingParagraphs`로 `헌금|십일조` 머리글 이하 블록과 봉헌자 실명을 의도적으로 걸러낸다. 원본 이미지를 그대로 게시하면 **그 명단이 공개 URL로 노출된다.**

사용자 확정 결정: **그대로 공개한다.** 근거는 종이 주보로 이미 인쇄·배포되는 정보라는 판단이다. 이에 따라 명단 필터링 로직은 파서와 함께 제거하며, 면 단위 비공개 체크 같은 장치는 만들지 않는다.

## 1. 데이터 모델 — `src/lib/db/schema.ts`

`bulletins` 테이블을 재구성한다.

**삭제**

- `sections jsonb` — 파서 산출물 전용. 소비처 전멸.
- `theme text` — 실제 의미가 "주제"가 아니라 "설교 제목"이었다. `sermon_title`로 이관.

**유지**

`id`, `bulletin_date`, `volume`, `issue`, `is_published`, `created_by`, `created_at`, `updated_at`, `scripture`(설교 본문).

**신규 스칼라**

| 컬럼 | 타입 | 용도 |
|---|---|---|
| `sermon_title` | text | 설교 제목 |
| `preacher` | text | 설교자 |
| `hymns` | text | 찬송가 번호. 자유 텍스트 (`새 210장 · 통 40장`) |
| `responsive_reading` | text | 교독문 번호 |
| `next_week` | text | 다음 주 예고 한 줄 |
| `pdf_url` | text | R2 원본 PDF. nullable (이미지 직접 업로드 시 없음) |

**신규 jsonb** — 둘 다 `NOT NULL DEFAULT '[]'::jsonb`

```ts
/** 「이번 주 일정 · 공지」 통합 리스트. when이 있으면 시간 배지를 앞에 붙인다. */
export interface BulletinNotice {
  title: string
  detail: string
  when?: string
}

/** 원본 주보 면 이미지. 배열 순서가 면 순서다. */
export interface BulletinPage {
  url: string
  width: number
  height: number
}
```

### 판단 근거

**특별일정과 공지를 한 배열로 합쳤다.** 별도 배열로 두면 특별일정이 2개 이상일 때 카드 그리드가 깨진다. `when` 유무로 시간 배지만 갈리는 단일 리스트면 개수에 무관하게 렌더되고, 관리자 에디터도 하나로 줄어든다.

**`pages`를 별도 테이블이 아니라 jsonb로 둔다.** `gallery_images`는 장별 캡션·정렬·개별 삭제가 필요해 테이블이 맞지만, 주보 면 이미지는 개별 조회·수정 대상이 아니며(고치려면 PDF를 다시 올린다) 항상 주보와 함께 읽힌다. 조인·삽입 루프·cascade 삭제가 전부 불필요해진다.

**Postgres 의존성 없음.** `notices`·`pages`는 값 전체를 읽고 쓸 뿐 JSON 내부를 SQL로 쿼리하지 않는다. 따라서 이 스키마는 SQLite 계열(예: Cloudflare D1, `text({ mode: 'json' })`)로 옮겨도 컬럼 타입 선언만 바꾸면 되고 쿼리는 그대로다. 현재 스택은 Neon Postgres이므로 네이티브 `jsonb`를 쓴다.

## 2. 업로드·변환 파이프라인

### 관리자 플로우

1. `/admin/bulletins/new`에서 주보일과 원본 파일을 고른다. **PDF 1개** 또는 **이미지 여러 장**을 받는다.
2. PDF면 브라우저가 pdf.js로 면별 렌더 → canvas → WebP. 긴 변 2000px으로 **축소만** 클램프(원본이 더 작으면 그대로 두고 확대하지 않는다), quality 0.82.
   - 이미지를 직접 올리는 경로도 같은 규칙으로 WebP로 변환한다. 따라서 면 키의 확장자는 **항상 `.webp`**이며 presign의 `contentType`은 `image/webp` 하나로 고정된다. `application/pdf`는 원본 PDF 키에만 쓴다.
3. 서버 액션 `prepareBulletinUpload(date, pageCount, hasPdf)`를 1회 호출해 presigned URL 배열을 받는다.
4. 브라우저가 `Promise.all`로 R2에 직접 PUT한다 (원본 PDF 포함).
5. 「한눈에」 필드를 입력하고, 공개 화면 컴포넌트를 그대로 재사용한 미리보기로 확인한 뒤 게시한다.
6. `createBulletin`이 각 키를 `headR2Object`로 검증한 다음 DB에 저장한다.

presign을 **배열로 한 번에** 발급하므로 갤러리처럼 별도 API Route가 필요 없다. 갤러리는 서버 액션 직렬화 때문에 `/api/admin/gallery/upload` Route를 뒀지만, 여기서는 액션 1회 + 브라우저 병렬 PUT으로 끝난다.

### 왜 브라우저에서 변환하나

`sharp`는 Vercel 서버에서 PDF를 읽지 못한다 (libvips에 poppler/pdfium 미포함). 브라우저 변환이면 서버 네이티브 의존성이 0이고, 기존 패턴을 그대로 쓴다.

- `src/lib/client-image-compress.ts` — canvas → WebP 압축
- `src/lib/client-video-upload.ts` — XHR presigned PUT + 진행률 (`putWithProgress`)

Next 16은 `new Worker()` 표현식을 번들러가 처리한다 (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md:177`). pdf.js 워커는 이 경로로 로드하며, 구현 시 해당 문서를 다시 확인한다.

### 모듈 경계

| 모듈 | 책임 | 의존 |
|---|---|---|
| `lib/bulletin-pdf.ts` (client-only) | `renderPdfToPages(file) → {blob,width,height}[]` | `pdfjs-dist` (동적 import), canvas |
| `lib/client-image-compress.ts` | 이미지 직접 업로드 경로의 압축 | 변경 없음 |
| `lib/r2.ts` | `bulletinPageKey(date, n)`·`bulletinPdfKey(date)`·`presignBulletinPut(key, contentType)` 추가, `bulletinHwpKey` 삭제 | — |
| `lib/upload-sniff.ts` | `sniffPdfMime`(`%PDF-`) 추가, `UploadMime`에 `application/pdf` 추가 | — |
| `lib/actions/bulletins.ts` | presign 발급 / CRUD / 삭제 시 R2 정리 | r2, db |

새 의존성은 `pdfjs-dist` 하나이며 관리자 화면에서만 동적 import하므로 공개 번들에 포함되지 않는다.

R2 키: `bulletins/{YYYY-MM-DD}/{n}.webp`, `bulletins/{YYYY-MM-DD}/original.pdf`. 주보 삭제·교체 시 `gallery.ts`의 `deleteR2BestEffort` 패턴으로 정리한다.

## 3. 공개 화면

디자인 토큰은 기존 딥네이비·골드 팔레트를 쓴다 (`--midnight #0B1F5C`, `--gold #E8B54D`, `--beige #F0EEE3`).

### 3-1. 상세 `/bulletins/[id]`

위에서 아래로:

1. **「이번 주 한눈에」 카드** — 딥네이비 그라디언트 배경. 날짜·권호 아이브로우(골드) → 골드 룰 → 설교 제목(큰 글씨) → 본문·설교자 → 찬송/교독 칩
2. **예배 시간** — 베이지 배경. `src/lib/worship.ts`의 `adultWorshipSchedule`에서 자동 생성하므로 관리자 입력 없음
3. **이번 주 일정 · 공지** — `notices` 리스트. `when`이 있으면 네이비 시간 배지, 없으면 회색 "공지" 배지
4. **다음 주 예고** — 점선 테두리 블록. `next_week`가 비면 렌더하지 않음
5. **원본 주보 뷰어** — 면 썸네일 스트립 + 현재 면 큰 이미지 + 「전체화면」·「PDF 저장」 버튼
6. **이전/다음 주보 이동**

데스크탑은 좌(1~4) / 우(5) 2단, 모바일은 단일 열로 위 순서 그대로.

**인라인 뷰어에는 줌을 두지 않는다.** 확대는 라이트박스의 책임이다. 인라인은 면 선택과 「전체화면」 진입만 담당하며, 같은 줌 기능을 두 곳에 두지 않는다.

### 3-2. 라이트박스 — 반응형 스프레드

레퍼런스(jangji.org)는 전체화면에서 **여러 면을 나란히** 띄운다. 데스크탑에서 이 방식이 확실히 낫다 — A4 면이 나란히 있으면 주보 전체 구성이 실제로 한눈에 들어온다. 이 방식을 채택한다.

단, **면 수를 고정하지 않는다.** 레퍼런스는 1900px 폭이라 3면이 성립하는 것이고, 그대로 고정하면 모바일에서 한 면이 화면 1/3 폭이 되어 확대해도 읽을 수 없다. 화면 폭으로 결정한다.

| 화면 폭 | 동시 표시 면 수 |
|---|---|
| ≥ 1280px | 3면 |
| 768 – 1279px | 2면 |
| < 768px | 1면 |

**툴바**: 면 목록 토글 · 줌(맞춤 / 1× / 2×) · PDF 저장 · 닫기. 현재 위치는 `1 – 3 / 6면` 형태로 표기한다.
**이동**: 좌우 화살표 버튼, 키보드 좌우 방향키, 모바일 좌우 스와이프. 한 번에 스프레드 단위로 넘긴다.

**슬라이드쇼 자동재생은 넣지 않는다.** 레퍼런스 툴바에는 있으나 주보를 자동 넘김으로 볼 상황이 없다.

**스프레드 수가 바뀔 때**(화면 회전, 창 크기 변경) 현재 스프레드의 **첫 면을 기준**으로 인덱스를 재계산한다. 예: 3면 뷰에서 4~6면을 보던 중 1면 뷰로 바뀌면 4면을 보여준다.

#### 줌 — 라이브러리 없이

핀치줌은 기기·브라우저마다 동작이 갈리고 Next의 viewport 설정과 충돌한다. 대신 **3단 줌 버튼 + 드래그 이동**으로 간다. CSS `transform`과 포인터 이벤트만 쓰므로 의존성이 0이고 상태 전이가 결정론적이어서 단위 테스트가 가능하다.

- **맞춤** — 현재 스프레드 전체가 화면에 들어오는 배율. 드래그 비활성
- **1×** — 이미지 자연 크기(WebP 픽셀 = CSS 픽셀). 드래그 활성
- **2×** — 자연 크기의 2배. 드래그 활성

드래그 이동 범위는 확대된 내용이 화면을 벗어난 만큼으로 클램프한다 (여백이 보이도록 끌리지 않는다). 줌이 `맞춤`이 아닐 때는 스프레드 단위 이동 대신 드래그가 우선한다.

라이트박스 자체는 `requestFullscreen()`으로 진입해 브라우저 크롬까지 치운다.

#### 이미지 로딩 비용

2000px WebP 한 장이 대략 300~600KB이므로 3면 스프레드는 최대 1.8MB를 동시에 받는다. 다음 규칙으로 통제한다.

- 인라인 썸네일 스트립과 큰 이미지는 `next/image`의 반응형 `sizes`로 **표시 크기에 맞는 축소본**만 받는다. 원본 2000px을 그대로 내려받지 않는다
- 첫 화면 밖 이미지는 `loading="lazy"`
- 원본 해상도는 라이트박스에서만 쓰고, 프리로드는 **다음 스프레드 한 세트로 제한**한다

### 3-3. 목록 `/bulletins`

**최신 1개를 크게 + 나머지는 날짜 목록.** 교인 대부분은 이번 주 주보만 본다.

- 최신 주보: 1면 이미지를 표지로 쓰는 딥네이비 피처드 카드. "이번 주 주보" 아이브로우 + 설교 제목 + 날짜·본문 + 「주보 보기 →」
- 지난 주보: 날짜 + 설교 제목 한 줄짜리 행 목록. **잘라내지 않고 전부 노출한다.** 주 1회 누적이라 수년이면 수백 행이지만 텍스트 한 줄이므로 비용이 작다. 연도 그룹핑·페이지네이션은 실제로 길어진 뒤에 붙인다.

`volume`·`issue`는 nullable이므로 둘 다 비면 권호 표기를 렌더하지 않고 날짜만 보여준다. `pages`가 빈 주보는 표지 자리에 기존 문서 아이콘 플레이스홀더를 쓴다.

### 3-4. 홈 노출

`getLatestBulletin()`은 현재 아무도 쓰지 않는 죽은 export다. 이번에 되살려 홈에 「이번 주 한눈에」 카드의 축약판(`HomeBulletinCard`)을 얹는다. 설교 제목·본문·설교자 정도만 보여주고, 클릭하면 `/bulletins/{id}` 상세로 이동한다.

## 4. 삭제 범위

사용처를 전수 확인한 결과 모두 주보 전용이며 다른 기능에 영향이 없다.

| 삭제 대상 | 근거 |
|---|---|
| `src/lib/hwp/parse.ts` (385줄) + `src/lib/hwp/parse.test.ts` | 소비처가 주보뿐 |
| `cfb` 의존성 (`package.json`) | `parse.ts`가 유일한 사용처 |
| `sniffHwpMime` + `UploadMime`의 `'application/x-hwp'` | 주보 업로드 외 사용처 없음 |
| `r2.ts`의 `bulletinHwpKey` | 호출부가 없는 죽은 함수. **따라서 R2에 주보 파일이 없어 정리 작업 불필요** |
| `types.ts`의 `BulletinSection`·`BulletinTable`·`BulletinOffering` | 소비처 12개 파일 전부 주보 계열 |
| `BulletinHwpUpload` `BulletinSectionEditor` `BulletinSectionText` `BulletinRowsEditor` `BulletinTablesEditor` `BulletinOfferingsEditor` | 표 편집 UI 전량 |

**재작성**: `lib/types.ts`(`Bulletin`) · `lib/bulletin-editor.ts` · `lib/actions/bulletins.ts` · `lib/data/bulletins.ts` · `components/admin/BulletinForm.tsx` · `components/bulletins/BulletinView.tsx` · `app/bulletins/page.tsx` · `app/bulletins/[id]/page.tsx`

**신규**: `lib/bulletin-pdf.ts` · `lib/bulletin-spread.ts`(스프레드 인덱스 계산, 순수 함수) · `components/bulletins/BulletinGlance.tsx` · `BulletinWorshipTimes.tsx` · `BulletinNotices.tsx` · `BulletinPageViewer.tsx`(인라인) · `BulletinLightbox.tsx`(전체화면 스프레드) · `components/home/HomeBulletinCard.tsx` · `components/admin/BulletinGlanceFields.tsx` · `BulletinNoticesEditor.tsx` · `BulletinOriginUpload.tsx`

스프레드 인덱스 계산(면 수 · 현재 위치 · 폭 변경 시 재계산)은 `lib/bulletin-spread.ts`의 순수 함수로 분리한다. DOM 없이 단위 테스트할 수 있고, 라이트박스 컴포넌트는 상태 보관과 렌더링만 맡는다.

## 5. 마이그레이션

순서가 중요하다.

1. `DELETE FROM bulletins` — 기존 레코드 삭제 (사용자 확정)
2. `DROP COLUMN sections`, `DROP COLUMN theme`
3. 신규 컬럼 추가: `sermon_title`, `preacher`, `hymns`, `responsive_reading`, `next_week`, `pdf_url`, `notices`, `pages`

레코드 삭제를 먼저 하지 않으면 `sermon_title`과 `pages`가 빈 기존 행이 남아 목록·상세가 깨진다. `notices`·`pages`는 `NOT NULL DEFAULT '[]'::jsonb`로 선언해 이후 행에서도 널 분기를 없앤다.

`drizzle-kit generate`로 생성하고, `DELETE`문은 생성된 SQL 앞에 손으로 넣는다.

## 6. 테스트 전략

기존 vitest + playwright 구성을 쓰고 TDD로 진행한다.

**단위**

- `lib/bulletin-pdf.test.ts` — pdfjs를 mock해 N면 → N blob 확인, 긴 변 2000px 클램프 계산 검증
- `lib/bulletin-editor.test.ts` — 빈 공지 제거, `when` 정규화, `pages` 형식 검증
- `lib/bulletin-spread.test.ts` — 폭별 면 수(3/2/1) 결정, 스프레드 단위 전/후 이동과 양끝 클램프, 면 수가 스프레드로 나누어떨어지지 않을 때 마지막 스프레드 처리(6면·3면뷰 vs 5면·3면뷰), 폭 변경 시 첫 면 기준 재계산
- `lib/r2.test.ts` — `bulletinPageKey`·`bulletinPdfKey` 형식, `presignBulletinPut`이 `gallery/` 키를 거부 (기존 프리픽스 가드 테스트의 대칭)
- `lib/upload-sniff.test.ts` — `sniffPdfMime`이 `%PDF-`만 통과
- `lib/actions/bulletins` — `headR2Object`로 확인되지 않은 키의 저장 거부

**컴포넌트**

- `BulletinLightbox` — 줌 상태 전이(맞춤 → 1× → 2× 클램프), 드래그 경계, 줌이 `맞춤`이 아닐 때 스프레드 이동보다 드래그가 우선하는지

**e2e** (현재 주보 e2e는 0개)

- 목록 진입 → 상세 이동 → 인라인 면 선택 → 라이트박스 열림 → 좌우 이동 → 줌 버튼 → 닫기
- 데스크탑·모바일 뷰포트에서 동시 표시 면 수가 3면/1면으로 갈리는지

## 7. 범위에서 제외

- HWP/HWPX 파싱 — 전면 폐기. 텍스트 추출 경로를 남기지 않는다
- AI 기반 구조화 — 오정보 생성 위험 때문에 배제
- 면 단위 비공개 / 헌금 명단 마스킹 — 위 "수용된 리스크" 결정에 따라 만들지 않는다
- 주보 본문 전문 검색 — 이미지 방식의 불가피한 대가로 수용
