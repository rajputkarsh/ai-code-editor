/**
 * Token Counting and Limit Utilities
 * 
 * Provides token estimation and validation for AI chat requests.
 * Uses approximation based on character and word counts.
 * 
 * Note: For production, consider using the actual tokenizer from the LLM provider.
 * This approximation is sufficient for basic cost control and abuse prevention.
 */

import { ChatMessage } from './types';

/**
 * Token limit configuration
 * These limits prevent runaway costs and abuse
 */
export const TOKEN_LIMITS = {
    // Maximum tokens per single request (input + output combined)
    MAX_TOKENS_PER_REQUEST: 10000,
    
    // Maximum input tokens (user messages + context)
    MAX_INPUT_TOKENS: 8000,
    
    // Maximum tokens per session (cumulative across all requests)
    // This would typically be tracked server-side per user/session
    MAX_TOKENS_PER_SESSION: 50000,
} as const;

/**
 * Estimate token count for a string
 * 
 * Uses a simple heuristic:
 * - 1 token ≈ 4 characters for English text
 * - Code typically has a similar ratio
 * 
 * This is a rough approximation. Actual token counts may vary by ±20%
 * 
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
    if (!text || text.length === 0) {
        return 0;
    }

    // Character-based estimation: ~4 characters per token
    const charBasedEstimate = Math.ceil(text.length / 4);
    
    // Word-based estimation: ~1.3 tokens per word (accounts for punctuation)
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordBasedEstimate = Math.ceil(words.length * 1.3);
    
    // Use the higher estimate to be conservative (safer for cost control)
    return Math.max(charBasedEstimate, wordBasedEstimate);
}

/**
 * Calculate total token count for a conversation
 * 
 * Includes all messages and their metadata
 * 
 * @param messages - Array of chat messages
 * @returns Total estimated token count
 */
export function calculateConversationTokens(messages: ChatMessage[]): number {
    return messages.reduce((total, message) => {
        return total + estimateTokenCount(message.content);
    }, 0);
}

/**
 * Validate token count against limits
 * 
 * @param tokenCount - The token count to validate
 * @param limit - The limit to check against
 * @returns Validation result with error message if invalid
 */
export function validateTokenCount(
    tokenCount: number, 
    limit: number
): { valid: boolean; error?: string } {
    if (tokenCount > limit) {
        return {
            valid: false,
            error: `Token limit exceeded. Request uses ${tokenCount} tokens but limit is ${limit} tokens.`,
        };
    }
    
    return { valid: true };
}

/**
 * Validate a conversation against token limits
 * 
 * Checks both per-request and input limits
 * 
 * @param messages - The conversation messages to validate
 * @returns Validation result with details
 */
export function validateConversationTokens(messages: ChatMessage[]): {
    valid: boolean;
    inputTokens: number;
    error?: string;
} {
    const inputTokens = calculateConversationTokens(messages);
    
    // Check input token limit
    const inputValidation = validateTokenCount(
        inputTokens, 
        TOKEN_LIMITS.MAX_INPUT_TOKENS
    );
    
    if (!inputValidation.valid) {
        return {
            valid: false,
            inputTokens,
            error: inputValidation.error,
        };
    }
    
    // Additional check: warn if we're approaching the per-request limit
    // (accounting for potential output tokens)
    const estimatedTotalTokens = inputTokens + 2000; // Assume max 2000 output tokens
    
    if (estimatedTotalTokens > TOKEN_LIMITS.MAX_TOKENS_PER_REQUEST) {
        return {
            valid: false,
            inputTokens,
            error: `Conversation is too long. Estimated total tokens (${estimatedTotalTokens}) would exceed per-request limit (${TOKEN_LIMITS.MAX_TOKENS_PER_REQUEST}). Consider starting a new conversation.`,
        };
    }
    
    return {
        valid: true,
        inputTokens,
    };
}

/**
 * Truncate messages to fit within token limit
 * 
 * Keeps the most recent messages and removes older ones
 * Always preserves the system prompt if present
 * 
 * @param messages - Messages to truncate
 * @param maxTokens - Maximum token limit
 * @returns Truncated messages array
 */
export function truncateMessagesToLimit(
    messages: ChatMessage[], 
    maxTokens: number
): ChatMessage[] {
    if (messages.length === 0) {
        return [];
    }
    
    // Always keep the first message if it's a system message
    const hasSystemMessage = messages[0]?.role === 'system';
    const systemMessage = hasSystemMessage ? [messages[0]] : [];
    const conversationMessages = hasSystemMessage ? messages.slice(1) : messages;
    
    // Calculate system message tokens
    const systemTokens = hasSystemMessage ? estimateTokenCount(messages[0].content) : 0;
    const availableTokens = maxTokens - systemTokens;
    
    // Add messages from most recent, going backwards
    const truncated: ChatMessage[] = [];
    let currentTokens = 0;
    
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
        const message = conversationMessages[i];
        const messageTokens = estimateTokenCount(message.content);
        
        if (currentTokens + messageTokens <= availableTokens) {
            truncated.unshift(message);
            currentTokens += messageTokens;
        } else {
            break;
        }
    }
    
    return [...systemMessage, ...truncated];
}




