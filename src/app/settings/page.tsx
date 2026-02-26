import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@clerk/nextjs/server';
import { requireUserId } from '@/lib/auth/server';
import { upsertAppUser } from '@/lib/auth/user-store';
import { hasGitHubConnected } from '@/lib/github/clerk-auth';
import { createBillingPortalForUser, createCheckoutSessionForUser } from '@/lib/billing/service';
import { getEntitlementsForUser, getSubscriptionSummary } from '@/lib/entitlements/service';
import styles from './settings.module.css';

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
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Manage your account, integrations, and billing.</p>
        </div>
        <Link href="/editor" className={styles.backButton}>
          Back to Editor
        </Link>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Profile</h2>
        <p className={styles.row}><strong>Name:</strong> {fullName}</p>
        <p className={styles.row}><strong>Email:</strong> {email}</p>
        <p className={styles.row}><strong>User ID:</strong> {userId}</p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Connected Accounts</h2>
        <p className={styles.row}>
          <strong>GitHub:</strong> {githubConnected ? 'Connected' : 'Not connected'}
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Plan & Billing</h2>
        <p className={styles.row}><strong>Current plan:</strong> {subscription.plan.toUpperCase()}</p>
        <p className={styles.row}><strong>Subscription status:</strong> {subscription.status}</p>
        <p className={styles.row}><strong>Agent mode:</strong> {entitlements.canUseAgentMode ? 'Enabled' : 'Disabled'}</p>
        <p className={styles.row}><strong>Workspaces:</strong> {entitlements.maxWorkspaces} max</p>
        <p className={styles.row}><strong>AI monthly tokens:</strong> {entitlements.maxAiTokensPerMonth.toLocaleString()}</p>

        <div className={styles.actions}>
          <form action={upgradeToProAction}>
            <button type="submit" className={styles.primaryButton}>Upgrade to Pro</button>
          </form>
          <form action={openBillingPortalAction}>
            <button type="submit" className={styles.secondaryButton}>Open Billing Portal</button>
          </form>
        </div>
      </section>
    </main>
  );
}
