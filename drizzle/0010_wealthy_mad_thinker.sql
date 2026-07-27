CREATE TYPE "public"."suggestion_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "place_tag_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" uuid NOT NULL,
	"tag_id" integer NOT NULL,
	"status" "suggestion_status" DEFAULT 'pending' NOT NULL,
	"evidence" text,
	"source_url" text,
	"model_used" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "place_tag_suggestions" ADD CONSTRAINT "place_tag_suggestions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_tag_suggestions" ADD CONSTRAINT "place_tag_suggestions_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_tag_suggestions_place_tag_idx" ON "place_tag_suggestions" USING btree ("place_id","tag_id");--> statement-breakpoint
CREATE INDEX "place_tag_suggestions_status_idx" ON "place_tag_suggestions" USING btree ("status");