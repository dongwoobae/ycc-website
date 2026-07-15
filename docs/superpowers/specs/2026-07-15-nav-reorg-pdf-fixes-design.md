# 네비게이션 정비 + 홈페이지-수정사항 PDF 잔여 반영 설계

날짜: 2026-07-15
기준 브랜치: feature/deep-navy-gold-redesign
근거 문서: docs/홈페이지-수정사항.pdf (7월14일 추가수정)

## 배경

- 헤더 메가패널·모바일 메뉴와 섹션 서브내비의 항목 순서가 어긋남.
- PDF p5-2 요청(처음 오셨나요/소식 순서 교체)과 p8-3 요청(특별행사/기타를 소식 메뉴로 이동)이 미반영.
- PDF p2 요청(홈 히어로에 Welcome to 영천중앙교회만 남김)이 리디자인에서 누락됨.
- PDF p4·p10에 첨부된 교체용 사진이 placeholder 상태로 남아 있음.

## 1. 네비 순서 정렬 — `src/lib/nav.ts`

- `aboutLinks`: `담임목사 인사(/about/greeting) > 교회 연혁(/about/history) > 섬기는 사람들(/about/serving)` 순으로 재배열. AboutSubnav와 일치시킨다.
- `navLinks`: `소개 > 안내 > 말씀과 찬양 > 소식 > 처음 오셨나요?` 순으로 재배열.
  - 메가패널(grid-cols-5)·모바일 아코디언이 이 순서를 그대로 따른다.
  - 데스크탑 상단바는 `/newfamily`를 필터링해 CTA 버튼으로 마지막에 렌더링하므로 영향 없음.

## 2. 특별행사 페이지 신설 — `/events`

- `src/app/events/page.tsx` 신규. `/praise` 페이지 패턴 동일:
  - `EventsHero`(`src/components/news/EventsHero.tsx`, PageHero 기반) + `NewsSubnav` + `SermonsGrid variant="event"`.
  - metadata: title `특별행사`, canonical `/events`, revalidate 3600.
- `NewsSubnav` 탭: `소식(/news) · 주보(/bulletins) · 갤러리(/gallery) · 특별행사(/events)`.
- `nav.ts` `newsLinks`: 특별행사 → `/events?worship=특별행사`, 기타 → `/events?worship=기타`로 변경.

## 3. 예배·설교/행사 스코프 분리 — `src/lib/worship.ts`

- `eventWorshipTypes = ['특별행사', '기타']` + `isEventWorshipType()` 추가.
- `sermonSectionScope.includes`: 찬양·행사 유형 모두 제외 → `/sermons` 전체 = 주일예배·주일찬양예배·수요예배·금요기도회.
- `eventFilterPills`(전체·특별행사·기타) + `eventSectionScope`(basePath `/events`) 추가.
- `SermonsGrid` variant에 `'event'` 추가 (`'sermon' | 'praise' | 'event'`).
- 기존 `/sermons?worship=특별행사` 딥링크는 스코프 밖 값이 되어 '전체'로 폴백(에러 없음). 별도 리다이렉트 없음.

## 4. 홈 히어로 정리 — `src/components/home/ImmersiveHero.tsx`

- 제거: 태그라인 2줄("오래된 믿음 위에, 새로운 은혜가 머무는 곳." / "주일 오전 11시, 본당에서 함께 예배합니다.")과 버튼 2개(예배 시간 안내, 오시는 길).
- 유지: `Welcome to` 아이브로우 + `영천중앙교회` 타이틀 + 골드 라인, 베이지 배경(사용자 확정: PDF 다크 시안 대신 현행 배경 유지).
- `HomeButton` import 등 미사용 코드 정리.

## 5. PDF 첨부 사진 추출·적용

- PDF p4 사진 3장 → `public/images/entry/` 교체: `word.webp`(성경책), `praise.webp`(찬양), `school.webp`(주일학교 봉사).
- PDF p10 부서 사진 3장 → `public/images/nextgen/` 신규: `kinder.webp`(유치부), `children.webp`(아동부), `youth.webp`(중고등부).
  - `src/app/newfamily/page.tsx` NextGeneration 섹션의 `ImagePlaceholder`를 `next/image`(unoptimized, object-cover)로 교체.
- 추출 방법: PDF 내장 JPEG 스트림 추출 후 sharp로 webp 변환(품질 80 내외). 추후 고화질 원본 수령 시 동일 경로 파일만 덮어쓰면 됨.

## 6. 부수 정비

- `src/lib/sitemap.ts` `staticRoutes`에 `/events` 추가. 누락돼 있던 `/praise`도 함께 추가.
- `src/lib/worship.test.ts`: 스코프 판정 테스트 보강(특별행사·기타가 sermon 스코프에서 제외되고 event 스코프에 포함되는지, 찬양 스코프 불변인지).

## 에러 처리·경계

- `/events`에서 `?worship=`에 스코프 밖 값(예: 주일예배)이 오면 '전체'로 폴백 — SermonsGrid 기존 로직 그대로.
- 행사 영상이 0건이면 기존 "검색 결과가 없습니다." 문구 노출 — 추가 처리 없음.
- 사진 추출 결과는 육안 검증 후 커밋(어느 사진이 어느 카드인지 매핑 확인).

## 검증

- `npm run lint`, `npm test`(vitest), `npm run build`.
- 수동: 메가패널·모바일 메뉴 순서, /events 필터·페이지네이션, /sermons 전체에서 특별행사·기타 미노출, 홈 히어로 렌더링, newfamily 부서 사진.

## 범위 외

- PDF p2의 다크 네이비 히어로 배경(사용자 결정으로 베이지 유지).
- OG 이미지 영문 표기(`Yeongcheon Joongang Church` 필기체) 재수정 — 현행 유지.
- p12 QNA — 답변 완료.
