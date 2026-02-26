import { redirect } from 'next/navigation';
import { currentUser } from '@clerk/nextjs/server';
import { requireUserId } from '@/lib/auth/server';
import { upsertAppUser } from '@/lib/auth/user-store';
import { hasGitHubConnected } from '@/lib/github/clerk-auth';
import { createBillingPortalForUser, createCheckoutSessionForUser } from '@/lib/billing/service';
import { getEntitlementsForUser, getSubscriptionSummary } from '@/lib/entitlements/service';

async function upgradeToProAction() {
  'use server';
  const userId = await requireUserId();
  const url = await createCheckoutSessionForUser(userId);
  redirect(url);
}

async function openBillingPortalAction() {
  'use server';
  const userId = await requireUserId();
  const url = await createBillingPortalForUser(userId);
  redirect(url);
}

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await currentUser();

  await upsertAppUser({
    userId,
    email: user?.emailAddresses[0]?.emailAddress ?? null,
    fullName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
    avatarUrl: user?.imageUrl ?? null,
  });

  const [githubConnected, subscription, entitlements] = await Promise.all([
    hasGitHubConnected(),
    getSubscriptionSummary(userId),
    getEntitlementsForUser(userId),
  ]);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'No name set';
  const email = user?.emailAddresses[0]?.emailAddress ?? 'No email found';

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '48px 20px', display: 'grid', gap: 18 }}>
      <h1 style={{ margin: 0 }}>Settings</h1>

      <section style={{ border: '1px solid #d4d4d8', borderRadius: 10, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Profile</h2>
        <p style={{ margin: '4px 0' }}><strong>Name:</strong> {fullName}</p>
        <p style={{ margin: '4px 0' }}><strong>Email:</strong> {email}</p>
        <p style={{ margin: '4px 0' }}><strong>User ID:</strong> {userId}</p>
      </section>

      <section style={{ border: '1px solid #d4d4d8', borderRadius: 10, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Connected Accounts</h2>
        <p style={{ margin: '4px 0' }}>
          <strong>GitHub:</strong> {githubConnected ? 'Connected' : 'Not connected'}
        </p>
      </section>

      <section style={{ border: '1px solid #d4d4d8', borderRadius: 10, padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Plan & Billing</h2>
        <p style={{ margin: '4px 0' }}><strong>Current plan:</strong> {subscription.plan.toUpperCase()}</p>
        <p style={{ margin: '4px 0' }}><strong>Subscription status:</strong> {subscription.status}</p>
        <p style={{ margin: '4px 0' }}><strong>Agent mode:</strong> {entitlements.canUseAgentMode ? 'Enabled' : 'Disabled'}</p>
        <p style={{ margin: '4px 0' }}><strong>Workspaces:</strong> {entitlements.maxWorkspaces} max</p>
        <p style={{ margin: '4px 0' }}><strong>AI monthly tokens:</strong> {entitlements.maxAiTokensPerMonth.toLocaleString()}</p>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <form action={upgradeToProAction}>
            <button type="submit" style={{ padding: '8px 14px' }}>Upgrade to Pro</button>
          </form>
          <form action={openBillingPortalAction}>
            <button type="submit" style={{ padding: '8px 14px' }}>Open Billing Portal</button>
          </form>
        </div>
      </section>
    </main>
  );
}
