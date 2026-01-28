/**
 * Terminal API Routes (Hono)
 *
 * Provides:
 * - POST /terminal/execute : stream sandboxed command output
 * - POST /terminal/assist  : AI-assisted explanations for logs/errors
 */

import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { getActiveWorkspaceId, loadWorkspace } from '@/lib/workspace/persistence';
import { runSandboxedCommand } from '@/lib/terminal/sandbox';
import type { TerminalAssistKind, TerminalStreamEvent } from '@/lib/terminal/types';
import { getGeminiProvider } from '@/lib/ai/provider/gemini';
import type { ChatMessage } from '@/lib/ai/types';

const terminalApp = new Hono();

const executeSchema = z.object({
    command: z.string().min(1).max(200),
});

const assistSchema = z.object({
    kind: z.enum(['explain', 'summarize', 'fix']),
    output: z.string().min(1).max(20000),
    command: z.string().optional(),
});

const TERMINAL_ASSIST_SYSTEM_PROMPT = `You are an AI coding assistant focused on terminal output analysis.

Rules:
- Read-only assistance only.
- Never run commands or modify files.
- Provide clear, concise explanations and next steps.
- If unsure, state assumptions explicitly.

Response format:
- Summary
- Root cause (if applicable)
- Suggested fixes
- Files likely involved (if any)`;

function buildAssistPrompt(
    kind: TerminalAssistKind,
    output: string,
    command?: string
): string {
    const header =
        kind === 'summarize'
            ? 'Summarize the terminal output.'
            : kind === 'fix'
              ? 'Suggest possible fixes for the failure.'
              : 'Explain why the command failed.';
    return [
        header,
        command ? `Command: ${command}` : 'Command: (not provided)',
        'Terminal output:',
        output,
    ].join('\n');
}

terminalApp.post('/execute', async (c) => {
    try {
        const body = await c.req.json();
        const parseResult = executeSchema.safeParse(body);
        if (!parseResult.success) {
            return c.json(
                { error: 'Invalid request body', details: parseResult.error.flatten() },
                400
            );
        }

        const { command } = parseResult.data;
        const userId = c.get('userId');

        const activeWorkspaceId = await getActiveWorkspaceId(userId);
        if (!activeWorkspaceId) {
            return c.json({ error: 'No active workspace found.' }, 400);
        }

        const workspace = await loadWorkspace(userId, activeWorkspaceId);
        if (!workspace) {
            return c.json({ error: 'Active workspace not found.' }, 404);
        }

        const eventStream = runSandboxedCommand(command, workspace.vfs);

        return stream(c, async (streamWriter) => {
            try {
                for await (const event of eventStream) {
                    await streamWriter.write(`data: ${JSON.stringify(event)}\n\n`);
                }
                await streamWriter.write('data: [DONE]\n\n');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Streaming failed';
                const errorEvent: TerminalStreamEvent = { type: 'error', text: message };
                await streamWriter.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
                await streamWriter.write('data: [DONE]\n\n');
            }
        });
    } catch (error) {
        console.error('Terminal execute error:', error);
        return c.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            500
        );
    }
});

terminalApp.post('/assist', async (c) => {
    try {
        const body = await c.req.json();
        const parseResult = assistSchema.safeParse(body);
        if (!parseResult.success) {
            return c.json(
                { error: 'Invalid request body', details: parseResult.error.flatten() },
                400
            );
        }

        const { kind, output, command } = parseResult.data;
        const provider = getGeminiProvider();

        const messages: ChatMessage[] = [
            { role: 'system', content: TERMINAL_ASSIST_SYSTEM_PROMPT },
            { role: 'user', content: buildAssistPrompt(kind, output, command) },
        ];

        const response = await provider.getChatCompletion(messages);
        return c.json({ response });
    } catch (error) {
        console.error('Terminal assist error:', error);
        return c.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            500
        );
    }
});

export { terminalApp };

