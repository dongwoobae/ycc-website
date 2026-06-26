# 인물컷형(누끼) 썸네일 구현 설계

> 선행 스펙 `docs/superpowers/specs/2026-06-25-sermon-ai-thumbnail-design.md`의 Task 6(인물컷형) 보류분을, 그 사이 바뀐 "배경 생성 → CSS 라이브 프리뷰 → 적용 시 PNG 합성" 아키텍처에 맞춰 완성한다.

## 목표

관리자 설교 편집 화면의 썸네일 모달에서 **인물컷형** 탭이 다른 두 스타일(정통형/후킹형)과 동일하게 end-to-end로 동작한다: AI 배경 위에 유튜브 썸네일에서 따낸 인물 누끼를 합성하고, 문구·위치·색상을 조정해 적용한다.

## 결정 사항 (확정)

- **누끼 API:** remove.bg(호스티드). 이미 gpt-image-2 유료 호출 중이고 Vercel 서버리스 환경이라 로컬 ONNX(@imgly)의 번들/콜드스타트 리스크를 피한다.
- **누끼 소스:** 유튜브 썸네일만 자동(`sermons.thumbnailUrl`). 수동 업로드 없음.
- **누끼 캐시:** 유튜브 썸네일 파생이라 안 변하므로 1회 추출 후 R2+DB 캐시, 재생성 시 재사용.
- **인물 위치:** 우하단 고정(`render.tsx` 기존값). 위치 3×3 컨트롤은 문구에만 적용. (v1 단순화)

## 아키텍처

기존 classic/hook 골격을 그대로 따르고, 인물 전경(투명 PNG)을 한 겹 더 얹는다.

### 1. 누끼 모듈 (신규)
`src/lib/thumbnails/remove-background.ts`

```
removeBackground(imageUrl: string): Promise<Buffer>
```
- remove.bg `POST https://api.remove.bg/v1.0/removebg`에 `image_url` + `size=auto` + `format=png` 전달, 헤더 `X-Api-Key`. 투명 PNG ArrayBuffer → Buffer.
- `REMOVE_BG_API_KEY` 미설정 시 명확한 에러. 응답 비정상 시 status+본문 포함 에러.
- 구현체 교체 가능하도록 인터페이스 단순 유지(추후 다른 누끼 API로 교체 용이).

### 2. 누끼 캐시 (스키마)
`sermon_thumbnails` 테이블에 `thumbnail_cutout_url text` 컬럼 추가.
- 마이그레이션: drizzle generate로 SQL 생성. **ycc는 drizzle-kit migrate 작동 불가** → 생성된 ADD COLUMN SQL을 postgres.js로 직접 적용(기존 우회 절차 동일).
- 저장 위치: R2 `thumbnails/cutouts/{sermonId}-{ts}.png`.

### 3. 저장 헬퍼 (store.ts)
`storeCutout(sermonId, png): Promise<string>` 추가 — R2 업로드 후 `sermon_thumbnails.thumbnail_cutout_url` upsert(없으면 행 생성), URL 반환.

### 4. 생성 액션 (cost)
`generateThumbnailAction(id, 'cutout')` — 기존 cutout 차단(`throw`) 제거.
- 배경: `resolveBgKeywords` → `generateBackground('cutout', keywords)` → `storeBackground`(기존 경로).
- 누끼: `sermon_thumbnails.thumbnail_cutout_url` 캐시 확인 → 있으면 재사용, 없으면 `sermons.thumbnailUrl`로 `removeBackground` 호출 → `storeCutout`.
  - `thumbnailUrl`이 없으면 누끼 없이 배경만 진행(에러 아님).
- 반환 타입 확장: `{ backgroundUrl: string; cutoutUrl?: string }`.

### 5. 적용 액션 (no cost)
`composeAndApplyThumbnailAction(id, 'cutout', text, options)` — 기존 cutout 차단 제거.
- 저장된 배경 fetch + (cutout이면) 저장된 누끼 fetch → 각각 Buffer → `renderThumbnail({ ..., cutoutDataUrl })`.
- `render.tsx`는 이미 `cutoutDataUrl`(우하단·height720·object-contain)을 지원 — 수정 불필요.
- `storeCandidate` → `customThumbnailUrl` 적용 → revalidate(기존 동일).

### 6. 프리뷰 미러링 (client)
`src/components/admin/ThumbnailPreview.tsx`에 `cutout?: string` prop 추가.
- 배경 `<img>`와 그라디언트 사이/위에 인물 `<img>`를 render.tsx와 동일 배치로: `position:absolute; right` ≈ `1.875cqw`(=24/1280), `bottom:0; height:100%; object-fit:contain`. (px→cqw 환산 기존 컨벤션 따름)

### 7. UI 배선
- `ThumbnailStyleTab`: `cutout?: string` prop + state 추가. `generate()`가 결과의 `cutoutUrl`을 state에 반영하고 `ThumbnailPreview`에 전달. `onApply`는 변경 없음(서버가 DB에서 누끼 재조회).
- `ThumbnailModal`: `cutoutUrl?: string` prop 추가, 탭에 전달. `DESCRIPTIONS.cutout`에서 "(준비 중)" 제거.
- `edit/page.tsx`: `cutoutUrl={row.thumbnailCutoutUrl ?? undefined}` 전달.
- `getSermonForAdmin`(`src/lib/data/sermons.ts` 또는 actions): select에 `thumbnailCutoutUrl` 포함.

## 데이터 흐름

생성 클릭(cutout) → 배경 AI 생성 + 누끼 추출(최초 1회, 이후 캐시) → 프리뷰에서 배경+인물+문구를 CSS로 즉시 합성 → 위치·색상 조정 → "적용" 시 서버가 PNG 1장 합성·저장·반영.

## 에러 / 엣지

- `REMOVE_BG_API_KEY` 미설정 → 모달에 에러 메시지 노출.
- 유튜브 썸네일 인물 품질 편차 → 관리자가 프리뷰로 확인 후 적용 여부 판단(적용 게이트 존재).
- 유튜브 썸네일 교체 후에도 캐시된 누끼가 남는 staleness → v1 알려진 한계(강제 갱신 버튼 없음).
- `thumbnailUrl` 부재 설교 → 누끼 생략, 배경만 합성.

## 테스트

- `src/lib/thumbnails/remove-background.test.ts` — fetch 모킹(generate-background.test.ts 패턴):
  - `REMOVE_BG_API_KEY` 없으면 throw.
  - 200 응답 시 arrayBuffer를 Buffer로 반환.
  - 비정상 응답 시 throw.
- 기존 액션/렌더 테스트 흐름 유지, cutout 분기는 타입 점검(`tsc --noEmit`)으로 확인.

## 환경변수

`.env.example`에 추가:
```
# remove.bg — 인물컷형 썸네일 누끼(배경 제거)
REMOVE_BG_API_KEY=your_remove_bg_api_key
```

## 비범위 (Out of scope)

- 수동 인물 사진 업로드.
- 인물 위치/크기 조절 UI.
- 누끼 강제 재추출 버튼, 캐시 무효화.
- @imgly 등 대체 누끼 구현체.
