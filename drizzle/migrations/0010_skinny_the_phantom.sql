CREATE TABLE "ai_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"persona" text NOT NULL,
	"allowed_tools" jsonb NOT NULL,
	"permission_scope" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"team_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_model_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" uuid,
	"task_type" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" uuid,
	"team_id" uuid,
	"task_type" text NOT NULL,
	"model_used" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"user_id" text,
	"team_id" uuid,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"soft_limit_tokens" integer NOT NULL,
	"hard_limit_tokens" integer NOT NULL,
	"warning_threshold_percent" integer DEFAULT 80 NOT NULL,
	"ai_disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" uuid,
	"team_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extensions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"commands" jsonb NOT NULL,
	"permission_scope" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"team_id" uuid,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_preferences_scope_idx" ON "ai_model_preferences" USING btree ("user_id","workspace_id","task_type");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_limits_user_period_idx" ON "ai_usage_limits" USING btree ("scope_type","user_id","billing_period_start","billing_period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_limits_team_period_idx" ON "ai_usage_limits" USING btree ("scope_type","team_id","billing_period_start","billing_period_end");