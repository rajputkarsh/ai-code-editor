import { and, desc, eq, gte } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { AI_ANALYTICS_EVENTS, AIAnalyticsEventType } from './types';

const { analyticsEvents: analyticsEventsTable } = schema;

export interface AnalyticsEventInput {
  eventType: AIAnalyticsEventType;
  userId: string;
  workspaceId?: string;
  teamId?: string;
  metadata?: Record<string, unknown>;
}

export function isValidAnalyticsEvent(eventType: string): eventType is AIAnalyticsEventType {
  return (AI_ANALYTICS_EVENTS as readonly string[]).includes(eventType);
}

export async function logAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db.insert(analyticsEventsTable).values({
    eventType: input.eventType,
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    teamId: input.teamId ?? null,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  });
}

export async function listRecentAnalyticsEvents(userId: string, days = 30) {
  const db = getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return db
    .select({
      id: analyticsEventsTable.id,
      eventType: analyticsEventsTable.eventType,
      userId: analyticsEventsTable.userId,
      workspaceId: analyticsEventsTable.workspaceId,
      teamId: analyticsEventsTable.teamId,
      metadata: analyticsEventsTable.metadata,
      createdAt: analyticsEventsTable.createdAt,
    })
    .from(analyticsEventsTable)
    .where(and(eq(analyticsEventsTable.userId, userId), gte(analyticsEventsTable.createdAt, startDate)))
    .orderBy(desc(analyticsEventsTable.createdAt));
}
