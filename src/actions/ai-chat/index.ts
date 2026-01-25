'use server';

/**
 * Server Actions for AI Chat
 * These actions handle communication with the Gemini AI provider
 * 
 * Note: For streaming responses, we use a ReadableStream approach
 * that can be consumed by the client using fetch or similar
 */

import { getGeminiProvider } from '@/lib/ai/provider/gemini';
import { ChatMessage } from '@/lib/ai/types';

/**
 * Send a chat message and get a streaming response
 * This action is called from the client and returns a stream of text chunks
 * 
 * @param messages - Complete chat history including the new user message
 * @returns ReadableStream of text chunks
 */
export async function streamChatCompletion(messages: ChatMessage[]) {
    try {
        // Validate input
        if (!messages || messages.length === 0) {
            throw new Error('Messages array cannot be empty');
        }

        // Validate last message is from user
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') {
            throw new Error('Last message must be from user');
        }

        // Get provider instance
        const provider = getGeminiProvider();

        // Create a readable stream that yields text chunks
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Stream the response from Gemini
                    for await (const chunk of provider.streamChatCompletion(messages)) {
                        // Encode chunk as JSON and send to client
                        const encoder = new TextEncoder();
                        const data = encoder.encode(JSON.stringify(chunk) + '\n');
                        controller.enqueue(data);
                    }
                    
                    // Close the stream when done
                    controller.close();
                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.error(error);
                }
            },
        });

        return stream;
    } catch (error) {
        console.error('Chat completion error:', error);
        throw new Error(
            error instanceof Error 
                ? error.message 
                : 'Failed to generate AI response'
        );
    }
}

/**
 * Get a complete (non-streaming) chat response
 * Used as a fallback if streaming fails or for simpler use cases
 * 
 * @param messages - Complete chat history including the new user message
 * @returns Complete response text
 */
export async function getChatCompletion(messages: ChatMessage[]): Promise<string> {
    try {
        // Validate input
        if (!messages || messages.length === 0) {
            throw new Error('Messages array cannot be empty');
        }

        // Validate last message is from user
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role !== 'user') {
            throw new Error('Last message must be from user');
        }

        // Get provider instance
        const provider = getGeminiProvider();

        // Get complete response
        const response = await provider.getChatCompletion(messages);
        
        return response;
    } catch (error) {
        console.error('Chat completion error:', error);
        throw new Error(
            error instanceof Error 
                ? error.message 
                : 'Failed to generate AI response'
        );
    }
}

/**
 * Health check for AI service
 * Tests that Gemini API is accessible and API key is valid
 */
export async function testAIConnection(): Promise<{ success: boolean; error?: string }> {
    try {
        const provider = getGeminiProvider();
        
        // Send a simple test message
        const response = await provider.getChatCompletion([
            {
                role: 'user',
                content: 'Hello, respond with "OK" if you can read this.',
            },
        ]);

        return {
            success: true,
        };
    } catch (error) {
        console.error('AI connection test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}


