# 영천중앙교회 홈페이지

영천중앙교회의 예배와 교회 소식을 안내하고, 운영자가 콘텐츠를 관리할 수 있는 공식 웹사이트입니다.

**서비스:** [ycjc.kr](https://www.ycjc.kr)

## 주요 기능

- **공개 웹사이트:** 교회 소개, 예배 안내, 새가족 안내, 설교·찬양, 주보, 소식, 갤러리
- **관리자:** 설교와 게시글, 주보, 갤러리 콘텐츠 관리 및 방문 통계 확인
- **콘텐츠 자동화:** YouTube 설교 동기화, AI 요약·썸네일 생성, 미디어 업로드

## 기술 스택

Next.js · React · TypeScript · Tailwind CSS · Neon Postgres · Drizzle ORM · Better Auth · Cloudflare R2 · QStash · Vercel

## 프로젝트 구조

```text
src/app/          페이지와 API 라우트
src/components/   화면 컴포넌트
src/lib/          데이터, 인증, 콘텐츠 처리 로직
drizzle/          데이터베이스 마이그레이션
scripts/          개발 및 운영 스크립트
docs/specs/       기능·아키텍처 설계 기록
e2e/              Playwright 테스트
```

## 로컬 실행

환경변수 예시를 복사하고 값을 설정한 뒤 개발 서버를 실행합니다.

```bash
cp .env.example .env.local
npm install
npm run dev
```

전체 기능을 실행하려면 데이터베이스와 외부 서비스의 환경변수가 필요합니다. 변수 목록은 [`.env.example`](.env.example)을 참고하세요.

주요 검증 명령:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 더 알아보기

- [포트폴리오 케이스 스터디](https://dwoobae.com/projects/ycc-website): 프로젝트 배경과 설계 의사결정
- [DeepWiki](https://deepwiki.com/dongwoobae/ycc-website): 코드 구조와 기능별 구현 안내
- [설계 문서](docs/specs/): 세부 기능의 설계 기록

## 프로젝트 정보

- 운영 도메인: [https://www.ycjc.kr](https://www.ycjc.kr)
- 대상 기관: 영천중앙교회
- 주요 사용자: 교인, 새가족, 지역 주민, 교회 운영자
