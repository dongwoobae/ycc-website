# 설교 썸네일 라이브 미리보기 (A 방향) 설계

## 배경 / 문제

admin 설교 편집의 썸네일 모달에서 문구 위치·색상을 바꿀 때마다 ~1초 지연이 발생.
원인은 "무비용 재배치"가 실제로는 매 변경마다 서버 풀스택 왕복을 돌기 때문:

`recomposeThumbnailAction` 1회 = R2 배경 다운로드 → `next/og`(Satori+resvg) 래스터라이즈
→ R2 업로드 → DB 2회 쓰기(storeCandidate + log) → `revalidatePath` 5경로 → 브라우저 재다운로드.

각 단계 수십~수백 ms가 직렬로 쌓여 ~1초. 렌더 자체가 무거운 게 아니라 클라이언트에서
즉시 가능한 작업을 서버로 밀어넣은 구조가 문제.

## 목표

- 위치·색상 변경을 **클라이언트 CSS 오버레이로 즉시 반영**(서버 왕복 0회).
- 실제 PNG 합성·저장은 **"이 썸네일로 적용" 클릭 시 1회만** 수행.
- 미리보기와 실제 PNG가 시각적으로 일치(WYSIWYG).

## 비목표 (YAGNI)

- 텍스트/위치/색상 상태의 영속화. 재진입 시 텍스트는 빈 상태로 시작한다.
  (설교에 이미 적용된 썸네일 자체는 유지됨)
- cutout(인물컷형) 누끼 합성. 기존대로 "준비 중".

## 변경 사항

### 1. 새 컴포넌트 `src/components/admin/ThumbnailPreview.tsx` (클라이언트)

`src/lib/thumbnails/render.tsx`의 레이아웃을 CSS로 미러링한다.

- 루트 컨테이너: `aspect-video`, `@container` 컨텍스트.
- 배경 `<img src={backgroundUrl}>` `object-cover` 절대배치.
- 그라데이션 오버레이 div: `linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 100%)`.
- flex 컨테이너: `positionToLayout(position)`를 **그대로 재사용**해 `justifyContent`·`alignItems`·`textAlign` 적용.
- scripture span / headline span: `colors.scripture`/`colors.headline`, `font-bold`(전역 Pretendard),
  text-shadow `0px 2px 8px rgba(0,0,0,0.55)`.
- **WYSIWYG 정합**: render.tsx는 1280px 폭 기준 headline 76 / scripture 38 / padding 56 / gap 16(px).
  컨테이너 쿼리 단위(`cqw`)로 환산해 컨테이너 크기와 무관하게 비율 동일:
  - headline 76/1280 = **5.9375cqw**
  - scripture 38/1280 = **2.96875cqw**
  - padding 56/1280 = **4.375cqw**
  - gap 16/1280 = **1.25cqw**
  - lineHeight 1.1 동일.

Pretendard는 `src/app/layout.tsx`에서 `--font-pretendard` → `--font-sans`로 전역 로드되어 있어
미리보기도 실제 PNG(Pretendard-Bold)와 같은 폰트 패밀리로 렌더된다.

### 2. 서버 액션 정리 `src/lib/actions/thumbnails.ts`

- `generateThumbnailAction`:
  - 배경 생성·저장만 수행하고 `{ backgroundUrl }` 반환.
  - 기존의 `renderThumbnail` + `storeCandidate` 호출 제거(생성 단계도 빨라짐).
  - OpenAI(gpt-image-2) 비용은 이 액션에서만 발생.
  - 반환 타입: 기존 `GenerateThumbnailResult`(candidate) 대신 `{ backgroundUrl: string }`.
- **신규 `composeAndApplyThumbnailAction(id, style, text, options)`**:
  - 저장된 `thumbnailBackgrounds[style]` 조회 → 없으면 에러.
  - 배경 fetch → `renderThumbnail` → `storeCandidate` → `customThumbnailUrl` 세팅 → `log('update', …)` → `revalidate`.
  - 반환: `void` 또는 `{ url }`.
- `recomposeThumbnailAction`: **삭제**.
- `applyThumbnailAction`: 이 흐름에서 死코드 → **삭제**. (`resetThumbnailAction`은 유지)

### 3. 배경 URL 배선

재진입 시 미리보기 배경을 깔기 위해 저장된 배경 URL을 클라이언트로 전달.

- `getSermonForAdmin`(`src/lib/actions/sermons.ts`): select에 `thumbnailBackgrounds` 추가.
- `src/app/admin/sermons/[id]/edit/page.tsx`: `backgrounds={row.thumbnailBackgrounds ?? {}}` 전달.
- `SermonEditForm` → `ThumbnailModal` → `ThumbnailStyleTab`로 `backgrounds`(style→url 맵) prop 전파.
- `candidates` prop은 더 이상 미리보기에 쓰지 않으므로 정리(필요 없으면 제거).

### 4. `src/components/admin/ThumbnailStyleTab.tsx` 변경

- `preview`(PNG URL) state → `background`(URL) state로 교체. 초기값은 전달받은 `backgrounds[style]`.
- 미리보기 영역의 `<img src={preview}>`를 `<ThumbnailPreview background, text, position, colors />`로 교체.
- `recompose` / `changePosition`의 서버 호출 제거 → `setPosition`/`setColors`만.
  `ThumbnailColorControls`의 `onCommit`/`onBlur` 커밋 트리거 불필요 → `onChange`만 유지.
- `generate`: 결과 `backgroundUrl`을 `background` state에 세팅.
- `onApply`: URL이 아니라 현재 `text`/`position`/`colors`로 `composeAndApplyThumbnailAction` 호출하도록
  시그니처 변경(모달 `apply` 콜백도 함께 변경).
- "적용" 버튼은 `background` 존재 시 활성.

### 5. `src/components/admin/ThumbnailModal.tsx`

- `apply(url)` → `apply(text, options)`로 변경, `composeAndApplyThumbnailAction` 호출.
- `backgrounds` prop 수신·전달.

## 데이터 흐름 (적용 후)

1. 모달 열기 → 저장된 배경 있으면 CSS 미리보기 즉시 표시(텍스트 빈 상태).
2. "썸네일 생성"(배경 없을 때) → 서버: 배경 생성·저장 → backgroundUrl 반환 → 미리보기 표시.
3. 문구 생성/입력, 위치·색상 변경 → **전부 클라이언트 즉시 반영**.
4. "이 썸네일로 적용" → 서버: 현재 상태로 PNG 합성·저장·적용 1회.

## 영향/검증

- 위치·색상 변경 지연 제거(서버 왕복 없음).
- 적용 시에만 R2 업로드/DB 쓰기/revalidate 1회.
- 검증: 미리보기 CSS와 적용된 PNG의 위치·색상·폰트 크기 비율 일치 확인(9분할 각 위치, 색상 변경).
