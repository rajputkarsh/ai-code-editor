import { NextRequest, NextResponse } from 'next/server';
import { handleLemonWebhook } from '@/lib/billing/service';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-signature');
    const rawBody = await request.text();
    await handleLemonWebhook(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
