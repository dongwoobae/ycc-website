ALTER TABLE "sermons" ALTER COLUMN "preacher" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "youtube_video_id" text;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "quick_summary" jsonb;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "chapters" jsonb;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "summary_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "summary_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "summary_next_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "summary_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sermons" ADD COLUMN "summary_model" text;--> statement-breakpoint
ALTER TABLE "sermons" ADD CONSTRAINT "sermons_youtube_video_id_unique" UNIQUE("youtube_video_id");