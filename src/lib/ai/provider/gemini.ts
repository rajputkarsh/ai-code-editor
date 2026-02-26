/**
 * Google Gemini AI Provider
 * Implements the AIProvider interface using Google's Generative AI SDK
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { env } from '@/lib/config/env';
import { AIProvider, AIStreamChunk, ChatMessage } from '../types';

/**
 * Gemini-specific configuration
 */
const GEMINI_CONFIG = {
    model: 'gemini-2.5-flash', // Gemini 2.5 Flash - Fast and versatile model (June 2025)
    generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
    },
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
    ],
};

/**
 * System prompt that defines the AI assistant's behavior and constraints
 * This is critical for ensuring the AI provides helpful, non-destructive responses
 */
const SYSTEM_PROMPT = `You are an expert AI coding assistant embedded in a web-based code editor.

Your role is to help developers understand, analyze, and improve their code through conversation.

CRITICAL RULES:
1. You provide explanations, suggestions, and analysis ONLY
2. You do NOT modify code automatically - users will apply changes manually
3. When suggesting code improvements, provide clear explanations of WHY the change is beneficial
4. Be concise but thorough - developers value their time
5. Use markdown for code blocks with appropriate language tags
6. If you see potential bugs or issues, explain the root cause clearly
7. When explaining code, break down complex logic into understandable steps

RESPONSE FORMAT:
- Use clear headings to organize your response
- Highlight key insights or issues
- Provide code examples when suggesting improvements
- Always explain the reasoning behind your suggestions

Remember: You are a helpful collaborator, not an autonomous code modifier.`;

/**
 * Convert our generic ChatMessage format to Gemini's expected format
 */
function convertToGeminiFormat(messages: ChatMessage[], systemPrompt: string) {
    // Gemini doesn't have a separate system role, so we inject system prompt as first user message
    const geminiMessages = messages.map((msg) => {
        // Gemini uses 'user' and 'model' roles
        const role = msg.role === 'assistant' ? 'model' : 'user';
        return {
            role,
            parts: [{ text: msg.content }],
        };
    });

    // Prepend system prompt as first user message if not already present
    const firstMessage = geminiMessages[0];
    if (!firstMessage || !firstMessage.parts[0].text.includes('AI coding assistant')) {
        geminiMessages.unshift({
            role: 'user',
            parts: [{ text: systemPrompt }],
        });
        geminiMessages.splice(1, 0, {
            role: 'model',
            parts: [{ text: 'I understand. I will provide helpful code analysis and suggestions without automatically modifying any code. How can I help you today?' }],
        });
    }

    return geminiMessages;
}

/**
 * Gemini Provider Implementation
 */
export class GeminiProvider implements AIProvider {
    private genAI: GoogleGenerativeAI;

    constructor(apiKey?: string) {
        const key = apiKey || env.GEMINI_API_KEY;
        if (!key) {
            throw new Error('Gemini API key is required. Please set GEMINI_API_KEY environment variable.');
        }
        this.genAI = new GoogleGenerativeAI(key);
    }

    /**
     * Stream chat completion from Gemini
     * Yields text chunks as they arrive from the API
     */
    async *streamChatCompletion(
        messages: ChatMessage[],
        options?: {
            model?: string;
            systemPromptOverride?: string;
        }
    ): AsyncIterable<AIStreamChunk> {
        try {
            const model = this.genAI.getGenerativeModel({
                model: options?.model ?? GEMINI_CONFIG.model,
                generationConfig: GEMINI_CONFIG.generationConfig,
                safetySettings: GEMINI_CONFIG.safetySettings,
            });

            const geminiMessages = convertToGeminiFormat(messages, options?.systemPromptOverride ?? SYSTEM_PROMPT);
            
            // Extract history (all messages except the last one) and the last prompt
            const history = geminiMessages.slice(0, -1);
            const lastMessage = geminiMessages[geminiMessages.length - 1];

            const chat = model.startChat({ history });
            const result = await chat.sendMessageStream(lastMessage.parts[0].text);

            // Stream chunks as they arrive
            for await (const chunk of result.stream) {
                const text = chunk.text();
                if (text) {
                    yield {
                        text,
                        isComplete: false,
                    };
                }
            }

            // Send final completion signal
            yield {
                text: '',
                isComplete: true,
            };

        } catch (error) {
            console.error('Gemini streaming error:', error);
            throw new Error(
                error instanceof Error 
                    ? `Gemini API error: ${error.message}` 
                    : 'Failed to stream response from Gemini'
            );
        }
    }

    /**
     * Get complete (non-streaming) chat response
     * Used as a fallback or for simpler use cases
     */
    async getChatCompletion(
        messages: ChatMessage[],
        options?: {
            model?: string;
            systemPromptOverride?: string;
        }
    ): Promise<string> {
        try {
            const model = this.genAI.getGenerativeModel({
                model: options?.model ?? GEMINI_CONFIG.model,
                generationConfig: GEMINI_CONFIG.generationConfig,
                safetySettings: GEMINI_CONFIG.safetySettings,
            });

            const geminiMessages = convertToGeminiFormat(messages, options?.systemPromptOverride ?? SYSTEM_PROMPT);
            
            // Extract history and last message
            const history = geminiMessages.slice(0, -1);
            const lastMessage = geminiMessages[geminiMessages.length - 1];

            const chat = model.startChat({ history });
            const result = await chat.sendMessage(lastMessage.parts[0].text);
            
            return result.response.text();

        } catch (error) {
            console.error('Gemini completion error:', error);
            throw new Error(
                error instanceof Error 
                    ? `Gemini API error: ${error.message}` 
                    : 'Failed to get response from Gemini'
            );
        }
    }
}

/**
 * Singleton instance of the Gemini provider
 * Lazy-initialized on first use
 */
let geminiProviderInstance: GeminiProvider | null = null;

export function getGeminiProvider(): GeminiProvider {
    if (!geminiProviderInstance) {
        geminiProviderInstance = new GeminiProvider();
    }
    return geminiProviderInstance;
}
