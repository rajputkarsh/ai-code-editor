import { createMiddleware } from 'hono/factory';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

export const loggerMiddleware = logger();
export const corsMiddleware = cors();

export const errorHandler = (err: Error, c: any) => {
    console.error('Hono Error:', err);
    return c.json({ message: 'Internal Server Error', ok: false }, 500);
};

export const notFoundHandler = (c: any) => {
    return c.json({ message: 'Not Found', ok: false }, 404);
};
