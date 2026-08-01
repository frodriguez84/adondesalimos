CREATE TABLE "premium_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "premium_interest" ADD CONSTRAINT "premium_interest_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "premium_interest" ADD CONSTRAINT "premium_interest_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "premium_interest_b2c_idx" ON "premium_interest" USING btree ("user_id") WHERE "premium_interest"."place_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "premium_interest_b2b_idx" ON "premium_interest" USING btree ("user_id","place_id") WHERE "premium_interest"."place_id" IS NOT NULL;