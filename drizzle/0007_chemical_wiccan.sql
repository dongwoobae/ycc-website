ALTER TABLE "sermons" ADD COLUMN "custom_thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "thumbnail_candidates" jsonb;