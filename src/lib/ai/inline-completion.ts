/**
 * Inline AI Completion Provider
 * 
 * Provides AI-powered inline code completions in Monaco Editor.
 * 
 * Phase 2 Requirements:
 * - Triggered via keyboard shortcut (Cmd/Ctrl + Enter)
 * - Uses Gemini for suggestions
 * - Streamable, cancelable
 * - Never auto-applies (requires explicit accept/reject)
 */

import { ChatMessage } from './types';

/**
 * Generate inline completion prompt from editor context
 */
export function generateInlineCompletionPrompt(
    fileName: string,
    language: string,
    codeBeforeCursor: string,
    codeAfterCursor: string,
    lineNumber: number
): string {
    return `You are an AI coding assistant providing inline code completions.

File: ${fileName}
Language: ${language}
Line: ${lineNumber}

CODE BEFORE CURSOR:
\`\`\`${language}
${codeBeforeCursor}
\`\`\`

CODE AFTER CURSOR:
\`\`\`${language}
${codeAfterCursor}
\`\`\`

INSTRUCTIONS:
1. Provide ONLY the code to insert at the cursor position
2. Do NOT include explanations or markdown formatting
3. Do NOT repeat existing code
4. Ensure the completion is contextually appropriate
5. Keep it concise (1-5 lines typically)
6. Match the existing code style and indentation

COMPLETION:`;
}

/**
 * Parse inline completion response from AI
 * Extracts pure code from AI response, removing markdown or explanations
 */
export function parseInlineCompletion(aiResponse: string): string {
    let completion = aiResponse.trim();
    
    // Remove markdown code blocks if present
    const codeBlockMatch = completion.match(/```[\w]*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
        completion = codeBlockMatch[1].trim();
    }
    
    // Remove "COMPLETION:" prefix if present
    completion = completion.replace(/^COMPLETION:\s*/i, '');
    
    return completion;
}

/**
 * Request payload for inline completion API
 */
export interface InlineCompletionRequest {
    fileName: string;
    language: string;
    codeBeforeCursor: string;
    codeAfterCursor: string;
    lineNumber: number;
}

/**
 * Response from inline completion API
 */
export interface InlineCompletionResponse {
    completion: string;
}

