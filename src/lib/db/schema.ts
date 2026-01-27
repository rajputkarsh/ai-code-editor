/**
 * Database Schema for Workspace Persistence
 * 
 * This schema defines the structure for storing workspace data in the database.
 * Each workspace is owned by a user (via Clerk userId) and contains:
 * - Virtual file system structure
 * - Editor state (tabs, cursor position, layout)
 * - Metadata (name, source, timestamps)
 */

import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';

/**
 * Workspaces Table
 * 
 * Stores user workspaces with their file system and editor state.
 * 
 * Design decisions:
 * - userId: References Clerk user ID (not a foreign key, as Clerk manages users)
 * - vfsData: JSONB for efficient querying and flexibility
 * - editorStateData: JSONB, nullable (can be initialized later)
 * - githubMetadata: JSONB for GitHub-linked workspaces (Phase 1.6)
 * - Timestamps for auditing and sync logic
 * 
 * Phase 1.6 GitHub Interoperability:
 * - For GitHub-linked workspaces (source='github'), githubMetadata tracks:
 *   - Repository URL
 *   - Branch name
 *   - Last synced commit SHA
 *   - Last sync timestamp
 * - GitHub repository is the source of truth for GitHub-linked projects
 * - Cloud workspace tracks local uncommitted changes only
 */
export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // Clerk user ID
  name: text('name').notNull(),
  source: text('source').notNull(), // 'zip' | 'github' | 'manual'
  
  // File system structure (VFSStructure) stored as JSONB
  vfsData: jsonb('vfs_data').notNull(),
  
  // Editor state (EditorState) stored as JSONB
  editorStateData: jsonb('editor_state_data'),
  
  // GitHub metadata (GitHubMetadata) stored as JSONB - only for GitHub-linked workspaces
  githubMetadata: jsonb('github_metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastOpenedAt: timestamp('last_opened_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

/**
 * Workspace Settings Table (Phase 2.5)
 *
 * Stores per-user workspace settings, including the active workspace.
 * This provides a server-side source of truth for active workspace selection.
 */
export const workspaceSettings = pgTable('workspace_settings', {
  userId: text('user_id').primaryKey(),
  activeWorkspaceId: uuid('active_workspace_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;
export type NewWorkspaceSettings = typeof workspaceSettings.$inferInsert;

/**
 * GitHub Authentication Table (Phase 2)
 * 
 * Stores GitHub OAuth tokens for users who have connected their GitHub account.
 * 
 * Security:
 * - Access tokens are encrypted
 * - Server-side only access
 * - User-scoped permissions
 */
export const githubAuth = pgTable('github_auth', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(), // Clerk user ID (one GitHub connection per user)
  githubUserId: text('github_user_id').notNull(), // GitHub user ID
  githubUsername: text('github_username').notNull(),
  accessToken: text('access_token').notNull(), // Encrypted OAuth access token
  scope: text('scope').notNull(), // OAuth scopes granted (e.g., 'repo, read:user')
  tokenType: text('token_type').notNull().default('bearer'),
  
  // Timestamps
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
});

export type GitHubAuth = typeof githubAuth.$inferSelect;
export type NewGitHubAuth = typeof githubAuth.$inferInsert;

