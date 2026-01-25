CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"vfs_data" jsonb NOT NULL,
	"editor_state_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_opened_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
