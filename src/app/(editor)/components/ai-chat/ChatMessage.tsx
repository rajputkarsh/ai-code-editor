/**
 * ChatMessage Component
 * Displays a single chat message (user or assistant)
 */

import React from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/ai/types';

interface ChatMessageProps {
    message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.role === 'user';
    
    return (
        <div
            className={`flex flex-col gap-2 p-4 ${
                isUser ? 'bg-neutral-800' : 'bg-neutral-850'
            }`}
        >
            {/* Header */}
            <div className="flex items-center gap-2">
                <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                        isUser
                            ? 'bg-blue-600 text-white'
                            : 'bg-purple-600 text-white'
                    }`}
                >
                    {isUser ? 'U' : 'AI'}
                </div>
                <span className="text-sm font-medium text-neutral-200">
                    {isUser ? 'You' : 'AI Assistant'}
                </span>
                
                {/* Context indicator */}
                {message.contextMetadata && (
                    <span className="text-xs text-neutral-400 ml-auto">
                        {message.contextMetadata.fileName}
                        {message.contextMetadata.isSelection && message.contextMetadata.lineRange && (
                            <span>
                                {' '}(L{message.contextMetadata.lineRange.start}-
                                {message.contextMetadata.lineRange.end})
                            </span>
                        )}
                    </span>
                )}
            </div>
            
            {/* Message content */}
            <div
                className={`text-sm leading-relaxed ${
                    isUser ? 'text-neutral-100' : 'text-neutral-200'
                }`}
            >
                {/* Simple markdown-style rendering */}
                <MessageContent content={message.content} />
            </div>
        </div>
    );
}

/**
 * MessageContent Component
 * Renders message content with basic markdown support
 */
function MessageContent({ content }: { content: string }) {
    // Simple markdown parsing for code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return (
        <div className="space-y-2">
            {parts.map((part, index) => {
                // Check if this is a code block
                if (part.startsWith('```') && part.endsWith('```')) {
                    // Extract language and code
                    const lines = part.slice(3, -3).split('\n');
                    const language = lines[0].trim();
                    const code = lines.slice(1).join('\n');
                    
                    return (
                        <pre
                            key={index}
                            className="bg-neutral-900 p-3 rounded overflow-x-auto border border-neutral-700"
                        >
                            {language && (
                                <div className="text-xs text-neutral-400 mb-2 font-mono">
                                    {language}
                                </div>
                            )}
                            <code className="text-sm text-neutral-100 font-mono">
                                {code}
                            </code>
                        </pre>
                    );
                }
                
                // Regular text with line breaks
                return part.split('\n').map((line, lineIndex) => (
                    <p key={`${index}-${lineIndex}`} className="whitespace-pre-wrap">
                        {line || '\u00A0'}
                    </p>
                ));
            })}
        </div>
    );
}


