import { and, eq, isNull } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { AITaskType, MODEL_IDS, ModelId, ModelPreference, UsageSnapshot } from './types';
import { evaluateUsageLimit } from './usage-tracker';

const { aiModelPreferences: aiModelPreferencesTable } = schema;

const DEFAULT_MODEL: ModelId = 'gemini-2.5-flash';

export function isValidModel(model: string): model is ModelId {
  return (MODEL_IDS as readonly string[]).includes(model);
}

export async function saveModelPreference(preference: ModelPreference): Promise<void> {
  const db = getDb();
  if (!db) {
    throw new Error('Database not configured');
  }
  if (!isValidModel(preference.model)) {
    throw new Error('Unsupported model');
  }

  await db
    .insert(aiModelPreferencesTable)
    .values({
      userId: preference.userId,
      workspaceId: preference.workspaceId ?? null,
      taskType: preference.taskType,
      model: preference.model,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        aiModelPreferencesTable.userId,
        aiModelPreferencesTable.workspaceId,
        aiModelPreferencesTable.taskType,
      ],
      set: {
        model: preference.model,
        updatedAt: new Date(),
      },
    });
}

export async function resolveModelForTask(input: {
  userId: string;
  taskType: AITaskType;
  workspaceId?: string;
  requestedModel?: string;
}): Promise<ModelId> {
  if (input.requestedModel) {
    if (!isValidModel(input.requestedModel)) {
      throw new Error('Requested model is not allowed');
    }
    return input.requestedModel;
  }

  const db = getDb();
  if (!db) return DEFAULT_MODEL;

  if (input.workspaceId) {
    const scoped = await db
      .select({ model: aiModelPreferencesTable.model })
      .from(aiModelPreferencesTable)
      .where(
        and(
          eq(aiModelPreferencesTable.userId, input.userId),
          eq(aiModelPreferencesTable.workspaceId, input.workspaceId),
          eq(aiModelPreferencesTable.taskType, input.taskType)
        )
      )
      .limit(1);

    if (scoped[0]?.model && isValidModel(scoped[0].model)) {
      return scoped[0].model;
    }
  }

  const userDefault = await db
    .select({ model: aiModelPreferencesTable.model })
    .from(aiModelPreferencesTable)
    .where(
      and(
        eq(aiModelPreferencesTable.userId, input.userId),
        isNull(aiModelPreferencesTable.workspaceId),
        eq(aiModelPreferencesTable.taskType, input.taskType)
      )
    )
    .limit(1);

  if (userDefault[0]?.model && isValidModel(userDefault[0].model)) {
    return userDefault[0].model;
  }
  return DEFAULT_MODEL;
}

export async function getUsageGuard(userId: string): Promise<{
  snapshot: UsageSnapshot;
  allowed: boolean;
  message?: string;
}> {
  const snapshot = await evaluateUsageLimit(userId);
  if (snapshot.aiDisabled) {
    return {
      snapshot,
      allowed: false,
      message: 'AI features are disabled for this billing period.',
    };
  }
  if (snapshot.hardLimitReached) {
    return {
      snapshot,
      allowed: false,
      message: 'Hard AI usage limit reached for this billing period.',
    };
  }
  if (snapshot.warningReached) {
    return {
      snapshot,
      allowed: true,
      message: `Warning: ${snapshot.usedTokens}/${snapshot.hardLimitTokens} tokens consumed.`,
    };
  }
  return { snapshot, allowed: true };
}
