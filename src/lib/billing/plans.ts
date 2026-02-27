import { env } from '@/lib/config/env';
import type { SubscriptionPlan } from '@/lib/entitlements/types';

export interface BillingPlan {
  plan: SubscriptionPlan;
  lemonSqueezyVariantId: string;
}

export function getProPlanVariantId(): string {
  if (!env.LEMON_SQUEEZY_PRO_VARIANT_ID) {
    throw new Error('LEMON_SQUEEZY_PRO_VARIANT_ID is missing.');
  }
  return env.LEMON_SQUEEZY_PRO_VARIANT_ID;
}

export function getPlanFromLemonVariantId(variantId: string | null | undefined): SubscriptionPlan {
  if (!variantId) return 'free';
  if (env.LEMON_SQUEEZY_PRO_VARIANT_ID && variantId === env.LEMON_SQUEEZY_PRO_VARIANT_ID) {
    return 'pro';
  }
  if (env.LEMON_SQUEEZY_TEAM_VARIANT_ID && variantId === env.LEMON_SQUEEZY_TEAM_VARIANT_ID) {
    return 'team';
  }
  return 'free';
}
