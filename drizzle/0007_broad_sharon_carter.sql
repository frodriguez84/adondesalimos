CREATE TYPE "public"."poll_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_plan" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"voter_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"token" text NOT NULL,
	"title" text,
	"status" "poll_status" DEFAULT 'open' NOT NULL,
	"winner_place_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"closed_at" timestamp,
	CONSTRAINT "polls_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan" "user_plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_winner_place_id_places_id_fk" FOREIGN KEY ("winner_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "poll_options_poll_place_idx" ON "poll_options" USING btree ("poll_id","place_id");--> statement-breakpoint
CREATE INDEX "poll_options_poll_idx" ON "poll_options" USING btree ("poll_id");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_poll_voter_idx" ON "poll_votes" USING btree ("poll_id","voter_token");--> statement-breakpoint
CREATE INDEX "poll_votes_option_idx" ON "poll_votes" USING btree ("option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "polls_token_idx" ON "polls" USING btree ("token");--> statement-breakpoint
CREATE INDEX "polls_creator_idx" ON "polls" USING btree ("creator_id");