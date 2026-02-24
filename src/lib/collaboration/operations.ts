import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import type { TeamRole } from './types';
import { canDeleteWorkspace, canManageMembers, canManageTeamPrompts, canModifyWorkspace } from './permissions';

const {
  teams: teamsTable,
  teamMemberships: teamMembershipsTable,
  workspaces: workspacesTable,
  workspaceComments: workspaceCommentsTable,
  teamPrompts: teamPromptsTable,
  aiAuditLogs: aiAuditLogsTable,
} = schema;

type WorkspaceRole = TeamRole | 'OWNER';

export interface WorkspaceAccessResult {
  workspaceId: string;
  teamId: string | null;
  role: WorkspaceRole;
}

export async function createTeam(userId: string, name: string): Promise<string> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not configured');
  }

  const inserted = await db
    .insert(teamsTable)
    .values({
      name,
      ownerId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: teamsTable.id });

  const teamId = inserted[0]?.id;
  if (!teamId) {
    throw new Error('Failed to create team');
  }

  await db.insert(teamMembershipsTable).values({
    teamId,
    userId,
    role: 'OWNER',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return teamId;
}

export async function getTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select({ role: teamMembershipsTable.role })
    .from(teamMembershipsTable)
    .where(and(eq(teamMembershipsTable.teamId, teamId), eq(teamMembershipsTable.userId, userId)))
    .limit(1);

  const role = rows[0]?.role;
  if (!role) return null;
  if (role === 'OWNER' || role === 'ADMIN' || role === 'EDITOR' || role === 'VIEWER') {
    return role;
  }
  return null;
}

export async function ensureTeamRole(userId: string, teamId: string, minimumRole: TeamRole): Promise<TeamRole> {
  const role = await getTeamRole(userId, teamId);
  if (!role) {
    throw new Error('Team access denied');
  }

  const allowed =
    minimumRole === 'VIEWER'
      ? true
      : minimumRole === 'EDITOR'
        ? canModifyWorkspace(role)
        : minimumRole === 'ADMIN'
          ? canManageMembers(role)
          : role === 'OWNER';

  if (!allowed) {
    throw new Error('Insufficient role for this operation');
  }

  return role;
}

export async function inviteMember(
  userId: string,
  teamId: string,
  invitedUserId: string,
  role: TeamRole
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  await ensureTeamRole(userId, teamId, 'ADMIN');

  await db
    .insert(teamMembershipsTable)
    .values({
      teamId,
      userId: invitedUserId,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [teamMembershipsTable.teamId, teamMembershipsTable.userId],
      set: {
        role,
        updatedAt: new Date(),
      },
    });
}

export async function updateMemberRole(
  userId: string,
  teamId: string,
  memberUserId: string,
  role: TeamRole
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  await ensureTeamRole(userId, teamId, 'ADMIN');

  await db
    .update(teamMembershipsTable)
    .set({
      role,
      updatedAt: new Date(),
    })
    .where(and(eq(teamMembershipsTable.teamId, teamId), eq(teamMembershipsTable.userId, memberUserId)));
}

export async function removeMember(userId: string, teamId: string, memberUserId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  await ensureTeamRole(userId, teamId, 'ADMIN');

  await db
    .delete(teamMembershipsTable)
    .where(and(eq(teamMembershipsTable.teamId, teamId), eq(teamMembershipsTable.userId, memberUserId)));
}

export async function resolveWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<WorkspaceAccessResult | null> {
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select({
      id: workspacesTable.id,
      userId: workspacesTable.userId,
      teamId: workspacesTable.teamId,
    })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const workspace = rows[0];
  if (!workspace.teamId) {
    if (workspace.userId !== userId) return null;
    return {
      workspaceId,
      teamId: null,
      role: 'OWNER',
    };
  }

  const role = await getTeamRole(userId, workspace.teamId);
  if (!role) {
    return null;
  }

  return {
    workspaceId,
    teamId: workspace.teamId,
    role,
  };
}

export function assertCanReadWorkspace(access: WorkspaceAccessResult | null): asserts access is WorkspaceAccessResult {
  if (!access) {
    throw new Error('Workspace access denied');
  }
}

export function assertCanModifyWorkspace(access: WorkspaceAccessResult | null): asserts access is WorkspaceAccessResult {
  assertCanReadWorkspace(access);
  if (access.role !== 'OWNER' && !canModifyWorkspace(access.role)) {
    throw new Error('Workspace write access denied');
  }
}

export function assertCanDeleteWorkspace(access: WorkspaceAccessResult | null): asserts access is WorkspaceAccessResult {
  assertCanReadWorkspace(access);
  if (access.role !== 'OWNER' && !canDeleteWorkspace(access.role)) {
    throw new Error('Workspace delete access denied');
  }
}

export async function listAccessibleTeamIds(userId: string): Promise<string[]> {
  const db = getDb();
  if (!db) return [];

  const memberships = await db
    .select({ teamId: teamMembershipsTable.teamId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.userId, userId));

  return memberships.map((m) => m.teamId);
}

export async function addWorkspaceComment(
  userId: string,
  workspaceId: string,
  fileId: string,
  content: string
): Promise<string> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const access = await resolveWorkspaceAccess(userId, workspaceId);
  assertCanReadWorkspace(access);

  const rows = await db
    .insert(workspaceCommentsTable)
    .values({
      workspaceId,
      fileId,
      content,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: workspaceCommentsTable.id });

  return rows[0].id;
}

export async function listWorkspaceComments(userId: string, workspaceId: string) {
  const db = getDb();
  if (!db) return [];

  const access = await resolveWorkspaceAccess(userId, workspaceId);
  assertCanReadWorkspace(access);

  return db
    .select({
      id: workspaceCommentsTable.id,
      fileId: workspaceCommentsTable.fileId,
      content: workspaceCommentsTable.content,
      createdBy: workspaceCommentsTable.createdBy,
      createdAt: workspaceCommentsTable.createdAt,
      updatedAt: workspaceCommentsTable.updatedAt,
    })
    .from(workspaceCommentsTable)
    .where(eq(workspaceCommentsTable.workspaceId, workspaceId))
    .orderBy(desc(workspaceCommentsTable.createdAt));
}

export async function createTeamPrompt(
  userId: string,
  teamId: string,
  title: string,
  prompt: string
): Promise<string> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const role = await ensureTeamRole(userId, teamId, 'EDITOR');
  if (!canManageTeamPrompts(role)) {
    throw new Error('Insufficient role for prompt library');
  }

  const rows = await db
    .insert(teamPromptsTable)
    .values({
      teamId,
      title,
      prompt,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: teamPromptsTable.id });

  return rows[0].id;
}

export async function listTeamPrompts(userId: string, teamId: string) {
  const db = getDb();
  if (!db) return [];

  await ensureTeamRole(userId, teamId, 'VIEWER');

  return db
    .select({
      id: teamPromptsTable.id,
      title: teamPromptsTable.title,
      prompt: teamPromptsTable.prompt,
      createdBy: teamPromptsTable.createdBy,
      createdAt: teamPromptsTable.createdAt,
      updatedAt: teamPromptsTable.updatedAt,
    })
    .from(teamPromptsTable)
    .where(eq(teamPromptsTable.teamId, teamId))
    .orderBy(desc(teamPromptsTable.updatedAt));
}

export async function updateTeamPrompt(
  userId: string,
  teamId: string,
  promptId: string,
  title: string,
  prompt: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  await ensureTeamRole(userId, teamId, 'EDITOR');

  await db
    .update(teamPromptsTable)
    .set({
      title,
      prompt,
      updatedAt: new Date(),
    })
    .where(and(eq(teamPromptsTable.id, promptId), eq(teamPromptsTable.teamId, teamId)));
}

export async function deleteTeamPrompt(userId: string, teamId: string, promptId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  await ensureTeamRole(userId, teamId, 'EDITOR');

  await db
    .delete(teamPromptsTable)
    .where(and(eq(teamPromptsTable.id, promptId), eq(teamPromptsTable.teamId, teamId)));
}

export async function createAIAuditLog(input: {
  userId: string;
  workspaceId: string;
  action: string;
  filesModified: string[];
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const access = await resolveWorkspaceAccess(input.userId, input.workspaceId);
  assertCanReadWorkspace(access);

  const rows = await db
    .insert(aiAuditLogsTable)
    .values({
      workspaceId: input.workspaceId,
      teamId: access.teamId,
      triggeredBy: input.userId,
      action: input.action,
      filesModified: input.filesModified,
      metadata: input.metadata ?? null,
      createdAt: new Date(),
    })
    .returning({ id: aiAuditLogsTable.id });

  return rows[0].id;
}

export async function listAIAuditLogs(userId: string, workspaceId: string) {
  const db = getDb();
  if (!db) return [];

  const access = await resolveWorkspaceAccess(userId, workspaceId);
  assertCanReadWorkspace(access);

  return db
    .select({
      id: aiAuditLogsTable.id,
      workspaceId: aiAuditLogsTable.workspaceId,
      teamId: aiAuditLogsTable.teamId,
      triggeredBy: aiAuditLogsTable.triggeredBy,
      action: aiAuditLogsTable.action,
      filesModified: aiAuditLogsTable.filesModified,
      metadata: aiAuditLogsTable.metadata,
      createdAt: aiAuditLogsTable.createdAt,
    })
    .from(aiAuditLogsTable)
    .where(eq(aiAuditLogsTable.workspaceId, workspaceId))
    .orderBy(desc(aiAuditLogsTable.createdAt));
}

export async function listTeamsForUser(userId: string) {
  const db = getDb();
  if (!db) return [];

  return db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      ownerId: teamsTable.ownerId,
      createdAt: teamsTable.createdAt,
      role: teamMembershipsTable.role,
    })
    .from(teamsTable)
    .innerJoin(teamMembershipsTable, eq(teamMembershipsTable.teamId, teamsTable.id))
    .where(eq(teamMembershipsTable.userId, userId))
    .orderBy(desc(teamsTable.createdAt));
}

export async function listMembers(userId: string, teamId: string) {
  const db = getDb();
  if (!db) return [];

  await ensureTeamRole(userId, teamId, 'VIEWER');

  return db
    .select({
      userId: teamMembershipsTable.userId,
      role: teamMembershipsTable.role,
      createdAt: teamMembershipsTable.createdAt,
    })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, teamId))
    .orderBy(desc(teamMembershipsTable.createdAt));
}

export async function listAccessibleWorkspaces(userId: string) {
  const db = getDb();
  if (!db) return [];

  const teamIds = await listAccessibleTeamIds(userId);

  const baseQuery = db
    .select({
      id: workspacesTable.id,
      name: workspacesTable.name,
      source: workspacesTable.source,
      teamId: workspacesTable.teamId,
      userId: workspacesTable.userId,
      lastOpenedAt: workspacesTable.lastOpenedAt,
      createdAt: workspacesTable.createdAt,
    })
    .from(workspacesTable);

  if (teamIds.length === 0) {
    return baseQuery.where(eq(workspacesTable.userId, userId)).orderBy(desc(workspacesTable.lastOpenedAt));
  }

  return baseQuery
    .where(or(eq(workspacesTable.userId, userId), inArray(workspacesTable.teamId, teamIds)))
    .orderBy(desc(workspacesTable.lastOpenedAt));
}

export async function assignWorkspaceToTeam(
  userId: string,
  workspaceId: string,
  teamId: string | null
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('Database not configured');

  const access = await resolveWorkspaceAccess(userId, workspaceId);
  assertCanModifyWorkspace(access);

  if (teamId) {
    await ensureTeamRole(userId, teamId, 'EDITOR');
  }

  await db
    .update(workspacesTable)
    .set({
      teamId,
      updatedAt: new Date(),
    })
    .where(eq(workspacesTable.id, workspaceId));
}
