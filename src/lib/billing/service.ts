import { currentUser } from '@clerk/nextjs/server';
import { getProPlanVariantId } from './plans';
import {
  clearSubscriptionByExternalSubscriptionId,
  getSubscriptionByUserId,
  linkCustomerToUser,
  syncSubscriptionFromLemonEvent,
} from './subscriptions';
import { upsertAppUser } from '@/lib/auth/user-store';
import { env } from '@/lib/config/env';
import {
  createLemonCheckoutUrl,
  createLemonCustomerPortalUrl,
  getLemonWebhookCurrentPeriodEnd,
  getLemonWebhookCustomerId,
  getLemonWebhookEventName,
  getLemonWebhookStatus,
  getLemonWebhookSubscriptionId,
  getLemonWebhookUserId,
  getLemonWebhookVariantId,
  parseLemonWebhookPayload,
  verifyLemonWebhookSignature,
} from './lemon-squeezy';

function getBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL;
}

export async function createCheckoutSessionForUser(userId: string): Promise<string> {
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? null;
  const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || null;
  const avatarUrl = clerkUser?.imageUrl ?? null;

  await upsertAppUser({
    userId,
    email,
    fullName,
    avatarUrl,
  });

  const baseUrl = getBaseUrl();
  return createLemonCheckoutUrl({
    userId,
    email,
    variantId: getProPlanVariantId(),
    successUrl: `${baseUrl}/settings?billing=success`,
    cancelUrl: `${baseUrl}/settings?billing=cancelled`,
  });
}

export async function createBillingPortalForUser(userId: string): Promise<string> {
  const subscription = await getSubscriptionByUserId(userId);
  const customerId = subscription?.stripeCustomerId;
  if (!customerId) {
    throw new Error('No billing customer found for this account.');
  }

  return createLemonCustomerPortalUrl(customerId);
}

export async function handleLemonWebhook(rawBody: string, signature: string | null): Promise<void> {
  verifyLemonWebhookSignature(rawBody, signature);

  const payload = parseLemonWebhookPayload(rawBody);
  const eventName = getLemonWebhookEventName(payload);

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_resumed':
    case 'subscription_unpaused': {
      const customerId = getLemonWebhookCustomerId(payload);
      const subscriptionId = getLemonWebhookSubscriptionId(payload);
      if (!customerId || !subscriptionId) return;

      const metadataUserId = getLemonWebhookUserId(payload);
      if (metadataUserId) {
        await linkCustomerToUser({
          userId: metadataUserId,
          customerId,
        });
      }

      await syncSubscriptionFromLemonEvent({
        customerId,
        subscriptionId,
        variantId: getLemonWebhookVariantId(payload),
        status: getLemonWebhookStatus(payload),
        currentPeriodEnd: getLemonWebhookCurrentPeriodEnd(payload),
        metadataUserId,
      });
      break;
    }
    case 'subscription_cancelled':
    case 'subscription_expired': {
      const subscriptionId = getLemonWebhookSubscriptionId(payload);
      if (!subscriptionId) return;
      await clearSubscriptionByExternalSubscriptionId(subscriptionId);
      break;
    }
    default:
      break;
  }
}
