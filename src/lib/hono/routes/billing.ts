import { Hono } from 'hono';
import type { Context } from 'hono';
import { createCheckoutSessionForUser, createBillingPortalForUser } from '@/lib/billing/service';
import { getSubscriptionSummary } from '@/lib/entitlements/service';
import { getEntitlementsForUser } from '@/lib/entitlements/service';

function getUserId(c: Context): string {
  const userId = c.get('userId');
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

export const billingApp = new Hono();

billingApp.get('/subscription', async (c) => {
  const userId = getUserId(c);
  const [subscription, entitlements] = await Promise.all([
    getSubscriptionSummary(userId),
    getEntitlementsForUser(userId),
  ]);
  return c.json({ subscription, entitlements });
});

billingApp.post('/checkout', async (c) => {
  try {
    const userId = getUserId(c);
    const checkoutUrl = await createCheckoutSessionForUser(userId);
    return c.json({ checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return c.json({ error: message }, 400);
  }
});

billingApp.post('/portal', async (c) => {
  try {
    const userId = getUserId(c);
    const portalUrl = await createBillingPortalForUser(userId);
    return c.json({ portalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create billing portal session';
    return c.json({ error: message }, 400);
  }
});
