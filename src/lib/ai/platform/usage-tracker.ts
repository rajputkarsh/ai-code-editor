import { and, desc, eq, gte, inArray, lte, or } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { ensureTeamRole, listAccessibleTeamIds } from '@/lib/collaboration/operations';
import { AITaskType, UsageSnapshot } from './types';
import { getEntitlementsForUser } from '@/lib/entitlements/service';

const {
  aiUsageEvents: aiUsageEventsTable,
  aiUsageLimits: aiUsageLimitsTable,
  workspaces: workspacesTable,
} = schema;

export interface UsageTotals {
  usedTokens: number;
  requestCount: number;
}

export interface UsageDashboard {
  user: UsageTotals;
  byWorkspace: Array<{ workspaceId: string; usedTokens: number; requestCount: number }>;
  byTeam: Array<{ teamId: string; usedTokens: number; requestCount: number }>;
  byModel: Array<{ model: string; usedTokens: number; requestCount: number }>;
}

interface UsageLimitRow {
  id: string;
  scopeType: string;
  userId: string | null;
  teamId: string | null;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  softLimitTokens: number;
  hardLimitTokens: number;
  warningThresholdPercent: number;
  aiDisabled: boolean;
}

const DEFAULT_WARNING_THRESHOLD = 80;

function getPlanBackedLimits(maxAiTokensPerMonth: number): {
  softLimit: number;
  hardLimit: number;
} {
  const hardLimit = maxAiTokensPerMonth;
  const softLimit = Math.floor(hardLimit * 0.8);
  return { softLimit, hardLimit };
}

function buildUsageSnapshot(limit: UsageLimitRow, usedTokens: number): UsageSnapshot {
  const warningCap = Math.floor((limit.hardLimitTokens * limit.warningThresholdPercent) / 100);
  return {
    usedTokens,
    softLimitTokens: limit.softLimitTokens,
    hardLimitTokens: limit.hardLimitTokens,
    warningThresholdPercent: limit.warningThresholdPercent,
    warningReached: usedTokens >= warningCap || usedTokens >= limit.softLimitTokens,
    hardLimitReached: usedTokens >= limit.hardLimitTokens,
    aiDisabled: limit.aiDisabled,
  };
}

function getCurrentBillingPeriod(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  return { start, end };
}

async function getOrCreateUserUsageLimit(userId: string, now: Date): Promise<UsageLimitRow> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not configured');
  }
  const entitlements = await getEntitlementsForUser(userId);
  const planLimits = getPlanBackedLimits(entitlements.maxAiTokensPerMonth);
  const { start, end } = getCurrentBillingPeriod(now);

  const existing = await db
    .select()
    .from(aiUsageLimitsTable)
    .where(
      and(
        eq(aiUsageLimitsTable.scopeType, 'USER'),
        eq(aiUsageLimitsTable.userId, userId),
        lte(aiUsageLimitsTable.billingPeriodStart, now),
        gte(aiUsageLimitsTable.billingPeriodEnd, now)
      )
    )
    .limit(1);

  if (existing[0]) {
    const current = existing[0];
    if (
      current.softLimitTokens !== planLimits.softLimit ||
      current.hardLimitTokens !== planLimits.hardLimit
    ) {
      await db
        .update(aiUsageLimitsTable)
        .set({
          softLimitTokens: planLimits.softLimit,
          hardLimitTokens: planLimits.hardLimit,
          updatedAt: now,
        })
        .where(eq(aiUsageLimitsTable.id, current.id));

      return {
        ...current,
        softLimitTokens: planLimits.softLimit,
        hardLimitTokens: planLimits.hardLimit,
      };
    }

    return existing[0];
  }

  const inserted = await db
    .insert(aiUsageLimitsTable)
    .values({
      scopeType: 'USER',
      userId,
      teamId: null,
      billingPeriodStart: start,
      billingPeriodEnd: end,
      softLimitTokens: planLimits.softLimit,
      hardLimitTokens: planLimits.hardLimit,
      warningThresholdPercent: DEFAULT_WARNING_THRESHOLD,
      aiDisabled: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const created = inserted[0];
  if (!created) {
    throw new Error('Failed to initialize usage limits');
  }
  return created;
}

async function getUsedTokensForLimit(limit: UsageLimitRow): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  if (!limit.userId && !limit.teamId) return 0;

  const scopeCondition = limit.userId
    ? eq(aiUsageEventsTable.userId, limit.userId)
    : eq(aiUsageEventsTable.teamId, limit.teamId as string);

  const rows = await db
    .select({
      inputTokens: aiUsageEventsTable.inputTokens,
      outputTokens: aiUsageEventsTable.outputTokens,
    })
    .from(aiUsageEventsTable)
    .where(
      and(
        scopeCondition,
        gte(aiUsageEventsTable.createdAt, limit.billingPeriodStart),
        lte(aiUsageEventsTable.createdAt, limit.billingPeriodEnd)
      )
    );

  return rows.reduce((sum, row) => sum + row.inputTokens + row.outputTokens, 0);
}

export async function evaluateUsageLimit(userId: string): Promise<UsageSnapshot> {
  const now = new Date();
  const limit = await getOrCreateUserUsageLimit(userId, now);
  const usedTokens = await getUsedTokensForLimit(limit);
  return buildUsageSnapshot(limit, usedTokens);
}

export async function recordAIUsageEvent(input: {
  userId: string;
  workspaceId?: string;
  taskType: AITaskType;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<UsageSnapshot> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not configured');
  }

  const snapshot = await evaluateUsageLimit(input.userId);
  if (snapshot.aiDisabled || snapshot.hardLimitReached) {
    throw new Error('AI usage limit exceeded for this billing period');
  }

  let teamId: string | null = null;
  if (input.workspaceId) {
    const rows = await db
      .select({ teamId: workspacesTable.teamId })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, input.workspaceId))
      .limit(1);
    teamId = rows[0]?.teamId ?? null;
  }

  await db.insert(aiUsageEventsTable).values({
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    teamId,
    taskType: input.taskType,
    modelUsed: input.modelUsed,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    createdAt: new Date(),
  });

  return evaluateUsageLimit(input.userId);
}

export async function setUsageLimit(input: {
  actorUserId: string;
  scopeType: 'USER' | 'TEAM';
  userId?: string;
  teamId?: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  softLimitTokens: number;
  hardLimitTokens: number;
  warningThresholdPercent: number;
  aiDisabled: boolean;
}): Promise<void> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not configured');
  }

  if (input.scopeType === 'TEAM') {
    if (!input.teamId) {
      throw new Error('teamId is required for TEAM scope');
    }
    await ensureTeamRole(input.actorUserId, input.teamId, 'ADMIN');
  } else if (input.actorUserId !== input.userId) {
    throw new Error('Cannot mutate another user usage limit');
  }

  await db
    .insert(aiUsageLimitsTable)
    .values({
      scopeType: input.scopeType,
      userId: input.scopeType === 'USER' ? input.userId ?? input.actorUserId : null,
      teamId: input.scopeType === 'TEAM' ? input.teamId ?? null : null,
      billingPeriodStart: input.billingPeriodStart,
      billingPeriodEnd: input.billingPeriodEnd,
      softLimitTokens: input.softLimitTokens,
      hardLimitTokens: input.hardLimitTokens,
      warningThresholdPercent: input.warningThresholdPercent,
      aiDisabled: input.aiDisabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target:
        input.scopeType === 'TEAM'
          ? [
              aiUsageLimitsTable.scopeType,
              aiUsageLimitsTable.teamId,
              aiUsageLimitsTable.billingPeriodStart,
              aiUsageLimitsTable.billingPeriodEnd,
            ]
          : [
              aiUsageLimitsTable.scopeType,
              aiUsageLimitsTable.userId,
              aiUsageLimitsTable.billingPeriodStart,
              aiUsageLimitsTable.billingPeriodEnd,
            ],
      set: {
        softLimitTokens: input.softLimitTokens,
        hardLimitTokens: input.hardLimitTokens,
        warningThresholdPercent: input.warningThresholdPercent,
        aiDisabled: input.aiDisabled,
        updatedAt: new Date(),
      },
    });
}

export async function getUsageDashboard(userId: string): Promise<UsageDashboard> {
  const db = getDb();
  if (!db) {
    return {
      user: { usedTokens: 0, requestCount: 0 },
      byWorkspace: [],
      byTeam: [],
      byModel: [],
    };
  }

  const teamIds = await listAccessibleTeamIds(userId);
  const usageRows =
    teamIds.length === 0
      ? await db
          .select()
          .from(aiUsageEventsTable)
          .where(eq(aiUsageEventsTable.userId, userId))
          .orderBy(desc(aiUsageEventsTable.createdAt))
      : await db
          .select()
          .from(aiUsageEventsTable)
          .where(or(eq(aiUsageEventsTable.userId, userId), inArray(aiUsageEventsTable.teamId, teamIds)))
          .orderBy(desc(aiUsageEventsTable.createdAt));

  const workspaceUsage = new Map<string, UsageTotals>();
  const teamUsage = new Map<string, UsageTotals>();
  const modelUsage = new Map<string, UsageTotals>();
  let userTotals: UsageTotals = { usedTokens: 0, requestCount: 0 };

  usageRows.forEach((row) => {
    const totalTokens = row.inputTokens + row.outputTokens;
    userTotals = {
      usedTokens: userTotals.usedTokens + totalTokens,
      requestCount: userTotals.requestCount + 1,
    };

    if (row.workspaceId) {
      const current = workspaceUsage.get(row.workspaceId) ?? { usedTokens: 0, requestCount: 0 };
      workspaceUsage.set(row.workspaceId, {
        usedTokens: current.usedTokens + totalTokens,
        requestCount: current.requestCount + 1,
      });
    }

    if (row.teamId) {
      const current = teamUsage.get(row.teamId) ?? { usedTokens: 0, requestCount: 0 };
      teamUsage.set(row.teamId, {
        usedTokens: current.usedTokens + totalTokens,
        requestCount: current.requestCount + 1,
      });
    }

    const modelCurrent = modelUsage.get(row.modelUsed) ?? { usedTokens: 0, requestCount: 0 };
    modelUsage.set(row.modelUsed, {
      usedTokens: modelCurrent.usedTokens + totalTokens,
      requestCount: modelCurrent.requestCount + 1,
    });
  });

  return {
    user: userTotals,
    byWorkspace: Array.from(workspaceUsage.entries()).map(([workspaceId, totals]) => ({
      workspaceId,
      usedTokens: totals.usedTokens,
      requestCount: totals.requestCount,
    })),
    byTeam: Array.from(teamUsage.entries()).map(([teamId, totals]) => ({
      teamId,
      usedTokens: totals.usedTokens,
      requestCount: totals.requestCount,
    })),
    byModel: Array.from(modelUsage.entries()).map(([model, totals]) => ({
      model,
      usedTokens: totals.usedTokens,
      requestCount: totals.requestCount,
    })),
  };
}
