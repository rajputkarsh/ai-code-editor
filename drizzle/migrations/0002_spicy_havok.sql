CREATE TABLE "github_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"github_user_id" text NOT NULL,
	"github_username" text NOT NULL,
	"access_token" text NOT NULL,
	"scope" text NOT NULL,
	"token_type" text DEFAULT 'bearer' NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_auth_user_id_unique" UNIQUE("user_id")
);
