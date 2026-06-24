ALTER TABLE "app_logs" DROP CONSTRAINT "app_logs_created_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "created_by" SET DATA TYPE text;