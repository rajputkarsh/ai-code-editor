import { env } from '@/lib/config/env';
import type { SubscriptionPlan } from '@/lib/entitlements/types';

export interface BillingPlan {
  plan: SubscriptionPlan;
  stripePriceId: string;
}

export function getProPlanPriceId(): string {
  if (!env.STRIPE_PRO_MONTHLY_PRICE_ID) {
    throw new Error('STRIPE_PRO_MONTHLY_PRICE_ID is missing.');
  }
  return env.STRIPE_PRO_MONTHLY_PRICE_ID;
}

export function getPlanFromStripePriceId(priceId: string | null | undefined): SubscriptionPlan {
  if (!priceId) return 'free';
  if (env.STRIPE_PRO_MONTHLY_PRICE_ID && priceId === env.STRIPE_PRO_MONTHLY_PRICE_ID) {
    return 'pro';
  }
  if (env.STRIPE_TEAM_MONTHLY_PRICE_ID && priceId === env.STRIPE_TEAM_MONTHLY_PRICE_ID) {
    return 'team';
  }
  return 'free';
}

