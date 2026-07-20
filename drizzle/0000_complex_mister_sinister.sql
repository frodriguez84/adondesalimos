CREATE TYPE "public"."facet" AS ENUM('tipo', 'cocina', 'actividad', 'ambiente', 'precio', 'momento');--> statement-breakpoint
CREATE TYPE "public"."place_source" AS ENUM('overture', 'owner');--> statement-breakpoint
CREATE TYPE "public"."place_tag_source" AS ENUM('import', 'owner', 'admin');--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_tags" (
	"place_id" uuid NOT NULL,
	"tag_id" integer NOT NULL,
	"source" "place_tag_source" DEFAULT 'import' NOT NULL,
	CONSTRAINT "place_tags_place_id_tag_id_pk" PRIMARY KEY("place_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "place_source" NOT NULL,
	"overture_id" text,
	"google_place_id" text,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"address" text,
	"locality" text,
	"phones" jsonb,
	"websites" jsonb,
	"socials" jsonb,
	"emails" jsonb,
	"overture_category" text,
	"confidence" real,
	"operating_status" text DEFAULT 'open' NOT NULL,
	"publish_override" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "places_overture_id_unique" UNIQUE("overture_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"facet" "facet" NOT NULL,
	"parent_id" integer,
	"group_label" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "place_tags" ADD CONSTRAINT "place_tags_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_tags" ADD CONSTRAINT "place_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_parent_id_tags_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_tags_tag_idx" ON "place_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "places_confidence_idx" ON "places" USING btree ("confidence");--> statement-breakpoint
CREATE INDEX "tags_facet_idx" ON "tags" USING btree ("facet");