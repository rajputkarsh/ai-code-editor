import { createMiddleware } from 'hono/factory';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { auth } from '@clerk/nextjs/server';

/**
 * Extend Hono context to include userId
 */
export type AppVariables = {
    userId: string;
};

export const loggerMiddleware = logger();
export const corsMiddleware = cors();

/**
 * Authentication Middleware for Hono API Routes
 * 
 * This middleware ensures that all API routes are protected.
 * It works in conjunction with the Next.js Clerk middleware.
 * 
 * The Clerk middleware at the Next.js level already protects /api/*,
 * but this provides an additional layer and makes userId available
 * in the Hono context.
 */
export const authMiddleware = createMiddleware(async (c, next) => {
    const { userId } = await auth();
    
    if (!userId) {
        return c.json({ 
            message: 'Unauthorized', 
            ok: false 
        }, 401);
    }
    
    // Store userId in Hono context for use in route handlers
    c.set('userId', userId);
    
    await next();
});

export const errorHandler = (err: Error, c: any) => {
    console.error('Hono Error:', err);
    return c.json({ message: 'Internal Server Error', ok: false }, 500);
};

export const notFoundHandler = (c: any) => {
    return c.json({ message: 'Not Found', ok: false }, 404);
};
