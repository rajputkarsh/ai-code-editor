'use client';

/**
 * AIChatPanel Component
 * Main AI chat panel with collapsible sidebar
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useAIChatState } from '../../stores/ai-chat-state';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { PromptTemplateSelector } from './PromptTemplateSelector';
import { ChatErrorMessage } from './ChatErrorMessage';
import { X, Trash2, MessageSquare } from 'lucide-react';
import { PromptTemplate } from '@/lib/ai/prompt-templates';
import { ChatContext } from '@/lib/ai/types';

interface AIChatPanelProps {
    onTemplateSelect?: (template: PromptTemplate) => void;
    onClose?: () => void;
}

export function AIChatPanel({ onTemplateSelect, onClose }: AIChatPanelProps) {
    const {
        messages,
        addMessage,
        clearMessages,
        isStreaming,
        streamingMessage,
        setStreamingMessage,
        startStreaming,
        finishStreaming,
        contextInfo,
    } = useAIChatState();

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingMessage]);

    // Track if we're already processing to avoid duplicates
    const processingRef = useRef(false);
    const lastProcessedCountRef = useRef(0);

    // Handle sending a message
    const handleSendMessage = useCallback(async (content: string, skipAddingMessage = false) => {
        // Add user message (unless it's already been added, e.g., by template)
        const userMessage: ChatMessageType = {
            role: 'user',
            content,
        };
        
        if (!skipAddingMessage) {
            addMessage(userMessage);
        }

        // Get the current messages (including the one we just added or that was added by template)
        const currentMessages = skipAddingMessage ? messages : [...messages, userMessage];

        // Start streaming
        startStreaming();

        try {
            // Call API with streaming
            const response = await fetch('/api/ai-chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: currentMessages,
                }),
            });

            if (!response.ok) {
                // Try to parse error details from response
                try {
                    const errorData = await response.json();
                    const errorMessage = errorData.error || response.statusText;
                    
                    // Provide more context for token limit errors
                    if (errorData.inputTokens && errorData.maxInputTokens) {
                        throw new Error(
                            `${errorMessage}\n\nYour conversation used ${errorData.inputTokens} tokens but the limit is ${errorData.maxInputTokens} tokens. Consider starting a new conversation.`
                        );
                    }
                    
                    throw new Error(errorMessage);
                } catch (parseError) {
                    // If JSON parsing fails, use status text
                    throw new Error(`API error: ${response.statusText}`);
                }
            }

            // Read stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let accumulatedText = '';

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        
                        if (data === '[DONE]') {
                            break;
                        }

                        if (!data) continue; // Skip empty data

                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }

                            if (parsed.text) {
                                accumulatedText += parsed.text;
                                setStreamingMessage(accumulatedText);
                            }
                        } catch (e) {
                            // If JSON parse fails, it might be incomplete chunk - continue
                            // But if it's an Error object (from parsed.error), rethrow it
                            if (e instanceof Error && e.message.includes('Gemini API error')) {
                                throw e;
                            }
                            // Otherwise ignore parse errors for incomplete chunks
                            console.debug('Skipping incomplete chunk:', data);
                        }
                    }
                }
            }

            // Finish streaming
            finishStreaming();
        } catch (error) {
            console.error('Chat error:', error);
            
            // Stop streaming first
            finishStreaming();
            
            // Add error message with special formatting
            const errorMessage = error instanceof Error ? error.message : 'Failed to get response';
            addMessage({
                role: 'assistant',
                content: `[ERROR] ${errorMessage}`,
            });
        }
    }, [messages, addMessage, startStreaming, setStreamingMessage, finishStreaming]);

    // Auto-send when a new user message is added (from templates)
    useEffect(() => {
        // Skip if already processing or streaming
        if (processingRef.current || isStreaming) {
            return;
        }

        // Check if there's a new user message that hasn't been processed
        if (messages.length > lastProcessedCountRef.current) {
            const lastMessage = messages[messages.length - 1];
            
            // If the last message is from user and we're not streaming, send it
            if (lastMessage.role === 'user') {
                processingRef.current = true;
                lastProcessedCountRef.current = messages.length;
                
                // Trigger the send with a slight delay to ensure state is settled
                setTimeout(() => {
                    handleSendMessage(lastMessage.content, true);
                    processingRef.current = false;
                }, 50);
            } else {
                // It's an assistant message, just update the counter
                lastProcessedCountRef.current = messages.length;
            }
        }
    }, [messages, isStreaming, handleSendMessage]);

    const handleTemplateSelect = (template: PromptTemplate) => {
        // Call the parent handler to generate the prompt with context
        if (onTemplateSelect) {
            onTemplateSelect(template);
        }
        
        // Note: The parent handler will add the message to state,
        // and we'll detect it in useEffect to trigger sending
    };

    const handleClearChat = () => {
        if (confirm('Clear all chat messages?')) {
            clearMessages();
        }
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        }
    };

    return (
        <div className="
            flex flex-col h-full bg-neutral-900 border-l border-neutral-800 
            w-full md:w-96 
            shrink-0
            fixed md:relative
            top-0 right-0
            z-40
            shadow-2xl md:shadow-none
        ">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-850">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className="w-4 h-4 text-purple-500 shrink-0" />
                    <h2 className="text-sm font-semibold text-neutral-200 truncate">
                        AI Assistant
                    </h2>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleClearChat}
                        disabled={messages.length === 0 && !isStreaming}
                        className="p-1.5 rounded hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Clear chat"
                    >
                        <Trash2 className="w-4 h-4 text-neutral-400" />
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded hover:bg-neutral-700 transition-colors"
                        title="Close panel"
                    >
                        <X className="w-4 h-4 text-neutral-400" />
                    </button>
                </div>
            </div>

            {/* Context info */}
            {contextInfo && (
                <div className="px-3 py-2 text-xs text-neutral-400 bg-neutral-850 border-b border-neutral-800">
                    <span className="font-medium">Context:</span> <span className="truncate inline-block max-w-[90%]">{contextInfo}</span>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
                {messages.length === 0 && !isStreaming ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                        <MessageSquare className="w-12 h-12 text-neutral-700 mb-3" />
                        <h3 className="text-sm font-medium text-neutral-300 mb-1">
                            AI Chat Assistant
                        </h3>
                        <p className="text-xs text-neutral-500 mb-4">
                            Select code and use Quick Actions, or ask anything about your code.
                        </p>
                        <div className="text-xs text-neutral-600 space-y-1">
                            <p>💡 AI suggestions are read-only</p>
                            <p>📝 Apply changes manually</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <ChatMessage key={index} message={message} />
                        ))}
                        
                        {/* Streaming message */}
                        {isStreaming && (
                            <ChatMessage
                                message={{
                                    role: 'assistant',
                                    content: streamingMessage || '...',
                                }}
                            />
                        )}
                        
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Template selector */}
            <PromptTemplateSelector
                onSelectTemplate={handleTemplateSelect}
                disabled={isStreaming}
            />

            {/* Input */}
            <ChatInput
                onSend={handleSendMessage}
                disabled={isStreaming}
                placeholder={isStreaming ? 'AI is responding...' : 'Ask about your code...'}
            />
        </div>
    );
}

// Re-export ChatMessage type for use in this component
import { ChatMessage as ChatMessageType } from '@/lib/ai/types';


