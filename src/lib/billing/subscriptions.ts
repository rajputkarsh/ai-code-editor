import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { getDb, schema } from '@/lib/db';
import { getPlanFromStripePriceId } from './plans';

function resolveCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const endSeconds = subscription.items.data[0]?.current_period_end ?? null;
  if (!endSeconds) return null;
  return new Date(endSeconds * 1000);
}

function resolvePriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

async function findUserIdForCustomer(
  stripeCustomerId: string,
  customerMetadataUserId: string | null
): Promise<string | null> {
  if (customerMetadataUserId) return customerMetadataUserId;
  const db = getDb();
  if (!db) return null;

  const rows = await db
    .select({ userId: schema.userSubscriptions.userId })
    .from(schema.userSubscriptions)
    .where(eq(schema.userSubscriptions.stripeCustomerId, stripeCustomerId))
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

export async function clearSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string): Promise<void> {
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
    .where(eq(schema.userSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
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

export async function syncSubscriptionFromStripeEvent(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const metadataUserId = subscription.metadata?.userId ?? null;
  const userId = await findUserIdForCustomer(customerId, metadataUserId);
  if (!userId) return;

  const priceId = resolvePriceId(subscription);
  const plan = getPlanFromStripePriceId(priceId);

  await upsertSubscriptionRecord({
    userId,
    plan,
    status: subscription.status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: resolveCurrentPeriodEnd(subscription),
  });
}

export async function linkStripeCustomerToUser(input: {
  userId: string;
  stripeCustomerId: string;
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
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.userSubscriptions.userId,
      set: {
        stripeCustomerId: input.stripeCustomerId,
        updatedAt: now,
      },
    });
}
