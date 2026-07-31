CREATE TABLE "place_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "place_impressions_daily" ADD COLUMN "saves" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "place_list_items" ADD CONSTRAINT "place_list_items_list_id_place_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."place_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_list_items" ADD CONSTRAINT "place_list_items_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_lists" ADD CONSTRAINT "place_lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_list_items_list_place_idx" ON "place_list_items" USING btree ("list_id","place_id");--> statement-breakpoint
CREATE INDEX "place_list_items_list_idx" ON "place_list_items" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "place_list_items_place_idx" ON "place_list_items" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "place_lists_user_idx" ON "place_lists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_lists_default_idx" ON "place_lists" USING btree ("user_id") WHERE "place_lists"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "place_lists_user_name_idx" ON "place_lists" USING btree ("user_id",lower("name"));