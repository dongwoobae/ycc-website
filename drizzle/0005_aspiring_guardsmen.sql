ALTER TABLE "sermons" ADD COLUMN "transcript_text" text;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "transcript_fetched_at" timestamp with time zone;