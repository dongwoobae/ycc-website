CREATE TABLE "sermon_summaries" (
	"sermon_id" uuid PRIMARY KEY NOT NULL,
	"summary" text,
	"quick_summary" jsonb,
	"chapters" jsonb,
	"summary_status" text DEFAULT 'none' NOT NULL,
	"summary_attempts" integer DEFAULT 0 NOT NULL,
	"summary_next_retry_at" timestamp with time zone,
	"summary_generated_at" timestamp with time zone,
	"summary_model" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sermon_thumbnails" (
	"sermon_id" uuid PRIMARY KEY NOT NULL,
	"thumbnail_candidates" jsonb,
	"thumbnail_bg_keywords" text,
	"thumbnail_backgrounds" jsonb
);
--> statement-breakpoint
CREATE TABLE "sermon_transcripts" (
	"sermon_id" uuid PRIMARY KEY NOT NULL,
	"transcript_text" text,
	"transcript_fetched_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sermon_summaries" ADD CONSTRAINT "sermon_summaries_sermon_id_sermons_id_fk" FOREIGN KEY ("sermon_id") REFERENCES "public"."sermons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sermon_thumbnails" ADD CONSTRAINT "sermon_thumbnails_sermon_id_sermons_id_fk" FOREIGN KEY ("sermon_id") REFERENCES "public"."sermons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sermon_transcripts" ADD CONSTRAINT "sermon_transcripts_sermon_id_sermons_id_fk" FOREIGN KEY ("sermon_id") REFERENCES "public"."sermons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sermon_summaries_status_retry_idx" ON "sermon_summaries" USING btree ("summary_status","summary_next_retry_at");--> statement-breakpoint
INSERT INTO sermon_summaries
  (sermon_id, summary, quick_summary, chapters, summary_status, summary_attempts,
   summary_next_retry_at, summary_generated_at, summary_model, created_at)
SELECT id, summary, quick_summary, chapters, summary_status, summary_attempts,
       summary_next_retry_at, summary_generated_at, summary_model, COALESCE(created_at, now())
FROM sermons
ON CONFLICT (sermon_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO sermon_transcripts (sermon_id, transcript_text, transcript_fetched_at)
SELECT id, transcript_text, transcript_fetched_at FROM sermons
ON CONFLICT (sermon_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO sermon_thumbnails (sermon_id, thumbnail_candidates, thumbnail_bg_keywords, thumbnail_backgrounds)
SELECT id, thumbnail_candidates, thumbnail_bg_keywords, thumbnail_backgrounds FROM sermons
ON CONFLICT (sermon_id) DO NOTHING;