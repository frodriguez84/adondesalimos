CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."tap_kind" AS ENUM('telefono', 'como_llegar', 'website', 'redes', 'menu');--> statement-breakpoint
CREATE TABLE "app_settings_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_tag_impressions_daily" (
	"place_id" uuid NOT NULL,
	"date" date NOT NULL,
	"tag_id" integer NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "place_tag_impressions_daily_place_id_date_tag_id_pk" PRIMARY KEY("place_id","date","tag_id")
);
--> statement-breakpoint
CREATE TABLE "place_taps_daily" (
	"place_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "tap_kind" NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "place_taps_daily_place_id_date_kind_pk" PRIMARY KEY("place_id","date","kind")
);
--> statement-breakpoint
CREATE TABLE "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"mp_authorized_payment_id" text NOT NULL,
	"amount_ars" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_payments_mp_authorized_payment_id_unique" UNIQUE("mp_authorized_payment_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" uuid,
	"status" "subscription_status" NOT NULL,
	"mp_preapproval_id" text NOT NULL,
	"mp_payer_email" text,
	"amount_ars" integer NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_mp_preapproval_id_unique" UNIQUE("mp_preapproval_id")
);
--> statement-breakpoint
ALTER TABLE "place_impressions_daily" ADD COLUMN "featured_impressions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "place_tag_impressions_daily" ADD CONSTRAINT "place_tag_impressions_daily_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_tag_impressions_daily" ADD CONSTRAINT "place_tag_impressions_daily_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_taps_daily" ADD CONSTRAINT "place_taps_daily_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_b2c_viva_idx" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."place_id" IS NULL AND "subscriptions"."status" <> 'canceled';--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_b2b_viva_idx" ON "subscriptions" USING btree ("place_id") WHERE "subscriptions"."place_id" IS NOT NULL AND "subscriptions"."status" <> 'canceled';--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_place_idx" ON "subscriptions" USING btree ("place_id");