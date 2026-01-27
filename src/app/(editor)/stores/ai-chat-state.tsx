'use client';

/**
 * AI Chat State Management
 * Manages chat messages, streaming state, and chat interactions
 * This store is session-local and not persisted (as per Phase 4.3 requirements)
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { ChatMessage } from '@/lib/ai/types';
import type {
    AgentMode,
    AgentStage,
    AgentPlan,
    AgentStepResult,
    AgentPermissionState,
    AgentAppliedChange,
} from '@/lib/ai/agent/types';

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

    // Agent mode state
    agentMode: AgentMode;
    setAgentMode: (mode: AgentMode) => void;
    agentStage: AgentStage;
    setAgentStage: (stage: AgentStage) => void;
    agentTask: string | null;
    setAgentTask: (task: string | null) => void;
    agentPlan: AgentPlan | null;
    setAgentPlan: (plan: AgentPlan | null) => void;
    agentStepResult: AgentStepResult | null;
    setAgentStepResult: (result: AgentStepResult | null) => void;
    agentCurrentStepIndex: number;
    setAgentCurrentStepIndex: (index: number) => void;
    agentAppliedChanges: AgentAppliedChange[];
    setAgentAppliedChanges: (changes: AgentAppliedChange[]) => void;
    agentPermissions: AgentPermissionState;
    setAgentPermissions: (next: AgentPermissionState) => void;
    permissionsApproved: boolean;
    setPermissionsApproved: (approved: boolean) => void;
    agentError: string | null;
    setAgentError: (error: string | null) => void;
    resetAgentState: () => void;
}

const AIChatStateContext = createContext<AIChatStateContextType | undefined>(undefined);

export function AIChatStateProvider({ children }: { children: React.ReactNode }) {
    // Message history
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    
    // Streaming state
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMessage, setStreamingMessage] = useState('');
    
    // Use ref to always have access to latest streaming message
    const streamingMessageRef = useRef('');
    
    // UI state
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    
    // Context info (e.g., "index.tsx, lines 10-25")
    const [contextInfo, setContextInfo] = useState<string | null>(null);

    // Agent mode state
    const [agentMode, setAgentMode] = useState<AgentMode>('chat');
    const [agentStage, setAgentStage] = useState<AgentStage>('idle');
    const [agentTask, setAgentTask] = useState<string | null>(null);
    const [agentPlan, setAgentPlan] = useState<AgentPlan | null>(null);
    const [agentStepResult, setAgentStepResult] = useState<AgentStepResult | null>(null);
    const [agentCurrentStepIndex, setAgentCurrentStepIndex] = useState(-1);
    const [agentAppliedChanges, setAgentAppliedChanges] = useState<AgentAppliedChange[]>([]);
    const [agentPermissions, setAgentPermissions] = useState<AgentPermissionState>({
        read: true,
        modify: true,
        create: true,
        delete: false,
        createBranch: false,
        commit: false,
        push: false,
        openPullRequest: false,
    });
    const [permissionsApproved, setPermissionsApproved] = useState(false);
    const [agentError, setAgentError] = useState<string | null>(null);

    // Message management
    const addMessage = useCallback((message: ChatMessage) => {
        setMessages((prev) => [...prev, message]);
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setStreamingMessage('');
        streamingMessageRef.current = '';
        setContextInfo(null);
    }, []);

    // Streaming management
    const startStreaming = useCallback(() => {
        setIsStreaming(true);
        setStreamingMessage('');
        streamingMessageRef.current = '';
    }, []);

    const setStreamingMessageWrapper = useCallback((text: string) => {
        streamingMessageRef.current = text;
        setStreamingMessage(text);
    }, []);

    const finishStreaming = useCallback(() => {
        // Use ref to get the latest message value
        const finalMessage = streamingMessageRef.current;
        
        console.log('[AI Chat] Finishing stream, message length:', finalMessage.length);
        
        // Add the complete streamed message to history
        if (finalMessage.trim()) {
            setMessages((prev) => {
                const newMessages: ChatMessage[] = [
                    ...prev,
                    {
                        role: 'assistant' as const,
                        content: finalMessage,
                    },
                ];
                console.log('[AI Chat] Added message to history, total messages:', newMessages.length);
                return newMessages;
            });
        } else {
            console.warn('[AI Chat] Streaming message was empty, not adding to history');
        }
        
        // Clear streaming state
        setIsStreaming(false);
        setStreamingMessage('');
        streamingMessageRef.current = '';
    }, []);

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

    const resetAgentState = useCallback(() => {
        setAgentStage('idle');
        setAgentTask(null);
        setAgentPlan(null);
        setAgentStepResult(null);
        setAgentCurrentStepIndex(-1);
        setAgentAppliedChanges([]);
        setAgentPermissions({
            read: true,
            modify: true,
            create: true,
            delete: false,
            createBranch: false,
            commit: false,
            push: false,
            openPullRequest: false,
        });
        setPermissionsApproved(false);
        setAgentError(null);
    }, []);

    const value = useMemo(
        () => ({
            messages,
            addMessage,
            clearMessages,
            isStreaming,
            streamingMessage,
            setStreamingMessage: setStreamingMessageWrapper,
            startStreaming,
            finishStreaming,
            isPanelOpen,
            togglePanel,
            openPanel,
            closePanel,
            contextInfo,
            setContextInfo,
            agentMode,
            setAgentMode,
            agentStage,
            setAgentStage,
            agentTask,
            setAgentTask,
            agentPlan,
            setAgentPlan,
            agentStepResult,
            setAgentStepResult,
            agentCurrentStepIndex,
            setAgentCurrentStepIndex,
            agentAppliedChanges,
            setAgentAppliedChanges,
            agentPermissions,
            setAgentPermissions,
            permissionsApproved,
            setPermissionsApproved,
            agentError,
            setAgentError,
            resetAgentState,
        }),
        [
            messages,
            addMessage,
            clearMessages,
            isStreaming,
            streamingMessage,
            setStreamingMessageWrapper,
            startStreaming,
            finishStreaming,
            isPanelOpen,
            togglePanel,
            openPanel,
            closePanel,
            contextInfo,
            agentMode,
            agentStage,
            agentTask,
            agentPlan,
            agentStepResult,
            agentCurrentStepIndex,
            agentAppliedChanges,
            agentPermissions,
            permissionsApproved,
            agentError,
            resetAgentState,
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


