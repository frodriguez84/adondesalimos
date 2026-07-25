CREATE TYPE "public"."chat_modo" AS ENUM('chat', 'shortlist');--> statement-breakpoint
CREATE TYPE "public"."chat_plan" AS ENUM('trial', 'premium');--> statement-breakpoint
CREATE TABLE "ai_api_usage" (
	"month" text NOT NULL,
	"sku" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_api_usage_month_sku_pk" PRIMARY KEY("month","sku")
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"modo" "chat_modo" DEFAULT 'chat' NOT NULL,
	"titulo" text,
	"seen_place_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model_used" text,
	"tokens_in" integer,
	"tokens_out" integer,
	"plan_at_send" "chat_plan",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_quota_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_usage_monthly" (
	"user_id" uuid NOT NULL,
	"month" text NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_usage_monthly_user_id_month_pk" PRIMARY KEY("user_id","month")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "chat_trial_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_quota_grants" ADD CONSTRAINT "chat_quota_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_usage_monthly" ADD CONSTRAINT "chat_usage_monthly_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_conversations_user_idx" ON "chat_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chat_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_quota_grants_user_month_idx" ON "chat_quota_grants" USING btree ("user_id","month");