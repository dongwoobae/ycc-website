# 설교 AI 썸네일 생성 설계

**작성일**: 2026-06-25
**상태**: 설계 확정 (구현 계획 대기)
**대상 프로젝트**: ycc-website (영천중앙교회)

## 배경 / 목적

현재 설교영상 목록(`/sermons`)의 썸네일은 유튜브 원본 썸네일(`sermons.thumbnailUrl`)을 그대로 쓴다. 대개 목사님 혼자 나오는 정적인 프레임이라 "유튜브 썸네일" 같은 디자인 감각이 없다. 화양교회(`hwayang.org`) 설교 목록처럼 **제목·성경구절이 들어간 디자인된 썸네일**로 바꾸고 싶다.

이미 보유한 자산을 활용한다:
- `sermons.summary` (text) — 한 줄 소개. 요약 프롬프트가 **핵심 성경구절 위치(예: 마태복음 5:3)를 포함하도록** 작성되어 있음.
- `sermons.quickSummary` (jsonb `string[]`) — 핵심 요점 8~12개.
- 기존 Gemini 요약 파이프라인 / Cloudflare R2 저장소.

## 확정된 의사결정

| 항목 | 결정 |
|---|---|
| 썸네일 방식 | **하이브리드** — AI 생성 배경 + 코드 텍스트 오버레이 |
| AI 배경 글자 | **넣지 않음** (한글 깨짐) — 글자는 전부 코드 오버레이 |
| 배경 생성 모델 | **OpenAI `gpt-image-2`** (2026-04-21 릴리스, 최신). 정확한 모델 ID·파라미터는 구현 시 공식 문서로 확인 |
| 문구(텍스트) 생성 | Gemini 재사용 (후킹형 헤드라인) + summary 정규식 추출 (성경구절). 이미지에만 GPT |
| 텍스트 오버레이 | **`@vercel/og`(Satori)** — 한글 woff 폰트 임베드, CSS 레이아웃, 배경 위 합성 |
| 스타일 | **3종**: ①정통형 ②후킹형 ③인물컷형 — 모두 1단계 포함 |
| 문구 편집 | 관리자가 모달에서 **문구 직접 수정 가능** (AI/추출값 자동 채움 후 편집) |
| 생성 범위 | **관리자 수동** — 설교별 모달에서 버튼 클릭 시에만 생성 |
| 후보 보존 | 확정 후에도 candidate **삭제 안 함** (나중에 교체 가능하도록 이력 보존) |
| 확정 썸네일 | 신규 컬럼 `sermons.customThumbnailUrl`. 공개 화면은 `customThumbnailUrl ?? thumbnailUrl` |
| 비용 통제 | 생성/재생성 버튼에 **비용 경고 문구** 표기 |

## 아키텍처 / 데이터 흐름

```
[관리자: 편집페이지 "썸네일 생성" 버튼]
        │
        ▼
[모달 오픈 → 스타일 탭 선택]
        │  탭별 문구 입력 필드 자동 채움 (편집 가능)
        ▼
[탭 안 "썸네일 생성"/"재생성" 클릭]  ← 비용 경고
        │
        ▼
① 텍스트 구성
   - 정통형 : displayTitle/title + summary에서 성경구절 정규식 추출
   - 후킹형 : Gemini가 summary/quickSummary로 짧은 헤드라인 1줄 + 구절
   - 인물컷형: 정통형 문구 + 유튜브 썸네일 배경제거(누끼)
   - (관리자가 편집한 문구가 있으면 그 값을 우선 사용)
        │
        ▼
② 배경 생성  gpt-image-2  (1280×720, 글자 없음)
        │
        ▼
③ 오버레이  @vercel/og(Satori)
   - 배경 위에 제목/헤드라인 + 성경구절 + 교회 로고
   - 인물컷형: 누끼 PNG를 전경 레이어로 추가 합성
        │
        ▼
④ R2 저장  thumbnails/candidates/{sermonId}/{style}-{timestamp}.png
        │  thumbnailCandidates jsonb에 {style,url,createdAt} append
        ▼
[모달에 후보 미리보기 표시]
        │
        ▼
[관리자 "이 썸네일로 적용"]
        │
        ▼
customThumbnailUrl = 선택한 후보 URL
공개 카드/상세: customThumbnailUrl ?? thumbnailUrl(유튜브) 폴백
```

## 데이터 / 스키마 변경

`sermons` 테이블에 컬럼 2개 추가 (drizzle 마이그레이션 필요):

- `customThumbnailUrl text` — 확정된 커스텀 썸네일 URL. 없으면 유튜브 폴백.
- `thumbnailCandidates jsonb` (`Array<{ style: ThumbnailStyle; url: string; createdAt: string }>`) — 생성 이력. 확정해도 보존.

기존 `thumbnailUrl`(유튜브 원본)은 **그대로 보존** — 폴백·되돌리기 안전판.

## 3가지 스타일 정의

| 스타일 | 구성 | 문구 출처(자동 채움) | 추가 처리 |
|---|---|---|---|
| ① 정통형 | 제목(크게) + 성경구절 | 제목 + summary 정규식 추출 구절 | 없음 (AI 텍스트 X) |
| ② 후킹형 | AI 짧은 헤드라인 + 성경구절 | Gemini 헤드라인 1줄 + 구절 | Gemini 1회 호출 |
| ③ 인물컷형 | 제목 + 구절 + 목사님 누끼 | 정통형과 동일 | 배경제거(누끼) 1회 |

세 스타일 모두 자동 채움된 문구를 관리자가 **수정 가능**.

### 성경구절 추출

`summary`에서 한국어 성경 책이름 + `장:절` 패턴 정규식으로 추출 (예: `마태복음 5:3`, `요한복음 3:16`). 매칭 실패 시 구절 칸 비워두고 관리자 입력 유도.

### 누끼(배경제거) 추상화

- 1차: 무료 로컬 라이브러리 `@imgly/background-removal` (서버사이드).
- 품질 부족 시 유료 API(remove.bg 등)로 교체 가능하도록 `removeBackground(imageUrl): Promise<Buffer>` 인터페이스로 추상화.
- 출처: 유튜브 썸네일 1프레임. 인물 자세에 따라 품질 편차 있음 → **후보 선택 방식이라 결과가 별로면 그 탭을 고르지 않으면 됨**(리스크 낮음).

## 관리자 UI

설교 편집 페이지(`SermonEditForm.tsx`)에 **버튼 1개**("썸네일 생성")만 추가. 클릭 시 **모달** 오픈.

모달 구성:
- **탭 3개** (정통형 / 후킹형 / 인물컷형)
- 각 탭:
  - 상단: 문구 입력 필드(헤드라인/제목 문구, 성경구절) — 자동 채움 + 편집 가능. 후킹형엔 "AI 문구 다시 추천" 버튼.
  - 중앙: 1280×720 미리보기 영역.
    - **미생성**: 빈 영역 + 스타일 설명 + 가운데 **"썸네일 생성"** 버튼.
    - **기생성**: `thumbnailCandidates`의 해당 스타일 후보 로드해 표시 + **"재생성"** 버튼.
  - 생성/재생성 버튼 옆 **비용 경고**: "⚠ 생성 시 OpenAI 이미지 비용이 발생합니다."
  - 후보 하단 **"이 썸네일로 적용"** 버튼.
- 모달 하단: **"유튜브 썸네일로 되돌리기"** (customThumbnailUrl 해제).

## 기술 스택

- **배경 생성**: OpenAI `gpt-image-2` — 신규 `OPENAI_API_KEY` 필요, 1280×720.
- **텍스트 오버레이**: `@vercel/og`(`ImageResponse`/Satori) — 한글 woff 폰트 임베드(라이선스 임베드 가능한 Pretendard/나눔 계열). 배경 이미지 위 CSS 합성.
- **누끼**: `@imgly/background-removal` (추상화 인터페이스 뒤).
- **문구 생성**: Gemini(후킹형 헤드라인) 재사용 / summary 정규식(구절).
- **저장**: 기존 Cloudflare R2. 후보 `thumbnails/candidates/`, 폰트/로고 등 정적 에셋은 번들 또는 R2.
- **트리거**: Next.js Server Action(또는 API route) — 관리자 인증 게이트 뒤.

## 컴포넌트 경계

- `lib/thumbnails/compose-text.ts` — 스타일별 문구 구성(구절 추출, Gemini 헤드라인). 순수/테스트 용이.
- `lib/thumbnails/generate-background.ts` — gpt-image-2 호출. 키 없으면 명시적 에러.
- `lib/thumbnails/remove-background.ts` — 누끼 추상화 인터페이스.
- `lib/thumbnails/render.tsx` — `@vercel/og`로 배경+텍스트(+누끼) → PNG Buffer.
- `lib/thumbnails/store.ts` — R2 업로드 + `thumbnailCandidates` 갱신.
- `lib/actions/thumbnails.ts` — Server Action: 생성/재생성/적용/되돌리기. 관리자 인증 검증.
- `components/admin/ThumbnailModal.tsx` (+ 탭 하위 컴포넌트) — React 함수 50줄 규칙 준수해 분리.

## 에러 / 엣지 처리

- `OPENAI_API_KEY` 미설정 → 생성 버튼 클릭 시 명확한 에러 메시지(서버에서 검증).
- gpt-image-2 호출 실패/타임아웃 → 후보 저장 안 함, 모달에 에러 표시, 재시도 가능.
- 누끼 품질/실패 → 인물컷형만 영향, 다른 탭/폴백 영향 없음.
- 성경구절 추출 실패 → 빈 칸 + 관리자 입력.
- 생성 도중 중복 클릭 → 버튼 disable/로딩 상태.
- 확정된 customThumbnailUrl이 가리키는 후보는 보존(삭제 금지)로 dangling 방지.

## 테스트

- `compose-text`: 다양한 summary 문자열에서 성경구절 추출 정규식 단위 테스트(매칭/실패 케이스).
- `store`: thumbnailCandidates append 로직(기존 배열 보존, 순서).
- 공개 표시 폴백: `customThumbnailUrl ?? thumbnailUrl` 선택 로직.
- 렌더/외부 API(gpt-image-2, 누끼)는 모킹 또는 수동 통합 확인.

## 비용 / 리스크

- gpt-image-2: 장당 과금 → 관리자 수동 + 경고 문구로 통제.
- 후킹형 헤드라인 과장·어색 위험 → 관리자 미리보기·문구 편집으로 완화.
- 누끼 품질 편차 → 후보 선택 방식이라 저품질 시 미채택.
- 한글 폰트 라이선스: 임베드 허용 폰트만 사용.

## 단계(향후 구현 계획에서 분해)

전 스타일 1단계 포함이 합의됐으나, 구현 계획 단계에서 위험도 순으로 작업을 쪼갠다:
1. 스키마 + 공개 폴백 + 정통형(①) end-to-end (가장 단순, 가치 검증).
2. 후킹형(②) Gemini 헤드라인.
3. 인물컷형(③) 누끼.
4. 모달 UX 마감(탭/편집/되돌리기).
