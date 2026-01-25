/**
 * Core AI types and interfaces for the AI chat system
 * These types are provider-agnostic and can work with any LLM provider
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
    role: MessageRole;
    content: string;
    /**
     * Optional metadata about the context included in the message
     * Used to track what code/file context was sent with the message
     */
    contextMetadata?: {
        fileName?: string;
        language?: string;
        isSelection?: boolean;
        lineRange?: { start: number; end: number };
    };
}

export interface AIStreamChunk {
    text: string;
    isComplete: boolean;
}

/**
 * Provider interface for AI chat functionality
 * All AI providers (Gemini, OpenAI, etc.) should implement this interface
 */
export interface AIProvider {
    /**
     * Stream a chat completion response
     * @param messages - Chat history including the current prompt
     * @returns AsyncIterable of text chunks
     */
    streamChatCompletion(messages: ChatMessage[]): AsyncIterable<AIStreamChunk>;

    /**
     * Get a non-streaming chat completion (for fallback)
     * @param messages - Chat history including the current prompt
     * @returns Complete response text
     */
    getChatCompletion(messages: ChatMessage[]): Promise<string>;
}

/**
 * Configuration for chat context injection
 */
export interface ChatContext {
    fileId: string;
    fileName: string;
    content: string;
    language: string;
    selection?: {
        text: string;
        startLine: number;
        endLine: number;
    };
}


