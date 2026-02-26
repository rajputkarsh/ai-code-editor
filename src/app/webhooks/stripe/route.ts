import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhook } from '@/lib/billing/service';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('stripe-signature');
    const rawBody = await request.text();
    await handleStripeWebhook(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

