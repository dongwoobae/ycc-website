--> 기존 주보 레코드 전량 삭제 (사용자 확정). 파서 기반 sections 데이터는 새 스키마에서
--> 되살릴 수 없고, sermon_title·pages가 빈 행이 남으면 목록·상세가 깨진다.
--> 되돌릴 수 없다 — 실행 전 Neon 콘솔에서 브랜치 스냅샷을 떠 둘 것.
DELETE FROM "bulletins";
--> statement-breakpoint
ALTER TABLE "bulletins" DROP COLUMN "theme";--> statement-breakpoint
ALTER TABLE "bulletins" DROP COLUMN "sections";