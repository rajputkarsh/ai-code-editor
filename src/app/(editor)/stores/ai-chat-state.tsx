'use client';

/**
 * AI Chat State Management
 * Manages chat messages, streaming state, and chat interactions
 * This store is session-local and not persisted (as per Phase 4.3 requirements)
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ChatMessage } from '@/lib/ai/types';

interface AIChatStateContextType {
    // Messages
    messages: ChatMessage[];
    addMessage: (message: ChatMessage) => void;
    clearMessages: () => void;
    
    // Streaming state
    isStreaming: boolean;
    streamingMessage: string;
    setStreamingMessage: (text: string) => void;
    startStreaming: () => void;
    finishStreaming: () => void;
    
    // UI state
    isPanelOpen: boolean;
    togglePanel: () => void;
    openPanel: () => void;
    closePanel: () => void;
    
    // Context state (what code is being discussed)
    contextInfo: string | null;
    setContextInfo: (info: string | null) => void;
}

const AIChatStateContext = createContext<AIChatStateContextType | undefined>(undefined);

export function AIChatStateProvider({ children }: { children: React.ReactNode }) {
    // Message history
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    
    // Streaming state
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    
    // UI state
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    
    // Context info (e.g., "index.tsx, lines 10-25")
    const [contextInfo, setContextInfo] = useState<string | null>(null);

    // Message management
    const addMessage = useCallback((message: ChatMessage) => {
        setMessages((prev) => [...prev, message]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setStreamingMessage('');
        setContextInfo(null);
    }, []);

    // Streaming management
    const startStreaming = useCallback(() => {
        setIsStreaming(true);
        setStreamingMessage('');
    }, []);

    const finishStreaming = useCallback(() => {
        // Add the complete streamed message to history
        if (streamingMessage.trim()) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: streamingMessage,
                },
            ]);
        }
        setIsStreaming(false);
        setStreamingMessage('');
    }, [streamingMessage]);

    // Panel management
    const togglePanel = useCallback(() => {
        setIsPanelOpen((prev) => !prev);
    }, []);

    const openPanel = useCallback(() => {
        setIsPanelOpen(true);
    }, []);

    const closePanel = useCallback(() => {
        setIsPanelOpen(false);
    }, []);

    const value = useMemo(
        () => ({
            messages,
            addMessage,
            clearMessages,
            isStreaming,
            streamingMessage,
            setStreamingMessage,
            startStreaming,
            finishStreaming,
            isPanelOpen,
            togglePanel,
            openPanel,
            closePanel,
            contextInfo,
            setContextInfo,
        }),
        [
            messages,
            addMessage,
            clearMessages,
            isStreaming,
            streamingMessage,
            startStreaming,
            finishStreaming,
            isPanelOpen,
            togglePanel,
            openPanel,
            closePanel,
            contextInfo,
        ]
    );

    return <AIChatStateContext.Provider value={value}>{children}</AIChatStateContext.Provider>;
}

export function useAIChatState() {
    const context = useContext(AIChatStateContext);
    if (!context) {
        throw new Error('useAIChatState must be used within a AIChatStateProvider');
    }
    return context;
}


