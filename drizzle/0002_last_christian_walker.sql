-- Búsqueda por texto tolerante a acentos y typos (decisión 14 de BUSQUEDA).
-- Ambas son extensiones vanilla: están en el Postgres de Docker y en Neon.
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- `unaccent()` se declara STABLE, no IMMUTABLE, porque depende del diccionario
-- de texto activo — y Postgres no acepta funciones STABLE en un índice. El
-- wrapper fija el diccionario explícitamente, lo que la vuelve IMMUTABLE de
-- verdad. Sin esto, el índice de abajo no se puede crear y toda búsqueda por
-- texto termina en seq scan sobre 26.057 filas.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint

-- GIN + trigramas sobre el nombre YA normalizado: la query tiene que filtrar por
-- `immutable_unaccent(lower(name))` para pegarle a este índice.
CREATE INDEX IF NOT EXISTS "places_name_trgm_idx"
  ON "places" USING gin (immutable_unaccent(lower("name")) gin_trgm_ops);--> statement-breakpoint

CREATE TABLE "chip_tags" (
	"chip_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "chip_tags_chip_id_tag_id_pk" PRIMARY KEY("chip_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "occasion_chips" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"in_home" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "occasion_chips_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "place_impressions_daily" (
	"place_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "place_impressions_daily_place_id_date_pk" PRIMARY KEY("place_id","date")
);
--> statement-breakpoint
ALTER TABLE "chip_tags" ADD CONSTRAINT "chip_tags_chip_id_occasion_chips_id_fk" FOREIGN KEY ("chip_id") REFERENCES "public"."occasion_chips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_tags" ADD CONSTRAINT "chip_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_impressions_daily" ADD CONSTRAINT "place_impressions_daily_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;