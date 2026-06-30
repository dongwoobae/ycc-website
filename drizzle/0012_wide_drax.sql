ALTER TABLE "bulletins" DROP CONSTRAINT "bulletins_created_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_created_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "sermons" DROP CONSTRAINT "sermons_created_by_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "bulletins" ALTER COLUMN "created_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "created_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sermons" ALTER COLUMN "created_by" SET DATA TYPE text;