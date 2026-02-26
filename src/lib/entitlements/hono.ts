import { createMiddleware } from 'hono/factory';
import type { Entitlements } from './types';
import { getEntitlementsForUser } from './service';

export type EntitlementKey = keyof Omit<Entitlements, 'plan'>;

export async function loadEntitlementsForRequest(userId: string): Promise<Entitlements> {
  return getEntitlementsForUser(userId);
}

export function requireEntitlement(
  key: EntitlementKey,
  errorMessage: string
) {
  return createMiddleware(async (c, next) => {
    const userId = c.get('userId') as string | undefined;
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const entitlements = await loadEntitlementsForRequest(userId);
    const allowed = entitlements[key];
    const isAllowed = typeof allowed === 'boolean' ? allowed : Boolean(allowed);

    if (!isAllowed) {
      return c.json(
        {
          error: errorMessage,
          feature: key,
          plan: entitlements.plan,
        },
        403
      );
    }

    await next();
  });
}

