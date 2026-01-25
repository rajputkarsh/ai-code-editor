'use client';

/**
 * AIChatPanel Component
 * Main AI chat panel with collapsible sidebar
 */

import React, { useEffect, useRef } from 'react';
import { useAIChatState } from '../../stores/ai-chat-state';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { PromptTemplateSelector } from './PromptTemplateSelector';
import { X, Trash2, MessageSquare } from 'lucide-react';
import { PromptTemplate } from '@/lib/ai/prompt-templates';
import { ChatContext } from '@/lib/ai/types';

interface AIChatPanelProps {
    onTemplateSelect?: (template: PromptTemplate) => void;
}

export function AIChatPanel({ onTemplateSelect }: AIChatPanelProps) {
    const {
        messages,
        addMessage,
        clearMessages,
        isStreaming,
        streamingMessage,
        setStreamingMessage,
        startStreaming,
        finishStreaming,
        isPanelOpen,
        closePanel,
        contextInfo,
    } = useAIChatState();

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingMessage]);

    // Handle sending a message
    const handleSendMessage = async (content: string) => {
        // Add user message
        const userMessage: ChatMessageType = {
            role: 'user',
            content,
        };
        addMessage(userMessage);

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
                    messages: [...messages, userMessage],
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
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
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            break;
                        }

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
                            // Ignore JSON parse errors for incomplete chunks
                        }
                    }
                }
            }

            // Finish streaming
            finishStreaming();
        } catch (error) {
            console.error('Chat error:', error);
            
            // Add error message
            addMessage({
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
            });
            
            finishStreaming();
        }
    };

    const handleTemplateSelect = (template: PromptTemplate) => {
        if (onTemplateSelect) {
            onTemplateSelect(template);
        }
    };

    const handleClearChat = () => {
        if (confirm('Clear all chat messages?')) {
            clearMessages();
        }
    };

    if (!isPanelOpen) {
        return null;
    }

    return (
        <div className="flex flex-col h-full bg-neutral-900 border-l border-neutral-800 w-96 flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-850">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                    <h2 className="text-sm font-semibold text-neutral-200">
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
                        onClick={closePanel}
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
                    <span className="font-medium">Context:</span> {contextInfo}
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


