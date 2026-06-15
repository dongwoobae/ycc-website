# 영천중앙교회 웹사이트 리디자인 설계

날짜: 2026-06-15
대상: ycc-website (Next.js 16 + Tailwind v4)

## 목적

30·40대를 겨냥한 모던하고 세련된 인상으로 재단장한다. 현재는 전통 명조체 + 세피아 톤이라 다소 올드하고, 페이지 hero 사진이 성당(가톨릭) 느낌이라 개신교 교회 정체성과 어긋난다. 글씨체·색·hero 사진을 일괄 교체한다.

## 확정된 디자인 방향 (브레인스토밍 결과)

### 1. 전체 톤 — 모던 에디토리얼 (A안)
- 잡지 같은 미니멀. 넓은 흰 여백, 굵은 산세리프 큰 제목, 무채색 베이스 + 포인트 1색.

### 2. 타이포그래피
- **제목/디스플레이**: Pretendard 800 (extrabold), letter-spacing 살짝 음수(`-0.02em`)로 단단한 인상.
- **본문**: Pretendard (기존 유지).
- 기존 `Gowun_Batang` serif 폰트는 제거. 단, 컴포넌트 18곳이 `font-serif` 클래스를 쓰므로 **클래스를 일괄 제거하지 않고 토큰을 재지정**한다: `--font-serif`를 Pretendard 계열로 매핑하여 중앙에서 한 번에 전환. (네이밍이 어색하면 후속으로 `font-display`로 리네임 가능 — 이번 범위 아님.)

### 3. 색 팔레트 — 포레스트 그린 포인트
무채색 베이스 + 포레스트 그린 1색. globals.css의 CSS 변수만 교체하면 전 컴포넌트에 자동 반영(현재 모든 색이 변수 경유).

| 토큰 | 현재 (세피아) | 신규 (모던/그린) |
|---|---|---|
| `--bg` | 253 251 247 | 250 250 249 (near-white) |
| `--surface` | 244 238 228 | 244 244 242 |
| `--ink` | 46 40 32 | 22 24 22 (near-black) |
| `--ink-muted` | 107 94 79 | 90 96 90 |
| `--accent` | 180 114 78 | 47 125 91 (#2f7d5b forest) |
| `--accent-deep` | 143 86 54 | 32 92 66 (#205c42) |
| `--line` | 231 221 205 | 228 228 224 |
| `--paper` | 255 255 255 | 255 255 255 (유지) |

(정확한 RGB는 구현 시 미세조정 가능. 방향: 차가운 무채색 + 그린.)

### 4. Hero 사진 — 성당 제거, 페이지 성격별 자연/공동체

`PageHero` 컴포넌트는 그대로(`image` prop 받음), 페이지별 URL과 오버레이만 조정.
- 오버레이를 중립 `ink` → **그린 틴트 그라데이션**으로 변경해 톤 일체화.
- eyebrow 색을 밝은 그린(`bg/80`→연그린)으로.

페이지별 배정 (●A 자연 / ●B 공동체):

| 페이지 | 파일 | 배정 |
|---|---|---|
| 홈 | `src/app/page.tsx` (인라인 img) | A 자연 |
| 교회 소개 | `src/app/about/page.tsx` | B 공동체 |
| 연혁 | `src/app/about/history/page.tsx` | A 자연 |
| 섬김 | `src/app/about/serving/page.tsx` | B 공동체 |
| 오시는 길 | `src/app/about/visit/page.tsx` | A 자연 |
| 설교 | `src/app/sermons/page.tsx` | A 자연 |
| 주보 | `src/app/bulletins/page.tsx` | A 자연 |
| 갤러리 | `src/app/gallery/page.tsx` | B 공동체 |
| 교회 소식 | `src/app/news/page.tsx` | B 공동체 |

이미지는 Unsplash 후보(아래)로 시작, 추후 교회 실사진으로 교체 가능하도록 URL만 바꾸면 되는 구조 유지.

후보 URL (브레인스토밍에서 검토):
- 자연: `photo-1441974231531-c6227db76b6e`, `photo-1490750967868-88aa4486c946`, `photo-1470770841072-f978cf4d019e`, `photo-1473773508845-188df298d2d1`
- 공동체: `photo-1529156069898-49953e39b3ac`, `photo-1488521787991-ed7bbaae773c`, `photo-1511632765486-a01980e01a18`, `photo-1517457373958-b7bdd4587205`

## 변경 범위 (구현 단위)

1. **`src/app/layout.tsx`** — 폰트 import를 `Gowun_Batang` → Pretendard 디스플레이 weight 적용(또는 Pretendard 자체가 본문이므로 별도 디스플레이 처리). `--font-gowun-batang` 변수 제거.
2. **`src/app/globals.css`** — `:root` 색 변수 8개 교체, `--font-serif` 매핑을 Pretendard로 변경.
3. **`src/components/layout/PageHero.tsx`** — 오버레이 그라데이션을 그린 틴트로, eyebrow 색 조정. 제목 weight `font-serif`(=이제 Pretendard) 유지하되 `font-extrabold tracking-tight` 부여.
4. **각 페이지 hero `image` URL** (9개) — 위 배정대로 교체.
5. **홈 인라인 hero img** (`page.tsx:54`) — 자연 사진으로 교체.
6. **제목 weight 점검** — 주요 `font-serif` 사용처가 모던 톤에 맞게 extrabold/tracking 적용되는지 확인(SectionTitle 등).

## 비범위 (YAGNI)
- `font-serif` → `font-display` 클래스 리네임 (후속).
- 레이아웃 구조 변경(그리드/네비) — 이번엔 톤·폰트·색·사진만.
- 교회 실사진 촬영/업로드 (운영자 후속).
- 다크모드.

## 검증
- `pnpm build` (또는 Windows 빌드) 통과.
- 9개 페이지 hero에 성당 사진 0건, 배정대로 자연/공동체 적용.
- 색 변수 교체 후 전 페이지 그린 포인트 반영, 대비(WCAG AA) 텍스트 가독 확인.
