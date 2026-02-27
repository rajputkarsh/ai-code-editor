/**
 * Database Schema for Workspace Persistence
 * 
 * This schema defines the structure for storing workspace data in the database.
 * Each workspace is owned by a user (via Clerk userId) and contains:
 * - Virtual file system structure
 * - Editor state (tabs, cursor position, layout)
 * - Metadata (name, source, timestamps)
 */

import { pgTable, text, timestamp, uuid, jsonb, uniqueIndex, integer, boolean } from 'drizzle-orm/pg-core';

/**
 * App Users Table
 *
 * Clerk remains the source of truth for authentication, but we persist a local
 * row keyed by Clerk userId so billing and entitlements can be enforced with
 * server-side joins and deterministic ownership.
 */
export const appUsers = pgTable('app_users', {
  userId: text('user_id').primaryKey(), // Clerk user ID
  email: text('email'),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type AppUser = typeof appUsers.$inferSelect;
export type NewAppUser = typeof appUsers.$inferInsert;

/**
 * User subscriptions persisted from billing provider webhooks (Lemon Squeezy).
 *
 * Billing is intentionally isolated from editor and AI internals. Core editor
 * logic never imports provider primitives and consumes only entitlements.
 */
export const userSubscriptions = pgTable('user_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().unique(),
  plan: text('plan').notNull().default('free'), // free | pro | team
  status: text('status').notNull().default('inactive'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;

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
  // Team-owned workspace when set; otherwise workspace is user-owned.
  teamId: uuid('team_id'),
  name: text('name').notNull(),
  source: text('source').notNull(), // 'zip' | 'github' | 'manual'
  projectType: text('project_type'),
  
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
 * Team Table (Phase 5)
 */
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

/**
 * Team Memberships with role-based access.
 */
export const teamMemberships = pgTable(
  'team_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull(), // OWNER | ADMIN | EDITOR | VIEWER
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    teamUserUnique: uniqueIndex('team_memberships_team_user_idx').on(table.teamId, table.userId),
  })
);

export type TeamMembership = typeof teamMemberships.$inferSelect;
export type NewTeamMembership = typeof teamMemberships.$inferInsert;

/**
 * Workspace comments (file-level only, non-threaded).
 */
export const workspaceComments = pgTable('workspace_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  fileId: text('file_id').notNull(),
  content: text('content').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type WorkspaceComment = typeof workspaceComments.$inferSelect;
export type NewWorkspaceComment = typeof workspaceComments.$inferInsert;

/**
 * Shared team prompt library.
 */
export const teamPrompts = pgTable('team_prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type TeamPrompt = typeof teamPrompts.$inferSelect;
export type NewTeamPrompt = typeof teamPrompts.$inferInsert;

/**
 * Immutable AI action audit logs.
 */
export const aiAuditLogs = pgTable('ai_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  teamId: uuid('team_id'),
  triggeredBy: text('triggered_by').notNull(),
  action: text('action').notNull(),
  filesModified: jsonb('files_modified').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type AIAuditLog = typeof aiAuditLogs.$inferSelect;
export type NewAIAuditLog = typeof aiAuditLogs.$inferInsert;

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

/**
 * Phase 6: User-defined AI agent configurations.
 *
 * Agent permission boundaries are stored server-side and are never trusted from
 * client requests alone.
 */
export const aiAgents = pgTable('ai_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  persona: text('persona').notNull(),
  allowedTools: jsonb('allowed_tools').notNull(), // string[]
  permissionScope: jsonb('permission_scope').notNull(),
  createdBy: text('created_by').notNull(),
  teamId: uuid('team_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type AIAgent = typeof aiAgents.$inferSelect;
export type NewAIAgent = typeof aiAgents.$inferInsert;

/**
 * Phase 6: Per-task model preference.
 *
 * taskType supports: chat | inline_completion | agent_mode
 */
export const aiModelPreferences = pgTable(
  'ai_model_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    workspaceId: uuid('workspace_id'),
    taskType: text('task_type').notNull(),
    model: text('model').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    modelPrefUnique: uniqueIndex('ai_model_preferences_scope_idx').on(
      table.userId,
      table.workspaceId,
      table.taskType
    ),
  })
);

export type AIModelPreference = typeof aiModelPreferences.$inferSelect;
export type NewAIModelPreference = typeof aiModelPreferences.$inferInsert;

/**
 * Phase 6: Request-level token accounting for cost governance.
 */
export const aiUsageEvents = pgTable('ai_usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  workspaceId: uuid('workspace_id'),
  teamId: uuid('team_id'),
  taskType: text('task_type').notNull(),
  modelUsed: text('model_used').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type AIUsageEvent = typeof aiUsageEvents.$inferSelect;
export type NewAIUsageEvent = typeof aiUsageEvents.$inferInsert;

/**
 * Phase 6: Server-enforced usage caps.
 *
 * Scope:
 * - USER: userId set, teamId null
 * - TEAM: teamId set, userId null
 */
export const aiUsageLimits = pgTable(
  'ai_usage_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scopeType: text('scope_type').notNull(), // USER | TEAM
    userId: text('user_id'),
    teamId: uuid('team_id'),
    billingPeriodStart: timestamp('billing_period_start').notNull(),
    billingPeriodEnd: timestamp('billing_period_end').notNull(),
    softLimitTokens: integer('soft_limit_tokens').notNull(),
    hardLimitTokens: integer('hard_limit_tokens').notNull(),
    warningThresholdPercent: integer('warning_threshold_percent').notNull().default(80),
    aiDisabled: boolean('ai_disabled').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    usageLimitUserUnique: uniqueIndex('ai_usage_limits_user_period_idx').on(
      table.scopeType,
      table.userId,
      table.billingPeriodStart,
      table.billingPeriodEnd
    ),
    usageLimitTeamUnique: uniqueIndex('ai_usage_limits_team_period_idx').on(
      table.scopeType,
      table.teamId,
      table.billingPeriodStart,
      table.billingPeriodEnd
    ),
  })
);

export type AIUsageLimit = typeof aiUsageLimits.$inferSelect;
export type NewAIUsageLimit = typeof aiUsageLimits.$inferInsert;

/**
 * Phase 6: Extension metadata registry.
 */
export const extensions = pgTable('extensions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  commands: jsonb('commands').notNull(), // string[]
  permissionScope: jsonb('permission_scope').notNull(), // string[]
  createdBy: text('created_by').notNull(),
  teamId: uuid('team_id'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Extension = typeof extensions.$inferSelect;
export type NewExtension = typeof extensions.$inferInsert;

/**
 * Phase 6: Product analytics events kept separate from immutable AI audit logs.
 */
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  userId: text('user_id').notNull(),
  workspaceId: uuid('workspace_id'),
  teamId: uuid('team_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

