import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { marketingContent } from '@/lib/marketing/content';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'AI Code Editor | AI-Native Coding Workspace',
  description:
    'A browser-based AI code editor with agent workflows and GitHub integration.',
};

export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = Boolean(userId);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>AI Code Editor</p>
          <h1>{marketingContent.hero.title}</h1>
          <p>{marketingContent.hero.description}</p>
          <div className={styles.ctas}>
            <Link href={isSignedIn ? '/editor' : '/sign-in'} className={styles.primary}>
              {isSignedIn ? 'Go to Editor' : 'Sign Up for Free'}
            </Link>
            <Link href="/editor" className={styles.secondary}>
              Start Coding
            </Link>
          </div>
        </section>

        <section className={styles.features}>
          <h2>Core capabilities</h2>
          <div className={styles.grid}>
            {marketingContent.highlights.map((item) => (
              <article key={item.title} className={styles.card}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.pricing}>
          <h2>Pricing preview</h2>
          <div className={styles.grid}>
            {marketingContent.pricing.map((tier) => (
              <article key={tier.plan} className={styles.card}>
                <h3>{tier.plan}</h3>
                <p className={styles.price}>{tier.price}</p>
                <p>{tier.teaser}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

