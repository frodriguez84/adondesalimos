CREATE TYPE "public"."poll_option_origin" AS ENUM('creator', 'voter');--> statement-breakpoint
ALTER TABLE "poll_options" ADD COLUMN "origin" "poll_option_origin" DEFAULT 'creator' NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_options" ADD COLUMN "suggested_by" text;--> statement-breakpoint
ALTER TABLE "poll_options" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "allow_suggestions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "poll_options_poll_suggested_by_idx" ON "poll_options" USING btree ("poll_id","suggested_by");