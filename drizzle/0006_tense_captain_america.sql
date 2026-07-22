CREATE TYPE "public"."owner_plan" AS ENUM('free', 'paid');--> statement-breakpoint
CREATE TABLE "place_owner_content" (
	"place_id" uuid PRIMARY KEY NOT NULL,
	"phone" text,
	"website" text,
	"socials" jsonb,
	"opening_hours" jsonb,
	"description" text,
	"menu_url" text,
	"news" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "owner_plan" "owner_plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "place_owner_content" ADD CONSTRAINT "place_owner_content_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;