import { SignUp } from '@clerk/nextjs';

/**
 * Sign Up Page
 * 
 * Uses Clerk's pre-built SignUp component.
 * Supports GitHub and Google SSO (when enabled in Clerk dashboard).
 * 
 * After successful sign-up, users are redirected to /editor
 * (configured via NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL)
 */
export default function SignUpPage() {
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
      <SignUp />
    </div>
  );
}

