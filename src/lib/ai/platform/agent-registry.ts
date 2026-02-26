import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ensureTeamRole, listAccessibleTeamIds } from '@/lib/collaboration/operations';
import { AgentDefinition, AgentPermissionScope } from './types';
import { sanitizeAllowedTools } from './tools';

const { aiAgents: aiAgentsTable } = schema;

function parsePermissionScope(raw: unknown): AgentPermissionScope {
  const safe = (raw ?? {}) as Partial<AgentPermissionScope>;
  return {
    readFiles: Boolean(safe.readFiles),
    writeFiles: Boolean(safe.writeFiles),
    commit: Boolean(safe.commit),
    createBranch: Boolean(safe.createBranch),
    openPR: Boolean(safe.openPR),
  };
}

function mapAgentRow(row: typeof aiAgentsTable.$inferSelect): AgentDefinition {
  return {
    agentId: row.id,
    name: row.name,
    description: row.description,
    persona: row.persona,
    allowedTools: sanitizeAllowedTools((row.allowedTools as string[]) ?? []),
    permissionScope: parsePermissionScope(row.permissionScope),
    createdBy: row.createdBy,
    teamScope: row.teamId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createAgentDefinition(input: {
  userId: string;
  name: string;
  description: string;
  persona: string;
  allowedTools: string[];
  permissionScope: AgentPermissionScope;
  teamScope?: string;
}): Promise<AgentDefinition> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not configured');
  }

  if (input.teamScope) {
    await ensureTeamRole(input.userId, input.teamScope, 'EDITOR');
  }

  const allowedTools = sanitizeAllowedTools(input.allowedTools);
  const inserted = await db
    .insert(aiAgentsTable)
    .values({
      name: input.name,
      description: input.description,
      persona: input.persona,
      allowedTools,
      permissionScope: input.permissionScope,
      createdBy: input.userId,
      teamId: input.teamScope ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const created = inserted[0];
  if (!created) {
    throw new Error('Failed to create agent');
  }
  return mapAgentRow(created);
}

export async function listAgentDefinitions(userId: string): Promise<AgentDefinition[]> {
  const db = getDb();
  if (!db) return [];

  const teamIds = await listAccessibleTeamIds(userId);
  const query = db.select().from(aiAgentsTable);
  const rows =
    teamIds.length === 0
      ? await query.where(eq(aiAgentsTable.createdBy, userId)).orderBy(desc(aiAgentsTable.updatedAt))
      : await query
          .where(or(eq(aiAgentsTable.createdBy, userId), inArray(aiAgentsTable.teamId, teamIds)))
          .orderBy(desc(aiAgentsTable.updatedAt));

  return rows.map(mapAgentRow);
}

export async function getAgentDefinition(
  userId: string,
  agentId: string
): Promise<AgentDefinition | null> {
  const db = getDb();
  if (!db) return null;

  const teamIds = await listAccessibleTeamIds(userId);
  const query = db.select().from(aiAgentsTable);
  const rows =
    teamIds.length === 0
      ? await query
          .where(and(eq(aiAgentsTable.id, agentId), eq(aiAgentsTable.createdBy, userId)))
          .limit(1)
      : await query
          .where(
            and(
              eq(aiAgentsTable.id, agentId),
              or(eq(aiAgentsTable.createdBy, userId), inArray(aiAgentsTable.teamId, teamIds))
            )
          )
          .limit(1);

  const row = rows[0];
  return row ? mapAgentRow(row) : null;
}

export async function updateAgentDefinition(input: {
  userId: string;
  agentId: string;
  name: string;
  description: string;
  persona: string;
  allowedTools: string[];
  permissionScope: AgentPermissionScope;
}): Promise<AgentDefinition> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not configured');
  }

  const existing = await getAgentDefinition(input.userId, input.agentId);
  if (!existing) {
    throw new Error('Agent not found');
  }

  if (existing.teamScope) {
    await ensureTeamRole(input.userId, existing.teamScope, 'EDITOR');
  } else if (existing.createdBy !== input.userId) {
    throw new Error('Agent update denied');
  }

  const updatedRows = await db
    .update(aiAgentsTable)
    .set({
      name: input.name,
      description: input.description,
      persona: input.persona,
      allowedTools: sanitizeAllowedTools(input.allowedTools),
      permissionScope: input.permissionScope,
      updatedAt: new Date(),
    })
    .where(eq(aiAgentsTable.id, input.agentId))
    .returning();

  const row = updatedRows[0];
  if (!row) {
    throw new Error('Failed to update agent');
  }
  return mapAgentRow(row);
}

export async function deleteAgentDefinition(userId: string, agentId: string): Promise<void> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not configured');
  }

  const existing = await getAgentDefinition(userId, agentId);
  if (!existing) {
    throw new Error('Agent not found');
  }

  if (existing.teamScope) {
    await ensureTeamRole(userId, existing.teamScope, 'EDITOR');
  } else if (existing.createdBy !== userId) {
    throw new Error('Agent delete denied');
  }

  await db.delete(aiAgentsTable).where(eq(aiAgentsTable.id, agentId));
}
