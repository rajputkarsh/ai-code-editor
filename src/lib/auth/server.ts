import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Server-side Auth Utilities
 * 
 * These utilities provide a centralized way to access authentication
 * data on the server side (Server Actions, API Routes, Middleware).
 * 
 * IMPORTANT: These should NEVER be imported in client components.
 * Editor components should remain auth-agnostic.
 */

/**
 * Get the current authenticated user's ID
 * 
 * @returns userId or null if not authenticated
 * 
 * Usage in Server Actions:
 * ```ts
 * 'use server';
 * import { getCurrentUserId } from '@/lib/auth/server';
 * 
 * export async function myAction() {
 *   const userId = await getCurrentUserId();
 *   if (!userId) throw new Error('Unauthorized');
 *   // ... rest of logic
 * }
 * ```
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Get the current authenticated user's ID (throws if not authenticated)
 * 
 * @throws Error if user is not authenticated
 * @returns userId
 * 
 * Use this when you want to enforce authentication and fail fast.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('Authentication required');
  }
  return userId;
}

/**
 * Get the current user's full profile from Clerk
 * 
 * @returns User object or null if not authenticated
 * 
 * NOTE: This makes an additional API call to Clerk.
 * Only use when you need full user metadata (email, name, etc.)
 * For most cases, getCurrentUserId() is sufficient.
 */
export async function getCurrentUser() {
  return await currentUser();
}

/**
 * Check if the current request is from an authenticated user
 * 
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const userId = await getCurrentUserId();
  return userId !== null;
}

