/**
 * Hono API Routes for AI Chat
 * Handles streaming AI chat completions with token limit enforcement
 * 
 * Streaming requires a proper HTTP endpoint, so we use Hono instead of Server Actions
 */

import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { getGeminiProvider } from '@/lib/ai/provider/gemini';
import { ChatMessage } from '@/lib/ai/types';
import { estimateTokenCount, validateConversationTokens } from '@/lib/ai/token-utils';
import { env } from '@/lib/config/env';
import { z } from 'zod';
import { AppVariables } from '../middleware';
import { getUsageGuard, resolveModelForTask } from '@/lib/ai/platform/model-governance';
import { recordAIUsageEvent } from '@/lib/ai/platform/usage-tracker';
import { logAnalyticsEvent } from '@/lib/ai/platform/analytics';

const aiChatApp = new Hono<{ Variables: AppVariables }>();

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
    workspaceId: z.string().uuid().optional(),
    model: z.string().optional(),
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
        const userId = c.get('userId');
        const workspaceId = parseResult.data.workspaceId;

        const tokenValidation = validateConversationTokens(messages as ChatMessage[]);
        if (!tokenValidation.valid) {
            return c.json(
                {
                    error: tokenValidation.error || 'Token limit exceeded',
                    inputTokens: tokenValidation.inputTokens,
                    maxInputTokens: env.AI_MAX_INPUT_TOKENS,
                },
                400
            );
        }

        // Token accounting logic boundary: usage caps are checked before model invocation
        // and request usage is persisted after completion.
        const usageGuard = await getUsageGuard(userId);
        if (!usageGuard.allowed) {
            return c.json(
                {
                    error: usageGuard.message ?? 'AI is unavailable due to usage limits',
                    usage: usageGuard.snapshot,
                },
                429
            );
        }

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
        const model = await resolveModelForTask({
            userId,
            taskType: 'chat',
            workspaceId,
            requestedModel: parseResult.data.model,
        });
        const inputTokens = estimateTokenCount(messages.map((message) => message.content).join('\n'));

        // Stream the response
        return stream(c, async (streamWriter) => {
            let outputText = '';
            try {
                await logAnalyticsEvent({
                    eventType: 'AI_REQUEST',
                    userId,
                    workspaceId,
                    metadata: { taskType: 'chat', mode: 'stream', model },
                });

                for await (const chunk of provider.streamChatCompletion(messages as ChatMessage[], { model })) {
                    // Write chunk as Server-Sent Events format
                    outputText += chunk.text;
                    await streamWriter.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }

                const outputTokens = estimateTokenCount(outputText);
                const updatedSnapshot = await recordAIUsageEvent({
                    userId,
                    workspaceId,
                    taskType: 'chat',
                    modelUsed: model,
                    inputTokens,
                    outputTokens,
                });
                
                if (updatedSnapshot.warningReached) {
                    await streamWriter.write(
                        `data: ${JSON.stringify({
                            warning: `AI usage warning: ${updatedSnapshot.usedTokens}/${updatedSnapshot.hardLimitTokens} tokens`,
                        })}\n\n`
                    );
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
        const userId = c.get('userId');
        const workspaceId = parseResult.data.workspaceId;
        const usageGuard = await getUsageGuard(userId);
        if (!usageGuard.allowed) {
            return c.json(
                {
                    error: usageGuard.message ?? 'AI is unavailable due to usage limits',
                    usage: usageGuard.snapshot,
                },
                429
            );
        }

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

        // Validate token limits (server-side enforcement)
        const tokenValidation = validateConversationTokens(messages as ChatMessage[]);
        if (!tokenValidation.valid) {
            return c.json(
                {
                    error: tokenValidation.error || 'Token limit exceeded',
                    inputTokens: tokenValidation.inputTokens,
                    maxInputTokens: env.AI_MAX_INPUT_TOKENS,
                },
                400
            );
        }

        // Get AI provider
        const provider = getGeminiProvider();
        const model = await resolveModelForTask({
            userId,
            taskType: 'chat',
            workspaceId,
            requestedModel: parseResult.data.model,
        });
        await logAnalyticsEvent({
            eventType: 'AI_REQUEST',
            userId,
            workspaceId,
            metadata: { taskType: 'chat', mode: 'complete', model },
        });

        // Get complete response
        const response = await provider.getChatCompletion(messages as ChatMessage[], { model });
        const inputTokens = estimateTokenCount(messages.map((message) => message.content).join('\n'));
        const outputTokens = estimateTokenCount(response);
        const usage = await recordAIUsageEvent({
            userId,
            workspaceId,
            taskType: 'chat',
            modelUsed: model,
            inputTokens,
            outputTokens,
        });

        return c.json({
            response,
            model,
            usageWarning: usage.warningReached
                ? `AI usage warning: ${usage.usedTokens}/${usage.hardLimitTokens} tokens`
                : null,
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
