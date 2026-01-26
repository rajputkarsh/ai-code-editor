import { Hono } from 'hono';
import { loggerMiddleware, corsMiddleware, authMiddleware, notFoundHandler, errorHandler, AppVariables } from './middleware';

// Initialize Hono app with type-safe context
export const app = new Hono<{ Variables: AppVariables }>().basePath('/api');

// Global middleware
app.use('*', loggerMiddleware);
app.use('*', corsMiddleware);

/**
 * Authentication Middleware
 * 
 * All API routes require authentication (Phase 1.4).
 * This middleware ensures userId is available in all route handlers.
 * 
 * Future: When webhooks are added, we'll need to exclude them from auth.
 */
app.use('*', authMiddleware);

// Error handling
app.notFound(notFoundHandler);
app.onError(errorHandler);

// Register routes
import health from './routes/health';
import { aiChatApp } from './routes/ai-chat';
import { workspaceApp } from './routes/workspace';
import { inlineAIApp } from './routes/inline-ai';
import { githubApp } from './routes/github';

app.route('/health', health);
app.route('/ai-chat', aiChatApp);
app.route('/workspace', workspaceApp);
app.route('/inline-ai', inlineAIApp);
app.route('/github', githubApp);
