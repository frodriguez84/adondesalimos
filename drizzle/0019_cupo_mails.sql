CREATE TABLE "email_api_usage" (
	"month" text NOT NULL,
	"sku" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "email_api_usage_month_sku_pk" PRIMARY KEY("month","sku")
);
--> statement-breakpoint
CREATE TABLE "email_recipient_daily" (
	"day" date NOT NULL,
	"recipient_hash" text NOT NULL,
	"sku" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "email_recipient_daily_day_recipient_hash_sku_pk" PRIMARY KEY("day","recipient_hash","sku")
);
