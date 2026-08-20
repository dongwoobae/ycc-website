# "처음 오셨나요?" 자기완결형 페이지 개편 설계

날짜: 2026-07-05
상태: 승인됨

## 배경 / 문제

- `/newfamily`는 이미 섹션형 랜딩 페이지(Hero → 환영 인사 → 예배 순서 → FAQ → 다음세대 → "다시 오시는 길" → CTA)로 구성되어 있다.
- 그러나 헤더 "처음 오셨나요?" 드롭다운(`src/lib/nav.ts`의 `newcomerLinks`)은 전부 **다른 헤더 섹션의 페이지**로 이동한다: 예배 시간표→`/worship#sunday`, 교회 지도→`/about/visit#map`, 주소·연락처→`/about/visit#contact`, FAQ→`/faq`. 헤더 의미와 어긋나 어색하다.
- `/newfamily`의 "다시 오시는 길" 섹션은 지도 자리가 placeholder 이미지이고, 실제 카카오맵·연락처·길찾기 버튼은 `/about/visit`에만 있다.
- `/about/visit`는 "소개" 헤더 드롭다운에 존재하지 않는 고아 페이지다(내부 링크로만 접근).

## 결정 사항 (사용자 확정)

1. `/about/visit` 콘텐츠를 `/newfamily` "다시 오시는 길" 섹션에 통합하고, `/about/visit` 페이지는 삭제 + 리다이렉트한다.
2. 드롭다운 4개 항목은 전부 `/newfamily` 페이지 내 앵커로 교체한다.

## 변경 내역

### 1. 드롭다운 재구성 — `src/lib/nav.ts` `newcomerLinks`

| 새 라벨 | href | 대상 섹션 |
|---|---|---|
| 예배 안내 | `/newfamily#flow` | "주일예배는 이렇게 진행됩니다" (ServiceFlow) |
| 자주 묻는 질문 | `/newfamily#faq` | 새가족 FAQ (Faq) |
| 다음세대 안내 | `/newfamily#nextgen` | "아이와 함께 오셔도 괜찮습니다" (NextGeneration) |
| 다시 오시는 길 | `/newfamily#visit` | 지도·주소·연락처 통합 (Visit) |

- 기존 "예배 시간표" 항목은 제거. 예배 시간은 #visit 섹션에 표시되며, 상세 안내는 "안내" 헤더의 `/worship`이 담당.
- desc 문구는 라벨에 맞게 갱신.

### 2. "다시 오시는 길" 섹션 실전화 — `src/app/newfamily/page.tsx`

- `ServiceFlow`·`Faq`·`NextGeneration`·`Visit` 섹션에 각각 `id="flow" / "faq" / "nextgen" / "visit"` 부여 + `scroll-mt-28`(고정 헤더 보정, `/about/visit`와 동일 값).
- Visit 섹션의 placeholder 이미지를 실제 콘텐츠로 교체:
  - `KakaoMap` 임베드 (`@/components/layout/KakaoMap`)
  - 주소·전화 (`churchInfo`)
  - "전화하기" / "카카오맵 길찾기" 버튼 (기존 `/about/visit` 마크업 재사용)
  - `PastorKakaoCard`
  - 기존 예배 시간 목록(`adultWorshipSchedule` 상위 4개)은 유지.
- `VisitBlock` 레이아웃(media/details) 틀은 유지하되, 통합 콘텐츠가 어색하면 섹션 내부 구성 조정 가능.

### 3. `/about/visit` 삭제 + 리다이렉트

- `src/app/about/visit/page.tsx` 삭제.
- `next.config.ts` `redirects()`:
  - 추가: `/about/visit` → `/newfamily#visit` (permanent)
  - 수정: 기존 `/contact` → `/about/visit`를 `/contact` → `/newfamily#visit`로 직행 변경 (이중 홉 방지).
- 구현 전 이 repo의 Next.js 문서(`node_modules/next/dist/docs/`)에서 redirects 문법 확인 (커스텀 버전 주의, AGENTS.md).

### 4. 잔여 참조 정리

`/about/visit`를 가리키는 내부 참조 전부 교체/제거:

- `src/components/home/FullBleedBand.tsx:34` → `/newfamily#visit`
- `src/app/about/page.tsx:100` → `/newfamily#visit`
- `src/app/faq/page.tsx:132` → `/newfamily#visit`
- `src/lib/sitemap.ts:18` — `/about/visit` 항목 제거
- `src/lib/analytics/paths.test.ts:7` — `/about/visit` 트래킹 테스트를 삭제 페이지에 맞게 수정

## 에러 처리 / 엣지 케이스

- 외부 유입(북마크·검색엔진)의 `/about/visit`, `/contact` 접근은 permanent redirect로 `/newfamily#visit`에 안착.
- 헤더 드롭다운에서 이미 `/newfamily`에 있는 상태로 앵커 클릭 시 같은 페이지 내 스크롤 — Next.js Link 기본 동작으로 처리.
- `KakaoMap`이 VisitBlock media 슬롯 안에서 정상 렌더되는지(높이 확보) 확인 필요 — 기존 `min-h-[340px]` 유지.

## 테스트 / 검증

- `paths.test.ts` 수정 후 기존 테스트 스위트 통과.
- 빌드 통과 (`next build`).
- 수동 확인: 드롭다운 4개 앵커 이동(타 페이지에서·/newfamily 내에서), `/about/visit`·`/contact` 리다이렉트, 지도 렌더.

## 범위 외

- `/faq`, `/worship` 페이지 자체의 변경 없음.
- 헤더/메가메뉴 컴포넌트 구조 변경 없음 (`nav.ts` 데이터만 수정).
