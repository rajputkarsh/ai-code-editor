/**
 * Inline AI Completion API Routes
 * 
 * Provides endpoints for:
 * - Inline code completions
 * - AI code actions (refactor, convert, comment, optimize)
 * - Code explanations
 * 
 * All routes require authentication and never auto-modify code.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { streamSSE } from 'hono/streaming';
import { getGeminiProvider } from '@/lib/ai/provider/gemini';
import { generateInlineCompletionPrompt, parseInlineCompletion } from '@/lib/ai/inline-completion';
import { AppVariables } from '../middleware';

export const inlineAIApp = new Hono<{ Variables: AppVariables }>();

/**
 * POST /inline-completion
 * 
 * Generate inline code completion suggestion
 */
inlineAIApp.post(
    '/inline-completion',
    zValidator(
        'json',
        z.object({
            fileName: z.string(),
            language: z.string(),
            codeBeforeCursor: z.string(),
            codeAfterCursor: z.string(),
            lineNumber: z.number(),
        })
    ),
    async (c) => {
        const { fileName, language, codeBeforeCursor, codeAfterCursor, lineNumber } = c.req.valid('json');
        const userId = c.get('userId'); // From auth middleware

        try {
            const prompt = generateInlineCompletionPrompt(
                fileName,
                language,
                codeBeforeCursor,
                codeAfterCursor,
                lineNumber
            );

            const gemini = getGeminiProvider();
            const response = await gemini.getChatCompletion([
                {
                    role: 'user',
                    content: prompt,
                },
            ]);

            const completion = parseInlineCompletion(response);

            return c.json({ completion });

        } catch (error) {
            console.error('Inline completion error:', error);
            return c.json(
                { error: 'Failed to generate completion' },
                500
            );
        }
    }
);

/**
 * POST /code-action
 * 
 * Perform AI code action (refactor, convert, comment, optimize)
 * Returns the modified code for preview (never auto-applies)
 */
inlineAIApp.post(
    '/code-action',
    zValidator(
        'json',
        z.object({
            action: z.enum(['refactor', 'convert-to-typescript', 'add-comments', 'optimize']),
            fileName: z.string(),
            language: z.string(),
            code: z.string(),
            selectedCode: z.string().optional(),
        })
    ),
    async (c) => {
        const { action, fileName, language, code, selectedCode } = c.req.valid('json');
        const userId = c.get('userId');

        try {
            const actionPrompts: Record<string, string> = {
                'refactor': 'Refactor the following code to improve readability and maintainability. Keep the same functionality.',
                'convert-to-typescript': 'Convert the following code to TypeScript with proper type annotations.',
                'add-comments': 'Add clear, helpful comments to the following code explaining what each section does.',
                'optimize': 'Optimize the following code for better performance while maintaining the same functionality.',
            };

            const targetCode = selectedCode || code;
            const prompt = `${actionPrompts[action]}

File: ${fileName}
Language: ${language}

CODE:
\`\`\`${language}
${targetCode}
\`\`\`

INSTRUCTIONS:
1. Return ONLY the modified code
2. Do NOT include explanations before or after the code
3. Maintain the same indentation and code style
4. If modifying a selection, return only the modified selection (not the entire file)

MODIFIED CODE:`;

            const gemini = getGeminiProvider();
            const response = await gemini.getChatCompletion([
                {
                    role: 'user',
                    content: prompt,
                },
            ]);

            // Extract code from response
            let modifiedCode = response.trim();
            const codeBlockMatch = modifiedCode.match(/```[\w]*\n?([\s\S]*?)```/);
            if (codeBlockMatch) {
                modifiedCode = codeBlockMatch[1].trim();
            }
            modifiedCode = modifiedCode.replace(/^MODIFIED CODE:\s*/i, '');

            return c.json({
                originalCode: targetCode,
                modifiedCode,
                action,
            });

        } catch (error) {
            console.error('Code action error:', error);
            return c.json(
                { error: 'Failed to perform code action' },
                500
            );
        }
    }
);

/**
 * POST /explain
 * 
 * Generate code explanation (read-only, non-destructive)
 */
inlineAIApp.post(
    '/explain',
    zValidator(
        'json',
        z.object({
            fileName: z.string(),
            language: z.string(),
            code: z.string(),
            scope: z.enum(['file', 'function', 'selection']),
        })
    ),
    async (c) => {
        const { fileName, language, code, scope } = c.req.valid('json');
        const userId = c.get('userId');

        try {
            const scopePrompts: Record<string, string> = {
                'file': 'Provide a comprehensive explanation of what this file does, its purpose, and its main components.',
                'function': 'Explain this function step-by-step: what it does, how it works, and any important details.',
                'selection': 'Explain this code section: what it does and how it works.',
            };

            const prompt = `${scopePrompts[scope]}

File: ${fileName}
Language: ${language}

CODE:
\`\`\`${language}
${code}
\`\`\`

INSTRUCTIONS:
1. Provide a clear, structured explanation
2. Break down complex logic into understandable steps
3. Highlight any potential issues or improvements
4. Use markdown formatting for readability

EXPLANATION:`;

            const gemini = getGeminiProvider();
            const response = await gemini.getChatCompletion([
                {
                    role: 'user',
                    content: prompt,
                },
            ]);

            return c.json({ explanation: response });

        } catch (error) {
            console.error('Explain error:', error);
            return c.json(
                { error: 'Failed to generate explanation' },
                500
            );
        }
    }
);

