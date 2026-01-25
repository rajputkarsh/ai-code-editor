import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Route Protection Middleware (Clerk)
 * 
 * Protected Routes:
 * - /editor (and all subroutes)
 * - /api/* (all API routes)
 * 
 * Public Routes:
 * - / (homepage)
 * - /sign-in
 * - /sign-up
 * 
 * This middleware enforces authentication boundaries without polluting editor logic.
 */

// Define which routes require authentication
const isProtectedRoute = createRouteMatcher([
  '/editor(.*)',
  '/api/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
