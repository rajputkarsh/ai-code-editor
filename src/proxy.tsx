import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/forgot-password(.*)',
    '/',
])

const isAuthRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)'
])

const isProtectedRoute = createRouteMatcher([
    '/editor(.*)',
])


export default clerkMiddleware(async (auth, req) => {

  console.log('🔒 Middleware check:', {
    path: req.nextUrl.pathname,
    isProtected: isProtectedRoute(req),
    hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    hasSecretKey: !!process.env.CLERK_SECRET_KEY,
  })

    if (isAuthRoute(req)) {
        const { userId } = await auth()
        if (userId) {
            const postAuthUrl = new URL('/editor', req.url)
            return NextResponse.redirect(postAuthUrl)
        }
        return NextResponse.next()
    }

    // Allow public routes
    if (isPublicRoute(req)) {
        return NextResponse.next()
    }

    // Protect all other routes

    if (isProtectedRoute(req)) {
        await auth.protect()
        return NextResponse.next()
    }

    return NextResponse.next()
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
