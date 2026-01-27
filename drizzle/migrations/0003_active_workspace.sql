-- Active Workspace Tracking (Phase 2.5)
-- Stores the active workspace per user for server-side access

CREATE TABLE IF NOT EXISTS "workspace_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"active_workspace_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Optional index for faster lookups (already covered by primary key on user_id)

