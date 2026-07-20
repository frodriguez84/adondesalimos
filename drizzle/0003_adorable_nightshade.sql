CREATE TYPE "public"."google_match_status" AS ENUM('pending', 'matched', 'manual', 'not_found', 'blocked');--> statement-breakpoint
CREATE TABLE "google_api_usage" (
	"month" text NOT NULL,
	"sku" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "google_api_usage_month_sku_pk" PRIMARY KEY("month","sku")
);
--> statement-breakpoint
CREATE TABLE "place_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"url" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_impressions_daily" ADD COLUMN "detail_views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "google_match_status" "google_match_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "google_matched_at" timestamp;--> statement-breakpoint
ALTER TABLE "place_photos" ADD CONSTRAINT "place_photos_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "places_google_match_status_idx" ON "places" USING btree ("google_match_status") WHERE "places"."google_match_status" <> 'pending';