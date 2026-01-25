import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import styles from "./page.module.css";

/**
 * Homepage (Public)
 * 
 * This is the only public-facing page. It provides:
 * - Sign in for existing users
 * - Sign up for new users
 * - Direct link to editor for authenticated users
 * 
 * Note: This component can access auth() because it's a Server Component.
 * Client components (like editor components) should NOT import Clerk.
 */
export default async function Home() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>AI-Powered Code Editor</h1>
          <p>
            A browser-based code editor with intelligent AI assistance.
            Write, refactor, and debug code faster with AI agents.
          </p>
        </div>
        <div className={styles.ctas}>
          {isSignedIn ? (
            <>
              <Link href="/editor" className={styles.primary}>
                Open Editor
              </Link>
              <Link href="/sign-in" className={styles.secondary}>
                Sign Out
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-in" className={styles.primary}>
                Sign In
              </Link>
              <Link href="/sign-up" className={styles.secondary}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
