CREATE TABLE "page_views" (
  "id" uuid PRIMARY KEY NOT NULL,
  "visitor_id" text NOT NULL,
  "session_id" text NOT NULL,
  "path" text NOT NULL,
  "referrer" text,
  "region" text,
  "ip_masked" text,
  "user_agent" text,
  "duration_seconds" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "page_views_created_visitor_idx" ON "page_views" USING btree ("created_at","visitor_id");--> statement-breakpoint
CREATE INDEX "page_views_session_created_idx" ON "page_views" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE TABLE "daily_page_stats" (
  "date" date PRIMARY KEY NOT NULL,
  "unique_visitors" integer NOT NULL,
  "page_views" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
