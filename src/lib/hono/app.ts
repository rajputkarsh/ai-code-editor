import { Hono } from 'hono';
import { loggerMiddleware, corsMiddleware, notFoundHandler, errorHandler } from './middleware';

// Initialize Hono app
export const app = new Hono().basePath('/api');

// Global middleware
app.use('*', loggerMiddleware);
app.use('*', corsMiddleware);

// Error handling
app.notFound(notFoundHandler);
app.onError(errorHandler);

// Register routes
import health from './routes/health';
import { aiChatApp } from './routes/ai-chat';

app.route('/health', health);
app.route('/ai-chat', aiChatApp);
