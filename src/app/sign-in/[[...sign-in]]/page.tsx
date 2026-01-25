import { SignIn } from '@clerk/nextjs';

/**
 * Sign In Page
 * 
 * Uses Clerk's pre-built SignIn component.
 * This is the ONLY auth UI component we need for Phase 1.4.
 * 
 * After successful sign-in, users are redirected to /editor
 * (configured via NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL)
 */
export default function SignInPage() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
      }}
    >
      <SignIn />
    </div>
  );
}

