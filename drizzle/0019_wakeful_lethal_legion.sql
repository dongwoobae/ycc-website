ALTER TABLE "bulletins" ADD COLUMN "sermon_title" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "preacher" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "hymns" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "responsive_reading" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "next_week" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "pdf_url" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "notices" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "pages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bulletins_date_key" ON "bulletins" USING btree ("bulletin_date");