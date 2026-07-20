CREATE TYPE "public"."region" AS ENUM('caba', 'norte', 'oeste', 'sur');--> statement-breakpoint
CREATE TABLE "place_zones" (
	"place_id" uuid NOT NULL,
	"zone_id" integer NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "place_zones_place_id_zone_id_pk" PRIMARY KEY("place_id","zone_id")
);
--> statement-breakpoint
CREATE TABLE "zone_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" integer NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"region" "region" NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"polygon" jsonb NOT NULL,
	"polygon_search" jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "zones_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "place_zones" ADD CONSTRAINT "place_zones_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_zones" ADD CONSTRAINT "place_zones_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_aliases" ADD CONSTRAINT "zone_aliases_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_zones_zone_idx" ON "place_zones" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "place_zones_primary_idx" ON "place_zones" USING btree ("place_id") WHERE "place_zones"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "zone_aliases_zone_alias_idx" ON "zone_aliases" USING btree ("zone_id","alias");--> statement-breakpoint
CREATE INDEX "zone_aliases_alias_idx" ON "zone_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "zones_region_idx" ON "zones" USING btree ("region");