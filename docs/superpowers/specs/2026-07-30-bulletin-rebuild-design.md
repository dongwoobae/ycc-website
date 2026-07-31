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

/**
 * 원본 주보 면 이미지. 배열 순서가 면 순서다.
 * width·height는 full 기준이며 세 크기의 종횡비가 같으므로 한 번만 저장한다.
 */
export interface BulletinPage {
  width: number
  height: number
  fullUrl: string     // 긴 변 2000px — 라이트박스
  previewUrl: string  // 긴 변 1000px — 인라인 큰 이미지, 목록 표지, 홈 카드
  thumbUrl: string    // 긴 변 320px — 인라인 썸네일 스트립
}
```

**유니크 제약**: `bulletin_date`에 unique index를 건다. 주보는 날짜로 식별되며, 같은 날짜의 주보를 다시 만드는 것은 언제나 실수다(수정하려면 편집한다). 중복 레코드가 생기면 목록에 같은 날짜가 두 번 나오고 홈 카드가 어느 것을 집을지 불확정해진다.

### 판단 근거

**특별일정과 공지를 한 배열로 합쳤다.** 별도 배열로 두면 특별일정이 2개 이상일 때 카드 그리드가 깨진다. `when` 유무로 시간 배지만 갈리는 단일 리스트면 개수에 무관하게 렌더되고, 관리자 에디터도 하나로 줄어든다.

**`pages`를 별도 테이블이 아니라 jsonb로 둔다.** `gallery_images`는 장별 캡션·정렬·개별 삭제가 필요해 테이블이 맞지만, 주보 면 이미지는 개별 조회·수정 대상이 아니며(고치려면 PDF를 다시 올린다) 항상 주보와 함께 읽힌다. 조인·삽입 루프·cascade 삭제가 전부 불필요해진다.

**Postgres 의존성 없음.** `notices`·`pages`는 값 전체를 읽고 쓸 뿐 JSON 내부를 SQL로 쿼리하지 않는다. 따라서 이 스키마는 SQLite 계열(예: Cloudflare D1, `text({ mode: 'json' })`)로 옮겨도 컬럼 타입 선언만 바꾸면 되고 쿼리는 그대로다. 현재 스택은 Neon Postgres이므로 네이티브 `jsonb`를 쓴다.

## 2. 업로드·변환 파이프라인

### 관리자 플로우

1. `/admin/bulletins/new`에서 주보일과 원본 파일을 고른다. **PDF 1개** 또는 **이미지 여러 장**을 받는다.
2. PDF면 브라우저가 pdf.js로 면별 렌더 → canvas → WebP를 **세 크기**로 만든다. 긴 변 2000 / 1000 / 320px으로 **축소만** 클램프(원본이 더 작으면 그대로 두고 확대하지 않는다), quality 0.82.
   - 이미지를 직접 올리는 경로도 같은 규칙으로 WebP 세 크기로 변환한다. 따라서 면 키의 확장자는 **항상 `.webp`**이며 presign의 `contentType`은 `image/webp` 하나로 고정된다. `application/pdf`는 원본 PDF 키에만 쓴다.
   - **면은 순차 렌더한다.** 병렬 렌더는 iOS Safari에서 canvas 메모리를 터뜨린다. 한 면을 끝내면 `page.cleanup()`을 호출하고 canvas 크기를 0으로 줄여 즉시 해제한다.
   - **상한**: PDF 12면, 파일 40MB. 초과하면 업로드 전에 거부하고 사유를 표시한다.
   - **WebP 인코딩 폴백**: `canvas.toBlob('image/webp')`가 `null`을 주는 구형 브라우저에서는 `image/jpeg`로 폴백하고 키 확장자를 `.jpg`로 바꾼다. 이 경우 `contentType`도 `image/jpeg`로 발급받는다.
3. 서버 액션 `prepareBulletinUpload({ date, pageCount, hasPdf, imageMime })`를 1회 호출해 presigned URL 배열을 받는다. 액션이 **업로드 고유 id(`crypto.randomUUID()`)를 발급**하고 그 아래로 키를 만든다.
4. 브라우저가 `Promise.all`로 R2에 직접 PUT한다 (원본 PDF 포함).
5. 「한눈에」 필드를 입력하고, 공개 화면 컴포넌트를 그대로 재사용한 미리보기로 확인한 뒤 게시한다.
6. `createBulletin`이 각 키를 `headR2Object`로 검증한 다음 DB에 저장한다. **DB 저장이 성공한 뒤에** 그 주보가 이전에 쓰던 업로드 id의 객체를 `deleteR2BestEffort`로 지운다.

presign을 **배열로 한 번에** 발급하므로 갤러리처럼 별도 API Route가 필요 없다. 갤러리는 서버 액션 직렬화 때문에 `/api/admin/gallery/upload` Route를 뒀지만, 여기서는 액션 1회 + 브라우저 병렬 PUT으로 끝난다.

### 키 전략 — 업로드 단위 스테이징

R2 키에 업로드 id를 넣는다.

```
bulletins/{YYYY-MM-DD}/{uploadId}/{n}-full.webp
bulletins/{YYYY-MM-DD}/{uploadId}/{n}-preview.webp
bulletins/{YYYY-MM-DD}/{uploadId}/{n}-thumb.webp
bulletins/{YYYY-MM-DD}/{uploadId}/original.pdf
```

날짜만으로 키를 만들면 **수정 중 공개 중인 이미지를 부분적으로 덮어쓴다** — 새 PDF의 3면을 올리는 도중 교인이 상세를 열면 1·2면은 새 것, 4·5면은 옛 것인 상태를 본다. 업로드 id로 스테이징하면 새 세트가 완성되고 DB가 그것을 가리킬 때까지 공개 중인 세트가 손상되지 않으며, 교체는 DB 한 줄 갱신으로 원자적이 된다.

**부분 실패**는 DB를 쓰지 않는 것으로 처리한다. 일부 면 PUT이 실패하면 `createBulletin`을 호출하지 않으므로 공개 데이터는 그대로다. 실패한 업로드 id의 객체는 고아로 남지만, 다음 성공 업로드 시점의 정리 대상에 포함시켜 회수한다.

### PDF 다운로드 헤더

교차 출처(R2 공개 도메인) 리소스에는 `<a download>`가 먹지 않아 브라우저가 그냥 열어버린다. 원본 PDF를 PUT할 때 `PutObjectCommand`에 `ContentDisposition: 'attachment; filename="..."'`를 넣고 `signableHeaders`에 `content-disposition`을 추가해, 클라이언트가 같은 헤더를 보내도록 한다. Vercel을 거쳐 프록시하지 않으므로 함수 대역폭을 쓰지 않는다.

### 왜 브라우저에서 변환하나

`sharp`는 Vercel 서버에서 PDF를 읽지 못한다 (libvips에 poppler/pdfium 미포함). 브라우저 변환이면 서버 네이티브 의존성이 0이고, 기존 패턴을 그대로 쓴다.

- `src/lib/client-image-compress.ts` — canvas → WebP 압축
- `src/lib/client-video-upload.ts` — XHR presigned PUT + 진행률 (`putWithProgress`)

Next 16은 `new Worker()` 표현식을 번들러가 처리한다 (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md:177`). 다만 **그 문서는 매직 코멘트 처리만 설명하며 pdf.js 워커 번들 성공을 보장하지 않는다.** 구현 첫 단계에서 다음을 실제로 검증한다.

1. 개발 서버(Turbopack)와 `next build` 프로덕션 번들 **양쪽**에서 워커가 초기화되는지
2. 실패하면 폴백 순서: (a) `pdfjs.GlobalWorkerOptions.workerSrc`를 `public/`에 복사한 워커 파일로 지정 → (b) 워커 없이 메인 스레드 렌더 → (c) 그래도 안 되면 PDF 경로를 포기하고 **이미지 직접 업로드만** 지원

(c)까지 가더라도 「한눈에」 카드와 라이트박스는 온전히 동작한다. PDF 변환은 편의 기능이고 이미지 업로드 경로가 기능적 하한선이다.

### 모듈 경계

| 모듈 | 책임 | 의존 |
|---|---|---|
| `lib/bulletin-pdf.ts` (client-only) | `renderPdfToPages(file) → {blob,width,height}[]` | `pdfjs-dist` (동적 import), canvas |
| `lib/client-image-compress.ts` | 이미지 직접 업로드 경로의 압축 | 변경 없음 |
| `lib/r2.ts` | `bulletinPageKey(date, uploadId, n, size, ext)`·`bulletinPdfKey(date, uploadId)`·`presignBulletinPut(key, contentType, disposition?)` 추가, `bulletinHwpKey` 삭제 | — |
| `lib/upload-sniff.ts` | `sniffPdfMime`(`%PDF-`) 추가, `UploadMime`에 `application/pdf` 추가 | — |
| `lib/actions/bulletins.ts` | presign 발급 / CRUD / 삭제 시 R2 정리 | r2, db |

새 의존성은 `pdfjs-dist` 하나이며 관리자 화면에서만 동적 import하므로 공개 번들에 포함되지 않는다.

R2 키 규칙은 위 「키 전략 — 업로드 단위 스테이징」이 유일한 정의다. 주보 삭제·교체 시 `gallery.ts`의 `deleteR2BestEffort` 패턴으로 정리한다.

## 3. 공개 화면

디자인 토큰은 기존 딥네이비·골드 팔레트를 쓴다 (`--midnight #0B1F5C`, `--gold #E8B54D`, `--beige #F0EEE3`).

### 3-1. 상세 `/bulletins/[id]`

위에서 아래로:

1. **「이번 주 한눈에」 카드** — 딥네이비 그라디언트 배경. 날짜·권호 아이브로우(골드) → 골드 룰 → 설교 제목(큰 글씨) → 본문·설교자 → 찬송/교독 칩
2. **예배 시간** — 베이지 배경. `src/lib/worship.ts`의 `adultWorshipSchedule`에서 자동 생성하므로 관리자 입력 없음
3. **이번 주 일정 · 공지** — `notices` 리스트. `when`이 있으면 네이비 시간 배지, 없으면 회색 "공지" 배지
4. **다음 주 예고** — 점선 테두리 블록. `next_week`가 비면 렌더하지 않음
5. **원본 주보 뷰어** — 면 썸네일 스트립 + 현재 면 큰 이미지 + 「원본 크게 보기」·「PDF 저장」 버튼
6. **이전/다음 주보 이동**

데스크탑은 좌(1~4) / 우(5) 2단, 모바일은 단일 열로 위 순서 그대로.

**인라인 뷰어에는 줌을 두지 않는다.** 확대는 라이트박스의 책임이다. 인라인은 면 선택과 라이트박스 진입만 담당하며, 같은 줌 기능을 두 곳에 두지 않는다.

#### 인라인 클릭 동작

| 클릭 대상 | 동작 |
|---|---|
| 썸네일 스트립의 면 | 큰 이미지를 그 면으로 교체. **라이트박스를 열지 않는다** |
| 큰 이미지 | 현재 면부터 라이트박스 열기 |
| 「원본 크게 보기」 버튼 | 현재 면부터 라이트박스 열기 |
| 「PDF 저장」 버튼 | `pdf_url` 다운로드. `pdf_url`이 없으면 버튼을 렌더하지 않는다 |

썸네일을 누르는 즉시 전체화면이 뜨면 면을 훑어보는 것이 불가능해지고, 잘못 눌렀을 때 빠져나오는 비용이 클릭보다 커진다. 그래서 썸네일은 선택 전용으로 둔다. 라이트박스 진입 경로를 큰 이미지와 버튼 둘로 두는 이유는, 이미지가 클릭 가능하다는 사실이 드러나지 않기 때문이다 — 버튼이 발견 가능성을 담당하고 이미지 클릭이 숙련 경로가 된다.

버튼 라벨은 데스크탑·모바일 모두 **「원본 크게 보기」**로 통일한다.

### 3-2. 라이트박스 — 언제나 한 면씩

> **2026-07-31 변경.** 초기 설계는 레퍼런스(jangji.org)를 따라 화면 폭별로 3면 / 2면 / 1면을 나란히 붙였다(반응형 스프레드). 실제 주보가 **3단 접지**라서 한 「면」에 이미 3칸이 들어 있고, 데스크탑에서 3면을 붙이면 한 화면에 9칸이 되어 어느 폭에서도 읽히지 않았다. 사용자 확정 결정으로 **화면 폭과 무관하게 항상 한 면만 띄운다.** `lib/bulletin-spread.ts`(스프레드 인덱스 계산)는 폐기하고 `lib/bulletin-paging.ts`로 대체한다.

#### 조작은 전부 바깥 툴바에 — 면 위에 띄우지 않는다

**주 사용자가 노인 교인이라는 것이 이 화면의 설계 기준이다.** 면 위에 띄우는 반투명 버튼, 만졌을 때만 나타나는 컨트롤, 제스처 전용 기능은 전부 "이미 아는 사람"에게만 깔끔하다. 처음 보는 사람은 버튼이 있다는 사실 자체를 모른다. 그래서 조작 요소는 **항상 보이고, 크고, 글자 라벨이 붙어 있고, 면을 가리지 않는 자리**에 둔다. 읽는 면적을 조금 내주는 대가다.

| 위치 | 내용 |
|---|---|
| 상단 툴바 | 면 목록 토글 · PDF 저장 · 닫기 |
| 스테이지 | 면 이미지만. 떠 있는 컨트롤 없음 |
| 하단 바 1행 | `－ 작게` · `원래대로` · `＋ 크게` (높이 44px) |
| 하단 바 2행 | `◀ 이전 면` · `3 / 6면` · `다음 면 ▶` (높이 56px) |

**이동 버튼을 맨 아래에 둔다.** 모바일에서 엄지가 닿는 자리이고, 현재 위치 표기가 두 버튼 사이에 있어야 셋의 관계가 드러난다.

**확대 버튼을 남긴다.** 핀치·휠 줌이 있어도 그 제스처를 모르면 확대할 방법이 없다. 버튼은 화면 중앙을 앵커로 한 단계씩(×1.4) 움직이고 `원래대로`는 맞춤으로 되돌린다.

**색은 흰 바탕 + 딥네이비 글자**다. 딥네이비 바탕은 어두운 툴바(`#14171d`) 위에서 둘 다 어두워 경계가 흐려진다. 확대는 이동보다 부차적이므로 한 단계 낮은 대비(`bg-white/15` + 흰 글자)로 둔다.

**화살표만 두지 않는다.** 기호만으로는 무엇이 넘어가는지 알 수 없다. 첫 면·마지막 면에서는 해당 버튼을 **비활성이 아니라 렌더하지 않되 자리는 같은 크기로 남긴다** — 폭까지 사라지면 남은 버튼이 늘어나 위치가 바뀌고, 같은 자리를 두 번 누를 수 없게 된다.

**드래그·스와이프로는 면이 넘어가지 않는다.** 초기 설계에는 모바일 좌우 스와이프가 있었으나, 확대해서 읽는 중에 미는 동작이 면 넘김이 되면 보던 위치를 잃는다. 확대 여부와 무관하게 **드래그는 언제나 화면 이동**이고, 면 넘김은 하단 이동 버튼 · 면 목록 썸네일 · 키보드 좌우 방향키에만 반응한다.

**슬라이드쇼 자동재생은 넣지 않는다.** 레퍼런스 툴바에는 있으나 주보를 자동 넘김으로 볼 상황이 없다.

#### 줌 — 제스처 연속 줌 + 버튼, 라이브러리 없이

> **2026-07-31 변경.** 초기 설계는 "핀치줌은 기기·브라우저마다 동작이 갈리고 Next의 viewport 설정과 충돌한다"는 이유로 **3단 줌 버튼(맞춤 / 1× / 2×)**을 택했다. 고정 단계가 "조금만 더"를 표현하지 못해 **연속 줌**으로 바꿨고, 한동안 버튼을 전부 없애 제스처 전용으로 뒀다가 **다시 넣었다** — 핀치·휠을 모르는 사용자에게는 확대할 방법이 아예 없어지기 때문이다. 결과적으로 **연속 줌 + 단계 버튼 병행**이다.

**어느 쪽으로도 확대할 수 있어야 한다.**

| 환경 | 방법 |
|---|---|
| 모바일 · 태블릿 | 두 손가락 벌리기/오므리기(핀치) |
| 데스크탑 · 트랙패드 | 휠 스크롤, 트랙패드 두 손가락 스크롤·핀치 |
| 제스처를 모르는 사용자 | 하단 바의 `－ 작게` / `＋ 크게` / `원래대로` |
| 키보드 | `＋` / `－` 로 한 단계씩, `0` 으로 맞춤 복귀 |

제스처는 연속값이고 버튼·키보드는 한 번에 ×1.4다. 둘은 같은 `zoom` 상태를 건드리므로 섞어 써도 어긋나지 않는다.

핀치를 직접 구현하므로 viewport 설정과 충돌하지 않는다. 스테이지에 `touch-action: none`을 걸어 브라우저 기본 제스처를 끄고, 휠은 **non-passive 리스너**로 받아 `preventDefault()`한다 — React의 `onWheel`은 루트에 passive로 붙어 막히지 않고, 막지 않으면 Ctrl+휠(맥 트랙패드 핀치가 보내는 이벤트)이 브라우저 페이지 줌으로 새어 나간다.

배율은 **「맞춤」을 1로 보는 상대값**이다(범위 1 ~ 8). 절대 배율로 두면 상한이 면 픽셀 크기·화면 크기마다 달라진다.

**라이트박스는 언제나 맞춤(`zoom === 1`)으로 열린다.** 확대된 채로 여는 안을 검토했으나(세로 화면에서 가로로 긴 면은 맞춤이면 글자가 2~3px이 된다), 열자마자 잘린 화면이 보여 지금 어디를 보고 있는지 알 수 없었다. 전체를 먼저 보여주고 확대는 사용자가 한다.

확대는 **앵커(커서 위치 또는 두 손가락의 중점)를 고정**한 채 일어난다. 중심 고정이면 읽으려던 지점이 화면 밖으로 밀려난다. 드래그 이동 범위는 확대된 내용이 화면을 벗어난 만큼으로 클램프한다(여백이 보이도록 끌리지 않는다). 면을 넘기면 배율을 맞춤으로 되돌린다.

배율·오프셋 계산은 `lib/bulletin-zoom.ts`의 순수 함수로 분리한다 (`zoomAt(state, target, anchor, viewport, content)`, `panTo`, `clampOffset`, `wheelZoomFactor`, `distance`/`midpoint`). 컴포넌트에는 포인터 수집과 렌더링만 남으므로 DOM 없이 node 환경에서 테스트할 수 있다.

`zoom`과 `offset`은 한 상태 객체(`ZoomState`)로 묶는다. 확대하면 앵커를 맞추느라 오프셋도 함께 움직이므로, 따로 두면 한쪽만 반영된 중간 상태가 한 프레임 보인다.

#### 라이트박스는 고정 오버레이다 — Fullscreen API에 의존하지 않는다

**iOS Safari는 임의 요소의 `requestFullscreen()`을 지원하지 않는다** (`<video>`만 가능). 따라서 라이트박스는 `position: fixed; inset: 0`인 오버레이로 구현하고, Fullscreen API는 **지원되는 환경에서만 부가 적용**한다. 실패해도 라이트박스는 정상 동작해야 한다.

접근성·동작 요건:

- `role="dialog"` + `aria-modal="true"` + 제목 연결(`aria-labelledby`)
- 열릴 때 포커스를 닫기 버튼으로 이동, 닫힐 때 진입 지점(큰 이미지 또는 버튼)으로 복귀
- 포커스를 오버레이 안에 가둔다
- `Escape`로 닫기
- 열린 동안 배경 스크롤 잠금, 닫을 때 원래 스크롤 위치 복원

#### 이미지 로딩 비용

2000px WebP 한 장이 대략 300~600KB다. 한 면씩 띄우므로 한 번에 받는 것은 현재 면 + 프리로드 1장이다.

**`next/image`의 `sizes`에 의존할 수 없다.** `next.config.ts:38`이 `images.unoptimized: true`이므로 Next는 축소본을 생성하지 않고 원본 URL을 그대로 내려준다. `sizes`를 써도 2000px 파일이 그대로 받아진다. 그래서 **업로드 시점에 세 크기를 직접 만들어 저장**한다(위 1장 `BulletinPage`). 어차피 클라이언트에서 canvas로 렌더하므로 배율만 바꿔 세 번 인코딩하면 되고, 서버 이미지 최적화 설정을 건드리지 않는다.

용도별 배정:

| 위치 | 사용 크기 | 대략 용량 |
|---|---|---|
| 인라인 썸네일 스트립 | `thumbUrl` (320px) | 장당 ~25KB |
| 인라인 큰 이미지, 목록 표지, 홈 카드 | `previewUrl` (1000px) | 장당 ~120KB |
| 라이트박스 | `fullUrl` (2000px) | 장당 ~450KB |

- 첫 화면 밖 이미지는 `loading="lazy"`
- `fullUrl`은 라이트박스에서만 쓰고, 프리로드는 **다음 면 한 장으로 제한**한다
- 라이트박스를 열 때 `previewUrl`을 먼저 보여주고 `fullUrl` 로드가 끝나면 교체한다 — 이미 인라인에서 받아둔 파일이라 즉시 뜬다

### 3-3. 목록 `/bulletins`

**최신 1개를 크게 + 나머지는 날짜 목록.** 교인 대부분은 이번 주 주보만 본다.

- 최신 주보: 1면 이미지를 표지로 쓰는 딥네이비 피처드 카드. "이번 주 주보" 아이브로우 + 설교 제목 + 날짜·본문 + 「주보 보기 →」
- 지난 주보: 날짜 + 설교 제목 한 줄짜리 행 목록. **잘라내지 않고 전부 노출한다.** 주 1회 누적이라 수년이면 수백 행이지만 텍스트 한 줄이므로 비용이 작다. 연도 그룹핑·페이지네이션은 실제로 길어진 뒤에 붙인다.

`volume`·`issue`는 nullable이므로 둘 다 비면 권호 표기를 렌더하지 않고 날짜만 보여준다. `pages`가 빈 주보는 표지 자리에 기존 문서 아이콘 플레이스홀더를 쓴다.

### 3-4. 홈 노출

`getLatestBulletin()`은 현재 아무도 쓰지 않는 죽은 export다. 이번에 되살려 홈에 「이번 주 한눈에」 카드의 축약판(`HomeBulletinCard`)을 얹는다. 설교 제목·본문·설교자와 1면 `previewUrl` 썸네일을 보여주고, 카드 전체가 `/bulletins/{id}` 상세로 가는 링크다.

**마운트 위치**: `src/app/page.tsx`. 홈은 현재 주보를 전혀 참조하지 않으므로 여기에 섹션을 추가하는 것이 유일한 변경점이다(기존 컬럼을 쓰지 않아 컬럼 삭제로 깨지지는 않는다). 게시된 주보가 없으면 섹션 자체를 렌더하지 않는다.

### 3-5. 접근성 · 메타데이터

- **alt 텍스트**: 면 이미지는 `"{YYYY년 M월 D일} 주보 {n}면"`. 이미지 방식은 본문을 스크린리더에 전달하지 못하므로 alt로 최소한 위치는 알린다. 「이번 주 한눈에」 카드가 텍스트로 존재하는 것이 실질적 대안이다
- **OG 이미지**: 상세 `generateMetadata`에서 1면 `previewUrl`을 `openGraph.images`로 쓴다. `pages`가 비면 기존 기본 OG 이미지로 폴백한다
- **sitemap**: `src/lib/sitemap.ts:44`가 이미 `/bulletins/{id}`를 포함하므로 변경 없다
- 라이트박스 이동 버튼에 `aria-label`("이전 면", "다음 면")을 붙인다

## 4. 삭제 범위

사용처를 전수 확인한 결과 모두 주보 전용이며 다른 기능에 영향이 없다.

| 삭제 대상 | 근거 |
|---|---|
| `src/lib/hwp/parse.ts` (385줄) + `src/lib/hwp/parse.test.ts` | 소비처가 주보뿐 |
| `cfb` 의존성 (`package.json`) | `parse.ts`가 유일한 사용처 |
| `sniffHwpMime` + `UploadMime`의 `'application/x-hwp'` | 주보 업로드 외 사용처 없음 |
| `r2.ts`의 `bulletinHwpKey` | 현재 호출부가 없는 죽은 함수 |
| `types.ts`의 `BulletinSection`·`BulletinTable`·`BulletinOffering` | 소비처 12개 파일 전부 주보 계열 |
| `BulletinHwpUpload` `BulletinSectionEditor` `BulletinSectionText` `BulletinRowsEditor` `BulletinTablesEditor` `BulletinOfferingsEditor` | 표 편집 UI 전량 |

**R2 고아 객체 정리 — 별도 확인 필요.** `bulletinHwpKey`는 지금 호출부가 없지만 `c9060df feat: 주보 hwp 업로드 + 섹션 관리 CRUD` 시점에는 실제로 쓰였고, 키가 `bulletins/{uuid}-{파일명}.hwp` 형태였다. 따라서 R2 버킷에 과거 업로드분이 남아 있을 수 있다. 배포 전에 `bulletins/` 프리픽스를 인벤토리해 새 키 규칙(`bulletins/{날짜}/{uploadId}/...`)에 속하지 않는 객체를 확인하고 지운다. 이건 코드 변경이 아니라 운영 작업이므로 구현 계획의 별도 단계로 둔다.

**재작성**: `lib/types.ts`(`Bulletin`) · `lib/bulletin-editor.ts` · `lib/actions/bulletins.ts` · `lib/data/bulletins.ts` · `components/admin/BulletinForm.tsx` · `components/bulletins/BulletinView.tsx` · `app/bulletins/page.tsx` · `app/bulletins/[id]/page.tsx`

**컬럼 삭제로 빌드가 깨지므로 반드시 함께 고쳐야 하는 곳** (초기 스펙에서 누락됨)

- `src/app/admin/bulletins/page.tsx:54` — `bulletin.theme`을 목록 열에 렌더한다. `sermon_title`로 교체
- `src/app/admin/bulletins/[id]/edit/page.tsx:22` — `initialValue`가 `bulletin.theme`과 `bulletin.sections`를 읽는다. 새 필드 집합으로 교체
- `src/app/page.tsx` — 홈 카드 마운트(3-4). 컬럼 참조가 없어 빌드는 깨지지 않지만 이 변경 없이는 홈 카드가 존재하지 않는다

**신규**: `lib/bulletin-pdf.ts` · `lib/bulletin-scale.ts`(긴 변 축소 클램프, 순수 함수) · `lib/bulletin-paging.ts`(면 이동 계산, 순수 함수) · `lib/bulletin-zoom.ts`(줌·드래그 계산, 순수 함수) · `components/bulletins/BulletinGlance.tsx` · `BulletinWorshipTimes.tsx` · `BulletinNotices.tsx` · `BulletinPageViewer.tsx`(인라인) · `BulletinLightbox.tsx`(전체화면) · `components/home/HomeBulletinCard.tsx` · `components/admin/BulletinGlanceFields.tsx` · `BulletinNoticesEditor.tsx` · `BulletinOriginUpload.tsx`

면 이동 계산(현재 위치 · 양끝 클램프 · 표기)은 `lib/bulletin-paging.ts`의 순수 함수로 분리한다. DOM 없이 단위 테스트할 수 있고, 라이트박스 컴포넌트는 상태 보관과 렌더링만 맡는다.

## 5. 마이그레이션

### SQL 순서

1. `DELETE FROM bulletins` — 기존 레코드 삭제 (사용자 확정, 되돌릴 수 없음)
2. `DROP COLUMN sections`, `DROP COLUMN theme`
3. 신규 컬럼 추가: `sermon_title`, `preacher`, `hymns`, `responsive_reading`, `next_week`, `pdf_url`, `notices`, `pages`
4. `bulletin_date`에 unique index 생성

레코드 삭제를 먼저 하지 않으면 `sermon_title`과 `pages`가 빈 기존 행이 남아 목록·상세가 깨진다. `notices`·`pages`는 `NOT NULL DEFAULT '[]'::jsonb`로 선언해 이후 행에서도 널 분기를 없앤다.

`drizzle-kit generate`로 생성하고, `DELETE`문은 생성된 SQL 앞에 손으로 넣는다.

### 배포 순서 — 파괴적 마이그레이션의 불일치 창

이 마이그레이션은 되돌릴 수 없고, **구 코드와 신 코드 어느 쪽도 전후 스키마를 함께 지원하지 않는다.** 마이그레이션이 수동(`npm run db:migrate`)이므로 순서를 못박는다.

1. 브랜치를 배포해 신 코드가 Vercel에 올라간 것을 확인한다 (프로덕션 도메인 전환 전, 프리뷰 배포에서 빌드 성공 확인)
2. `npm run db:migrate` 실행
3. 즉시 프로덕션 배포 승격
4. `revalidatePath('/')`, `/bulletins` 캐시 무효화가 걸리도록 첫 주보를 업로드한다

2와 3 사이에 **구 코드가 신 스키마를 조회하는 짧은 창**이 생겨 `/bulletins`와 홈이 500을 낼 수 있다. 이 사이트는 트래픽이 낮고, 어차피 1단계의 `DELETE` 때문에 첫 주보를 올릴 때까지 주보 목록이 비어 있으므로 이 창을 **수용한다.** 무중단을 위해 컬럼을 단계적으로 추가·삭제하는 2단 배포는 이 규모에 과하다.

되돌릴 수 없는 단계이므로, 2단계 실행 전에 Neon 콘솔에서 브랜치 스냅샷을 떠 둔다.

## 6. 테스트 전략

기존 vitest + playwright 구성을 쓰고 TDD로 진행한다.

**단위**

- `lib/bulletin-scale.test.ts` — 긴 변 축소 클램프(2000/1000/320) 계산, 원본이 더 작을 때 확대하지 않음
- `lib/bulletin-pdf.test.ts` — pdfjs를 mock해 N면 → 면당 3 blob 확인, WebP 인코딩이 `null`을 줄 때 JPEG로 폴백하고 확장자·contentType이 함께 바뀌는지, 면 수·용량 상한 초과 시 업로드 전 거부
- `lib/bulletin-editor.test.ts` — 빈 공지 제거, `when` 정규화, `pages` 형식 검증
- `lib/bulletin-paging.test.ts` — 면 인덱스 클램프, 한 면씩 전/후 이동과 양끝에서 제자리, 마지막 면 판정, `3 / 6면` 표기
- `lib/bulletin-zoom.test.ts` — 배율 클램프(1 ~ 8), `zoomAt`이 앵커 아래 지점을 고정하는지, 맞춤으로 되돌리면 오프셋이 0이 되는지, `clampOffset`이 여백을 노출하지 않는지, `wheelZoomFactor`가 줄·페이지 단위 델타를 픽셀로 환산하고 한 번에 뒤집히지 않는지
- `lib/r2.test.ts` — 업로드 id가 든 `bulletinPageKey`·`bulletinPdfKey` 형식, `presignBulletinPut`이 `bulletins/` 외 프리픽스를 거부 (기존 프리픽스 가드 테스트의 대칭)
- `lib/upload-sniff.test.ts` — `sniffPdfMime`이 `%PDF-`만 통과
- `lib/actions/bulletins` — `headR2Object`로 확인되지 않은 키의 저장 거부

**컴포넌트 테스트는 넣지 않는다.** `vitest.config.ts:10`이 `environment: 'node'`이고 jsdom·Testing Library가 설치돼 있지 않다. 이 repo에는 현재 컴포넌트 테스트가 하나도 없으며, 그 둘을 추가하는 것은 이 작업의 범위를 넘는다. 대신 **판정 로직을 `bulletin-paging.ts`·`bulletin-zoom.ts` 순수 함수로 뽑아 node 환경에서 검증하고**, 실제 상호작용은 playwright e2e로 덮는다. 컴포넌트에는 상태 보관과 렌더링만 남긴다.

**e2e** (현재 주보 e2e는 0개)

- 목록 진입 → 상세 이동 → **썸네일 클릭 시 라이트박스가 열리지 않고 큰 이미지만 바뀌는지** → 「원본 크게 보기」로 라이트박스 열기 → 확대·이동 버튼이 보이고 첫 면에서 「이전 면」만 빠지는지 → 휠로 배율이 바뀌고 면을 넘기면 맞춤으로 되돌아오는지 → 좌우 이동 → `Escape`로 닫기 → 포커스가 진입 지점으로 복귀하는지
- 데스크탑·모바일 뷰포트 어느 쪽에서도 한 면만 뜨는지
- 라이트박스에서 가로로 드래그해도 면이 넘어가지 않는지
- `pages`가 빈 주보의 상세·목록이 깨지지 않는지 (뷰어 영역·「PDF 저장」 버튼 미렌더)
- 관리자: 동일 주보일 중복 생성이 unique 제약으로 막히고 사용자에게 사유가 표시되는지

## 7. 범위에서 제외

- HWP/HWPX 파싱 — 전면 폐기. 텍스트 추출 경로를 남기지 않는다
- AI 기반 구조화 — 오정보 생성 위험 때문에 배제
- 면 단위 비공개 / 헌금 명단 마스킹 — 위 "수용된 리스크" 결정에 따라 만들지 않는다
- 주보 본문 전문 검색 — 이미지 방식의 불가피한 대가로 수용
