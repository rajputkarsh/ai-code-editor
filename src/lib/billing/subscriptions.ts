import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { getPlanFromLemonVariantId } from './plans';

async function findUserIdForCustomer(
  customerId: string,
  customerMetadataUserId: string | null
): Promise<string | null> {
  if (customerMetadataUserId) return customerMetadataUserId;
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select({ userId: schema.userSubscriptions.userId })
    .from(schema.userSubscriptions)
    .where(eq(schema.userSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  return rows[0]?.userId ?? null;
}

export async function upsertSubscriptionRecord(input: {
  userId: string;
  plan: 'free' | 'pro' | 'team';
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
}): Promise<void> {
  const db = getDb();
  if (!db) return;

  const now = new Date();

  await db
    .insert(schema.userSubscriptions)
    .values({
      userId: input.userId,
      plan: input.plan,
      status: input.status,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.userSubscriptions.userId,
      set: {
        plan: input.plan,
        status: input.status,
        stripeCustomerId: input.stripeCustomerId ?? null,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        updatedAt: now,
      },
    });
}

export async function clearSubscriptionByExternalSubscriptionId(subscriptionId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .update(schema.userSubscriptions)
    .set({
      plan: 'free',
      status: 'canceled',
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.userSubscriptions.stripeSubscriptionId, subscriptionId));
}

export async function getSubscriptionByUserId(userId: string) {
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(schema.userSubscriptions)
    .where(eq(schema.userSubscriptions.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function syncSubscriptionFromLemonEvent(input: {
  customerId: string;
  subscriptionId: string;
  variantId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  metadataUserId?: string | null;
}): Promise<void> {
  const userId = await findUserIdForCustomer(input.customerId, input.metadataUserId ?? null);
  if (!userId) return;

  const plan = getPlanFromLemonVariantId(input.variantId);

  await upsertSubscriptionRecord({
    userId,
    plan,
    status: input.status,
    stripeCustomerId: input.customerId,
    stripeSubscriptionId: input.subscriptionId,
    currentPeriodEnd: input.currentPeriodEnd,
  });
}

export async function linkCustomerToUser(input: {
  userId: string;
  customerId: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;

  const now = new Date();
  await db
    .insert(schema.userSubscriptions)
    .values({
      userId: input.userId,
      plan: 'free',
      status: 'inactive',
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.userSubscriptions.userId,
      set: {
        stripeCustomerId: input.customerId,
        updatedAt: now,
      },
    });
}
