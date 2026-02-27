import crypto from 'crypto';
import { env } from '@/lib/config/env';

const LEMON_API_BASE = 'https://api.lemonsqueezy.com/v1';

interface LemonData<T> {
  data: T;
}

interface LemonCheckoutResponse {
  attributes?: {
    url?: string | null;
  };
}

interface LemonPortalResponse {
  attributes?: {
    url?: string | null;
  };
}

interface LemonSubscriptionAttributes {
  status?: string | null;
  customer_id?: number | string | null;
  variant_id?: number | string | null;
  renews_at?: string | null;
  ends_at?: string | null;
}

interface LemonSubscriptionWebhookData {
  id?: string | number | null;
  attributes?: LemonSubscriptionAttributes | null;
}

interface LemonWebhookPayload {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: LemonSubscriptionWebhookData;
}

function getApiKey(): string {
  if (!env.LEMON_SQUEEZY_API_KEY) {
    throw new Error('Lemon Squeezy is not configured. LEMON_SQUEEZY_API_KEY is missing.');
  }
  return env.LEMON_SQUEEZY_API_KEY;
}

export function verifyLemonWebhookSignature(rawBody: string, signature: string | null): void {
  if (!env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
    throw new Error('Lemon Squeezy webhook secret is missing.');
  }
  if (!signature) {
    throw new Error('Missing Lemon Squeezy signature header.');
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.LEMON_SQUEEZY_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');

  const actual = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error('Invalid Lemon Squeezy webhook signature.');
  }
}

async function lemonRequest<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const response = await fetch(`${LEMON_API_BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Lemon Squeezy API request failed (${response.status}): ${details}`);
  }

  return (await response.json()) as T;
}

export async function createLemonCheckoutUrl(input: {
  userId: string;
  email?: string | null;
  variantId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  if (!env.LEMON_SQUEEZY_STORE_ID) {
    throw new Error('LEMON_SQUEEZY_STORE_ID is missing.');
  }

  const payload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: input.email ?? undefined,
          custom: {
            userId: input.userId,
          },
        },
        checkout_options: {
          embed: false,
          media: true,
          logo: true,
        },
        product_options: {
          enabled_variants: [Number(input.variantId)],
          redirect_url: input.successUrl,
          receipt_button_text: 'Go back',
          receipt_link_url: input.successUrl,
          receipt_thank_you_note: 'Thanks for subscribing.',
        },
        expires_at: null,
        preview: false,
      },
      relationships: {
        store: {
          data: {
            type: 'stores',
            id: env.LEMON_SQUEEZY_STORE_ID,
          },
        },
        variant: {
          data: {
            type: 'variants',
            id: input.variantId,
          },
        },
      },
    },
    meta: {
      cancel_url: input.cancelUrl,
    },
  };

  const response = await lemonRequest<LemonData<LemonCheckoutResponse>>('/checkouts', 'POST', payload);
  const url = response.data.attributes?.url;
  if (!url) {
    throw new Error('Failed to create Lemon Squeezy checkout URL.');
  }
  return url;
}

export async function createLemonCustomerPortalUrl(customerId: string): Promise<string> {
  const response = await lemonRequest<LemonData<LemonPortalResponse>>(
    `/customers/${customerId}/portal`,
    'POST'
  );
  const url = response.data.attributes?.url;
  if (!url) {
    throw new Error('Failed to create Lemon Squeezy billing portal URL.');
  }
  return url;
}

export function parseLemonWebhookPayload(rawBody: string): LemonWebhookPayload {
  return JSON.parse(rawBody) as LemonWebhookPayload;
}

export function getLemonWebhookEventName(payload: LemonWebhookPayload): string {
  return payload.meta?.event_name ?? '';
}

export function getLemonWebhookUserId(payload: LemonWebhookPayload): string | null {
  const userId = payload.meta?.custom_data?.userId;
  return typeof userId === 'string' ? userId : null;
}

export function getLemonWebhookSubscriptionId(payload: LemonWebhookPayload): string | null {
  const id = payload.data?.id;
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);
  return null;
}

export function getLemonWebhookCustomerId(payload: LemonWebhookPayload): string | null {
  const id = payload.data?.attributes?.customer_id;
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);
  return null;
}

export function getLemonWebhookVariantId(payload: LemonWebhookPayload): string | null {
  const id = payload.data?.attributes?.variant_id;
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);
  return null;
}

export function getLemonWebhookStatus(payload: LemonWebhookPayload): string {
  return payload.data?.attributes?.status ?? 'inactive';
}

export function getLemonWebhookCurrentPeriodEnd(payload: LemonWebhookPayload): Date | null {
  const renewsAt = payload.data?.attributes?.renews_at;
  if (renewsAt) return new Date(renewsAt);

  const endsAt = payload.data?.attributes?.ends_at;
  if (endsAt) return new Date(endsAt);

  return null;
}
