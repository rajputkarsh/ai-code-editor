import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getStripe } from './stripe';
import { getProPlanPriceId } from './plans';
import {
  clearSubscriptionByStripeSubscriptionId,
  getSubscriptionByUserId,
  linkStripeCustomerToUser,
  syncSubscriptionFromStripeEvent,
} from './subscriptions';
import { upsertAppUser } from '@/lib/auth/user-store';
import { env } from '@/lib/config/env';
import { Currency } from 'lucide-react';

// Billing is isolated in this module so Stripe concerns never leak into editor,
// AI generation, or agent execution logic.

function getBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL;
}

async function ensureStripeCustomer(userId: string): Promise<string> {
  const existing = await getSubscriptionByUserId(userId);
  if (existing?.stripeCustomerId) {
    return existing.stripeCustomerId;
  }

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

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: fullName ?? undefined,
    metadata: {
      userId,
    },
  });

  await linkStripeCustomerToUser({
    userId,
    stripeCustomerId: customer.id,
  });

  return customer.id;
}

export async function createCheckoutSessionForUser(userId: string): Promise<string> {
  const customerId = await ensureStripeCustomer(userId);
  const stripe = getStripe();
  const baseUrl = getBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: getProPlanPriceId(),
        quantity: 1,
      },
    ],
    currency: 'inr',
    success_url: `${baseUrl}/settings?billing=success`,
    cancel_url: `${baseUrl}/settings?billing=cancelled`,
    metadata: {
      userId,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL.');
  }

  return session.url;
}

export async function createBillingPortalForUser(userId: string): Promise<string> {
  const customerId = await ensureStripeCustomer(userId);
  const stripe = getStripe();
  const baseUrl = getBaseUrl();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/settings`,
  });

  return session.url;
}

export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<void> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret is missing.');
  }
  if (!signature) {
    throw new Error('Missing Stripe signature header.');
  }

  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await syncSubscriptionFromStripeEvent(event.data.object as Stripe.Subscription);
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await clearSubscriptionByStripeSubscriptionId(subscription.id);
      break;
    }
    default:
      break;
  }
}

