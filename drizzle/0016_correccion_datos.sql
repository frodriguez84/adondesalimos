CREATE TYPE "public"."place_edit_origin" AS ENUM('admin', 'owner');--> statement-breakpoint
CREATE TABLE "place_data_edits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"requested_by" uuid,
	"origen" "place_edit_origin" NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"campos" jsonb NOT NULL,
	"fuente" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "locked_fields" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "place_data_edits" ADD CONSTRAINT "place_data_edits_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_data_edits" ADD CONSTRAINT "place_data_edits_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_data_edits_place_idx" ON "place_data_edits" USING btree ("place_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "place_data_edits_pendiente_idx" ON "place_data_edits" USING btree ("place_id") WHERE "place_data_edits"."status" = 'pending';