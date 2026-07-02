-- 스타일별 마지막 생성/적용 썸네일 문구 저장 (모달 재진입 시 프리필용)
-- 주의: drizzle-kit generate 가 접속분석 테이블(page_views/daily_page_stats) CREATE 를 함께 뱉었으나
-- 해당 테이블은 0014_visitor_analytics.sql 로 이미 운영 반영됨 — 이 파일은 신규분만 담는다.
ALTER TABLE "sermon_thumbnails" ADD COLUMN "thumbnail_texts" jsonb;
