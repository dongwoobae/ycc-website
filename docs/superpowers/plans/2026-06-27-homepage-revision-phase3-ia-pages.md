# Phase 3 — 메뉴 IA 재구성 + 신규 페이지 (행복선언·예배안내·FNQ)

작성일: 2026-06-27 · 브랜치: `feat/homepage-revision-phase1-impl`
근거: `[홈페이지]수정사항.pdf` p2/p3, `docs/superpowers/specs/2026-06-25-homepage-revision-design.md`

## 확정 결정 (2026-06-27 사용자 게이트)
- 예배안내/예배시간표 → **단일 `/worship` + 앵커 섹션**. 안내·처음오셨나요? 둘 다 여기로 딥링크. 행복선언만 별도 `/happiness`.
- 주일학교 부서·찬양대 전용 페이지 → **이번엔 스케줄 행 + 딥링크만**. 전용 페이지는 다음 Phase(YAGNI).
- FNQ → **초안 작성 후 고객 수정**. 기존 `/newfamily` + 표준 교회 FAQ 기반.

## 메뉴 IA (PDF p2/p3 최종)
```
소개         /about      › 교회연혁 /about/history · 담임목사인사 /about/greeting · 섬기는사람들 /about/serving
안내         /worship    › 행복선언 /happiness · 주일예배 /worship#sunday · 주일학교 /worship#school
                            · 청년부 /worship#youth · 수요예배 /worship#wed · 새벽예배 /worship#dawn · 금요기도회 /worship#fri
말씀과찬양   /sermons    › 주일설교 ?worship=주일예배 · 찬양예배설교 ?worship=주일찬양예배
                            · 수요설교 ?worship=수요예배 · 시온찬양대 ?worship=시온찬양대
처음오셨나요? /newfamily › 예배시간표 /worship · 교회지도 /about/visit#map · 주소·연락처 /about/visit#contact · FNQ /faq
소식         /news       › 교회소식 /news · 공지사항 /news(공지 카테고리) · 행사사진 /gallery
```
- 주보(/bulletins)는 IA 5개에 없음 → 헤더 메뉴에서만 제거, 라우트는 보존.
- 앵커 id는 ASCII 슬러그(sunday/school/youth/wed/dawn/fri) — 한글 fragment 인코딩 회피.

## 작업 항목

### A. Header 5메뉴 재구성 — `src/components/layout/Header.tsx`
- navLinks 배열을 위 IA 5개로 교체(children 드롭다운 구조 재사용). 모바일 flatten은 기존 children 로직 그대로 동작.
- /bulletins 제거. /newfamily 진입 복구(처음오셨나요? 부모 링크).

### B. 예배안내 `/worship` — `src/app/worship/page.tsx` (신규)
- PageHero + Container + Reveal, 앵커 섹션(id: sunday/school/youth/wed/dawn/fri).
- 데이터는 `src/lib/worship.ts` 재사용: adultWorshipSchedule(주일/찬양/수요/새벽/청춘교실) + nextGenerationWorshipSchedule(영아·유치·아동·중등·고등·청년).
- 각 섹션 요일·시간·장소 간단 표기. 금요기도회가 worship.ts에 없으면 codex가 데이터에 추가하거나 플래그.

### C. 행복선언 `/happiness` — `src/app/happiness/page.tsx` (신규)
- 정적 콘텐츠. PDF p3 전문(아래) + 마태복음 6:33. PageHero("행복선언") + Container + Reveal.

> 영천중앙교회는 예배 때마다 축도 전에 행복선언을 함께 고백합니다.
> 행복선언은 단순한 긍정의 말이나 세상적인 형통을 비는 구호가 아닙니다. 우리의 형편이 늘 완벽하다는 뜻도 아닙니다.
> 이 고백은 예수 그리스도 안에서 하나님의 선하신 통치가 우리의 삶과 가정과 교회 가운데 일하고 있으며,
> 하나님 나라가 오늘 우리의 자리에서 드러나고 있음을 믿음으로 선포하는 선언입니다.
> "예수 안에서 나는 잘되고 있습니다." / "예수 안에서 우리 가정은 잘되고 있습니다." / "예수 안에서 우리 교회는 잘되고 있습니다."
> 우리는 이 고백을 통해 예배의 은혜를 삶으로 이어갑니다. 예수 안에서 하나님의 통치를 받고, 하나님 나라의 백성으로 살아가며,
> 우리 삶과 가정과 교회 가운데 주님의 나라가 이루어지기를 갈망합니다.
> 먼저 그의 나라와 그의 의를 구하라 그리하면 이 모든 것을 너희에게 더하시리라 — 마태복음 6:33

### D. FNQ `/faq` — `src/app/faq/page.tsx` (신규)
- Q&A 아코디언/리스트. /newfamily 기존 콘텐츠 + 표준 교회 FAQ(주차/예배시간/첫방문 복장/주일학교 등)로 초안 작성(고객 추후 수정).
- 기존 컴포넌트 패턴(PageHero/Container/Subnav/Reveal) 준수.

### F. 교역자 사진 반영 (소개 메뉴 폴리시) — 고객 제공 4장
- 자산: `public/images/staff/`에 webp 4장 배치 완료(pastor-kim-seonchan / evangelist-kim-jihee / evangelist-lee-jihyung / evangelist-jung-daseul).
- `src/app/about/greeting/page.tsx`: "사진 준비 중" 플레이스홀더 → 김선찬 목사 초상(next/image, aspect-[3/4] object-cover).
- `src/app/about/serving/page.tsx`: 교역자 그룹(김선찬·김지희·이지형·정다슬)을 텍스트 행 → 사진 카드 그리드로 보강. 장로/예배섬김/선교지는 현행 텍스트 유지.

### E. 검증 게이트
- 코드 작성 전 AGENTS.md대로 `node_modules/next/dist/docs/` 해당 가이드 확인.
- `npm run lint` + `npm run build` 통과 = 완료 증거.

## codex 비판 반영 (2026-06-27)
- (High) `/about/visit`에 `id="map"`·`id="contact"` 앵커 추가 — 처음오셨나요? IA 링크 착지점.
- (High) `/worship`·`/about/visit` 앵커 섹션에 `scroll-mt-28`(sticky 헤더 보정).
- (Med) Header active=pathname만 → `?worship=` 자식은 부모(/sermons)로만 하이라이트. 허용.
- (Med) 딥링크 값은 worshipTypes enum(`주일찬양예배`) 사용. /worship 섹션 라벨은 자연어(찬양예배)와 구분.
- (Med) `AboutSubnav`를 소개 3탭(인사말/연혁/섬기는분)으로 정렬 — visit은 처음오셨나요?로 이동했으므로 about 서브내비에서 제거.
- (Low) serving 사진카드 모바일 높이 재검증.

## 코드 범위 밖 (핸드오프 todo)
- 행사사진 6개 앨범(2025전교인수련회·2025성탄축하·2026겨울성경학교·2026특별새벽기도회·구역모임·청춘교실) → admin `gallery_albums` 데이터 입력.
- 말씀과찬양 영상 연동은 기존 /sermons 필터로 충족(신규 파이프라인 없음).

## 비범위 (YAGNI)
- 주일학교 부서·찬양대 전용 페이지(다음 Phase).
- 푸터 소셜·디모데앱, OG 수식어구 정리 = Phase 4.
