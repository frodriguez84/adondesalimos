CREATE TYPE "public"."plan_grant_action" AS ENUM('grant', 'revoke');--> statement-breakpoint
CREATE TABLE "plan_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" uuid,
	"accion" "plan_grant_action" NOT NULL,
	"motivo" text NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_grants_user_idx" ON "plan_grants" USING btree ("user_id","created_at" DESC NULLS LAST);