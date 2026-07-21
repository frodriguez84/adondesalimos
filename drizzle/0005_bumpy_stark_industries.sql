CREATE TYPE "public"."claim_kind" AS ENUM('claim', 'new');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "place_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "claim_kind" NOT NULL,
	"status" "claim_status" DEFAULT 'pending' NOT NULL,
	"applicant_name" text,
	"applicant_phone" text,
	"applicant_role" text,
	"comment" text,
	"decided_at" timestamp,
	"decided_by" text,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_claims" ADD CONSTRAINT "place_claims_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_claims" ADD CONSTRAINT "place_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_claims_aprobado_idx" ON "place_claims" USING btree ("place_id") WHERE "place_claims"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "place_claims_user_idx" ON "place_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "place_claims_pendientes_idx" ON "place_claims" USING btree ("created_at") WHERE "place_claims"."status" = 'pending';