CREATE TABLE "workspace_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"active_workspace_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
