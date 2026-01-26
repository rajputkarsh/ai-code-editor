'use client';

/**
 * Inline AI State Management
 * 
 * Manages state for:
 * - Inline code completions
 * - AI code actions
 * - Prompt history
 * 
 * Phase 2: All AI actions are explicit and require user approval.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface InlineCompletion {
    id: string;
    fileId: string;
    position: { lineNumber: number; column: number };
    completion: string;
    timestamp: number;
}

export interface CodeActionPreview {
    id: string;
    action: 'refactor' | 'convert-to-typescript' | 'add-comments' | 'optimize';
    fileId: string;
    originalCode: string;
    modifiedCode: string;
    timestamp: number;
}

export interface PromptHistoryEntry {
    id: string;
    timestamp: number;
    type: 'inline-completion' | 'code-action' | 'explain';
    prompt: string;
    response?: string;
    metadata?: Record<string, unknown>;
}

interface InlineAIStateContextType {
    // Inline completion state
    currentCompletion: InlineCompletion | null;
    isLoadingCompletion: boolean;
    setCurrentCompletion: (completion: InlineCompletion | null) => void;
    setLoadingCompletion: (loading: boolean) => void;
    
    // Code action preview state
    currentPreview: CodeActionPreview | null;
    isLoadingAction: boolean;
    setCurrentPreview: (preview: CodeActionPreview | null) => void;
    setLoadingAction: (loading: boolean) => void;
    
    // Prompt history
    promptHistory: PromptHistoryEntry[];
    addPromptToHistory: (entry: Omit<PromptHistoryEntry, 'id' | 'timestamp'>) => void;
    clearHistory: () => void;
    
    // Explanation state
    currentExplanation: { code: string; explanation: string } | null;
    isLoadingExplanation: boolean;
    setCurrentExplanation: (explanation: { code: string; explanation: string } | null) => void;
    setLoadingExplanation: (loading: boolean) => void;
}

const InlineAIStateContext = createContext<InlineAIStateContextType | undefined>(undefined);

export function InlineAIStateProvider({ children }: { children: React.ReactNode }) {
    // Inline completion state
    const [currentCompletion, setCurrentCompletion] = useState<InlineCompletion | null>(null);
    const [isLoadingCompletion, setLoadingCompletion] = useState(false);
    
    // Code action preview state
    const [currentPreview, setCurrentPreview] = useState<CodeActionPreview | null>(null);
    const [isLoadingAction, setLoadingAction] = useState(false);
    
    // Prompt history (session-scoped for Phase 2)
    const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
    
    // Explanation state
    const [currentExplanation, setCurrentExplanation] = useState<{ code: string; explanation: string } | null>(null);
    const [isLoadingExplanation, setLoadingExplanation] = useState(false);
    
    const addPromptToHistory = useCallback((entry: Omit<PromptHistoryEntry, 'id' | 'timestamp'>) => {
        const newEntry: PromptHistoryEntry = {
            ...entry,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };
        
        setPromptHistory((prev) => [...prev, newEntry]);
    }, []);
    
    const clearHistory = useCallback(() => {
        setPromptHistory([]);
    }, []);

    const value = useMemo(
        () => ({
            currentCompletion,
            isLoadingCompletion,
            setCurrentCompletion,
            setLoadingCompletion,
            currentPreview,
            isLoadingAction,
            setCurrentPreview,
            setLoadingAction,
            promptHistory,
            addPromptToHistory,
            clearHistory,
            currentExplanation,
            isLoadingExplanation,
            setCurrentExplanation,
            setLoadingExplanation,
        }),
        [
            currentCompletion,
            isLoadingCompletion,
            currentPreview,
            isLoadingAction,
            promptHistory,
            addPromptToHistory,
            clearHistory,
            currentExplanation,
            isLoadingExplanation,
        ]
    );

    return (
        <InlineAIStateContext.Provider value={value}>
            {children}
        </InlineAIStateContext.Provider>
    );
}

export function useInlineAI() {
    const context = useContext(InlineAIStateContext);
    if (!context) {
        throw new Error('useInlineAI must be used within InlineAIStateProvider');
    }
    return context;
}

