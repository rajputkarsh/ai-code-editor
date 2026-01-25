/**
 * ChatInput Component
 * Input field for sending chat messages
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({
    onSend,
    disabled = false,
    placeholder = 'Ask about your code...',
}: ChatInputProps) {
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        const message = input.trim();
        if (message && !disabled) {
            onSend(message);
            setInput('');
            
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Send on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        
        // Auto-resize textarea
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    };

    return (
        <div className="border-t border-neutral-700 p-3 bg-neutral-900">
            <div className="flex gap-2">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={1}
                    className="
                        flex-1 bg-neutral-800 text-neutral-100 rounded px-3 py-2 text-sm
                        border border-neutral-700 focus:border-blue-500 focus:outline-none
                        resize-none overflow-y-auto
                        placeholder:text-neutral-500
                        disabled:opacity-50 disabled:cursor-not-allowed
                    "
                    style={{ maxHeight: '200px' }}
                />
                <button
                    onClick={handleSend}
                    disabled={disabled || !input.trim()}
                    className="
                        flex items-center justify-center w-10 h-10 rounded
                        bg-blue-600 hover:bg-blue-700
                        disabled:bg-neutral-700 disabled:cursor-not-allowed
                        transition-colors
                    "
                    title="Send message (Enter)"
                >
                    <Send className="w-4 h-4 text-white" />
                </button>
            </div>
            <div className="text-xs text-neutral-500 mt-2">
                Press <kbd className="px-1 py-0.5 bg-neutral-800 rounded border border-neutral-700">Enter</kbd> to send,{' '}
                <kbd className="px-1 py-0.5 bg-neutral-800 rounded border border-neutral-700">Shift + Enter</kbd> for new line
            </div>
        </div>
    );
}


