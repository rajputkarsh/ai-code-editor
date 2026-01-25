-- Initial Workspace Schema Migration
-- Phase 1.5: Workspace Persistence & Cloud Sync

-- Create workspaces table
CREATE TABLE IF NOT EXISTS "workspaces" (
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

-- Create index on user_id for efficient user workspace queries
CREATE INDEX IF NOT EXISTS "idx_workspaces_user_id" ON "workspaces" ("user_id");

-- Create index on last_opened_at for efficient "get latest workspace" queries
CREATE INDEX IF NOT EXISTS "idx_workspaces_last_opened" ON "workspaces" ("last_opened_at" DESC);

