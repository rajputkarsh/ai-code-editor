import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import type { Entitlements, SubscriptionPlan } from './types';
import { buildEntitlements } from './plans';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
]);

function normalizePlan(plan: string | null | undefined): SubscriptionPlan {
  if (plan === 'pro' || plan === 'team') return plan;
  return 'free';
}

export async function getEntitlementsForUser(userId: string): Promise<Entitlements> {
  // Centralizing plan resolution keeps all plan checks deterministic and auditable.
  // API routes and server actions should depend on this service rather than
  // scattering `if (plan === ...)` conditions across product logic.
  const db = getDb();
  if (!db) {
    return buildEntitlements('free');
  }

  const rows = await db
    .select({
      plan: schema.userSubscriptions.plan,
      status: schema.userSubscriptions.status,
    })
    .from(schema.userSubscriptions)
    .where(eq(schema.userSubscriptions.userId, userId))
    .limit(1);

  const record = rows[0];
  if (!record) {
    return buildEntitlements('free');
  }

  const status = record.status?.toLowerCase() ?? 'inactive';
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
    return buildEntitlements('free');
  }

  return buildEntitlements(normalizePlan(record.plan));
}

export async function getSubscriptionSummary(userId: string) {
  const db = getDb();
  if (!db) {
    return {
      plan: 'free' as SubscriptionPlan,
      status: 'inactive',
      stripeCustomerId: null as string | null,
      stripeSubscriptionId: null as string | null,
      currentPeriodEnd: null as Date | null,
    };
  }

  const rows = await db
    .select()
    .from(schema.userSubscriptions)
    .where(eq(schema.userSubscriptions.userId, userId))
    .limit(1);

  const record = rows[0];
  if (!record) {
    return {
      plan: 'free' as SubscriptionPlan,
      status: 'inactive',
      stripeCustomerId: null as string | null,
      stripeSubscriptionId: null as string | null,
      currentPeriodEnd: null as Date | null,
    };
  }

  return {
    plan: normalizePlan(record.plan),
    status: record.status,
    stripeCustomerId: record.stripeCustomerId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    currentPeriodEnd: record.currentPeriodEnd,
  };
}
