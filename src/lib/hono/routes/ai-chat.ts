/**
 * Hono API Routes for AI Chat
 * Handles streaming AI chat completions
 * 
 * Streaming requires a proper HTTP endpoint, so we use Hono instead of Server Actions
 */

import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { getGeminiProvider } from '@/lib/ai/provider/gemini';
import { ChatMessage } from '@/lib/ai/types';
import { z } from 'zod';

const aiChatApp = new Hono();

/**
 * Request body validation schema
 */
const chatRequestSchema = z.object({
    messages: z.array(
        z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string().min(1),
            contextMetadata: z
                .object({
                    fileName: z.string().optional(),
                    language: z.string().optional(),
                    isSelection: z.boolean().optional(),
                    lineRange: z
                        .object({
                            start: z.number(),
                            end: z.number(),
                        })
                        .optional(),
                })
                .optional(),
        })
    ).min(1),
});

/**
 * POST /api/ai-chat/stream
 * Stream AI chat completion responses
 */
aiChatApp.post('/stream', async (c) => {
    try {
        // Parse and validate request body
        const body = await c.req.json();
        const parseResult = chatRequestSchema.safeParse(body);

        if (!parseResult.success) {
            return c.json(
                {
                    error: 'Invalid request body',
                    details: parseResult.error.flatten(),
                },
                400
            );
        }

        const { messages } = parseResult.data;

        // Validate last message is from user
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') {
            return c.json(
                {
                    error: 'Last message must be from user',
                },
                400
            );
        }

        // Get AI provider
        const provider = getGeminiProvider();

        // Stream the response
        return stream(c, async (streamWriter) => {
            try {
                for await (const chunk of provider.streamChatCompletion(messages as ChatMessage[])) {
                    // Write chunk as Server-Sent Events format
                    await streamWriter.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }
                
                // Send done signal
                await streamWriter.write('data: [DONE]\n\n');
            } catch (error) {
                console.error('Streaming error:', error);
                await streamWriter.write(
                    `data: ${JSON.stringify({
                        error: error instanceof Error ? error.message : 'Streaming failed',
                    })}\n\n`
                );
            }
        });
    } catch (error) {
        console.error('AI chat error:', error);
        return c.json(
            {
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            500
        );
    }
});

/**
 * POST /api/ai-chat/complete
 * Get complete (non-streaming) AI response
 * Used as fallback if streaming fails
 */
aiChatApp.post('/complete', async (c) => {
    try {
        // Parse and validate request body
        const body = await c.req.json();
        const parseResult = chatRequestSchema.safeParse(body);

        if (!parseResult.success) {
            return c.json(
                {
                    error: 'Invalid request body',
                    details: parseResult.error.flatten(),
                },
                400
            );
        }

        const { messages } = parseResult.data;

        // Validate last message is from user
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') {
            return c.json(
                {
                    error: 'Last message must be from user',
                },
                400
            );
        }

        // Get AI provider
        const provider = getGeminiProvider();

        // Get complete response
        const response = await provider.getChatCompletion(messages as ChatMessage[]);

        return c.json({
            response,
        });
    } catch (error) {
        console.error('AI chat error:', error);
        return c.json(
            {
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            500
        );
    }
});

/**
 * GET /api/ai-chat/health
 * Health check endpoint
 */
aiChatApp.get('/health', async (c) => {
    try {
        const provider = getGeminiProvider();
        
        // Simple test to ensure provider is initialized
        // Don't actually call the API to save costs
        return c.json({
            status: 'ok',
            provider: 'gemini',
        });
    } catch (error) {
        console.error('Health check failed:', error);
        return c.json(
            {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        );
    }
});

export { aiChatApp };


