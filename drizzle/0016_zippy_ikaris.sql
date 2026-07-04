ALTER TABLE "gallery_images" ADD COLUMN "media_type" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "gallery_images" ADD COLUMN "poster_url" text;