'use client';

/**
 * AIChatPanel Component
 * Main AI chat panel with collapsible sidebar
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useAIChatState } from '../../stores/ai-chat-state';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { PromptTemplateSelector } from './PromptTemplateSelector';
import { ChatErrorMessage } from './ChatErrorMessage';
import { X, Trash2, MessageSquare } from 'lucide-react';
import { PromptTemplate } from '@/lib/ai/prompt-templates';
import { ChatContext } from '@/lib/ai/types';
import { useWorkspace } from '../../stores/workspace-provider';
import { useFileSystem } from '../../stores/file-system';
import { generateAgentPlan } from '@/lib/ai/agent/planner';
import { executeAgentStep } from '@/lib/ai/agent/executor';
import { buildWorkspaceIndex, buildWorkspaceSnapshot, getFileContentsByPath } from '@/lib/ai/agent/workspace';
import { AgentDiffViewer } from './AgentDiffViewer';
import type { AgentMode, AgentStepChange, AgentAppliedChange, AgentPermissionState } from '@/lib/ai/agent/types';
import { Modal } from '@/components/ui/Modal';
import { generateGitHubDraft, type AgentGitHubDraft } from '@/lib/ai/agent/github-draft';
import { parseGitHubUrl } from '@/lib/github/repository';
import { buildDeterministicBranchName } from '@/lib/github/branch-naming';
import { getClientModelPreference } from '@/lib/ai/platform/client-preferences';

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
    } = useAIChatState();

    const { workspace, vfs } = useWorkspace();
    const { files, createFile, createFolder, updateFileContent, deleteNode, rootId } = useFileSystem();
    const [isClearChatOpen, setIsClearChatOpen] = useState(false);
    const [gitHubStage, setGitHubStage] = useState<'idle' | 'drafting' | 'awaiting_review' | 'publishing' | 'published' | 'error'>('idle');
    const [gitHubDraft, setGitHubDraft] = useState<AgentGitHubDraft | null>(null);
    const [gitHubError, setGitHubError] = useState<string | null>(null);
    const [gitHubBranches, setGitHubBranches] = useState<string[]>([]);
    const [selectedBaseBranch, setSelectedBaseBranch] = useState<string | null>(null);
    const [isFetchingBranches, setIsFetchingBranches] = useState(false);
    const [gitHubPublishResult, setGitHubPublishResult] = useState<{
        prUrl: string;
        prNumber: number;
        branchName: string;
    } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const workspaceIndex = useMemo(() => {
        if (!vfs) return null;
        return buildWorkspaceIndex(vfs);
    }, [vfs, files]);
    const workspaceFiles = useMemo(() => {
        if (!workspaceIndex) return [];
        return workspaceIndex.entries
            .filter((entry) => entry.type === 'file')
            .map((entry) => entry.path);
    }, [workspaceIndex]);
    const originalContentByPath = useMemo(() => {
        if (!vfs || !agentStepResult) return {};
        const paths = agentStepResult.changes.map((change) => change.filePath);
        return getFileContentsByPath(vfs, paths);
    }, [vfs, agentStepResult, files]);
    const appliedOriginalContentByPath = useMemo(() => {
        if (agentAppliedChanges.length === 0) return {};
        return agentAppliedChanges.reduce<Record<string, string>>((acc, change) => {
            if (change.originalContent !== undefined) {
                acc[change.filePath] = change.originalContent;
            }
            return acc;
        }, {});
    }, [agentAppliedChanges]);
    const githubRepo = useMemo(() => {
        const repoUrl = workspace?.metadata.githubMetadata?.repositoryUrl;
        if (!repoUrl) return null;
        return parseGitHubUrl(repoUrl);
    }, [workspace]);

    // Auto-scroll to bottom when new messages arrive
    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingMessage]);

    useEffect(() => {
        const defaultBranch = workspace?.metadata.githubMetadata?.branch || null;
        if (defaultBranch && !selectedBaseBranch) {
            setSelectedBaseBranch(defaultBranch);
        }
    }, [selectedBaseBranch, workspace]);

    useEffect(() => {
        if (agentStage === 'idle') {
            setGitHubStage('idle');
            setGitHubDraft(null);
            setGitHubError(null);
            setGitHubPublishResult(null);
        }
    }, [agentStage]);

    useEffect(() => {
        if (!githubRepo || gitHubBranches.length > 0 || isFetchingBranches) {
            return;
        }
        if (agentMode !== 'agent' || agentStage !== 'completed') {
            return;
        }

        const fetchBranches = async () => {
            setIsFetchingBranches(true);
            try {
                const response = await fetch(
                    `/api/github/repository/${githubRepo.owner}/${githubRepo.repo}/branches`
                );
                if (!response.ok) {
                    throw new Error('Failed to fetch branches');
                }
                const data: { branches: Array<{ name: string }> } = await response.json();
                const branchNames = data.branches.map((branch) => branch.name);
                setGitHubBranches(branchNames);
                if (!selectedBaseBranch && branchNames.length > 0) {
                    setSelectedBaseBranch(branchNames[0]);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load branches';
                setGitHubError(message);
                setGitHubStage('error');
            } finally {
                setIsFetchingBranches(false);
            }
        };

        fetchBranches();
    }, [
        agentMode,
        agentStage,
        githubRepo,
        gitHubBranches.length,
        isFetchingBranches,
        selectedBaseBranch,
    ]);

    // Track if we're already processing to avoid duplicates
    const processingRef = useRef(false);
    const lastProcessedCountRef = useRef(0);

    const normalizePath = useCallback((path: string) => {
        const trimmed = path.trim();
        if (!trimmed) return '/';
        const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        return withSlash.replace(/\/+$/, '');
    }, []);

    const findChildFolderId = useCallback(
        (parentId: string, name: string) => {
            const child = Object.values(files).find(
                (node) => node.parentId === parentId && node.name === name && node.type === 'folder'
            );
            return child?.id;
        },
        [files]
    );

    const ensureFolderPath = useCallback(
        (folderPath: string) => {
            const normalized = normalizePath(folderPath);
            const segments = normalized.split('/').filter(Boolean);
            let currentId = rootId;

            segments.forEach((segment) => {
                const existingId = findChildFolderId(currentId, segment);
                if (existingId) {
                    currentId = existingId;
                } else {
                    currentId = createFolder(currentId, segment);
                }
            });

            return currentId;
        },
        [createFolder, findChildFolderId, normalizePath, rootId]
    );

    const createFileByPath = useCallback(
        (filePath: string, content: string) => {
            const normalized = normalizePath(filePath);
            const segments = normalized.split('/').filter(Boolean);
            const fileName = segments.pop();
            if (!fileName) {
                throw new Error('Invalid file path for creation.');
            }
            const folderPath = `/${segments.join('/')}`;
            const parentId = ensureFolderPath(folderPath);
            return createFile(parentId, fileName, content);
        },
        [createFile, ensureFolderPath, normalizePath]
    );

    const applyStepChanges = useCallback(
        (changes: AgentStepChange[]) => {
            if (!workspaceIndex) {
                throw new Error('Workspace index is not available.');
            }

            changes.forEach((change) => {
                const normalizedPath = normalizePath(change.filePath);
                const fileId = workspaceIndex.pathToId.get(normalizedPath);

                if (change.changeType === 'modify') {
                    if (!agentPermissions.modify) {
                        throw new Error('Modify permission not granted.');
                    }
                    if (!fileId) {
                        throw new Error(`File not found for modify: ${normalizedPath}`);
                    }
                    if (change.updatedContent === undefined) {
                        throw new Error(`Missing updatedContent for modify: ${normalizedPath}`);
                    }
                    updateFileContent(fileId, change.updatedContent);
                    return;
                }

                if (change.changeType === 'create') {
                    if (!agentPermissions.create) {
                        throw new Error('Create permission not granted.');
                    }
                    if (change.updatedContent === undefined) {
                        throw new Error(`Missing updatedContent for create: ${normalizedPath}`);
                    }
                    if (fileId) {
                        updateFileContent(fileId, change.updatedContent);
                    } else {
                        createFileByPath(normalizedPath, change.updatedContent);
                    }
                    return;
                }

                if (change.changeType === 'delete') {
                    if (!agentPermissions.delete) {
                        throw new Error('Delete permission not granted.');
                    }
                    if (!fileId) {
                        throw new Error(`File not found for delete: ${normalizedPath}`);
                    }
                    deleteNode(fileId);
                }
            });
        },
        [
            agentPermissions.create,
            agentPermissions.delete,
            agentPermissions.modify,
            createFileByPath,
            deleteNode,
            normalizePath,
            updateFileContent,
            workspaceIndex,
        ]
    );

    const mergeAppliedChanges = useCallback(
        (existing: AgentAppliedChange[], incoming: AgentAppliedChange[]) => {
            const merged = new Map<string, AgentAppliedChange>();
            existing.forEach((change) => {
                merged.set(change.filePath, change);
            });
            incoming.forEach((change) => {
                const previous = merged.get(change.filePath);
                merged.set(change.filePath, {
                    ...change,
                    originalContent: previous?.originalContent ?? change.originalContent,
                });
            });
            return Array.from(merged.values());
        },
        []
    );

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
                    workspaceId: workspace?.metadata.id,
                    model: getClientModelPreference('chat'),
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

    const handleModeChange = useCallback(
        (nextMode: AgentMode) => {
            setAgentMode(nextMode);
            if (nextMode === 'chat') {
                resetAgentState();
            }
        },
        [resetAgentState, setAgentMode]
    );

    const handleStartAgentTask = useCallback(
        (content: string) => {
            const userMessage: ChatMessageType = {
                role: 'user',
                content,
            };
            addMessage(userMessage);
            resetAgentState();
            setGitHubStage('idle');
            setGitHubDraft(null);
            setGitHubError(null);
            setGitHubPublishResult(null);
            setAgentTask(content);
            setAgentStage('awaiting_permissions');
            setAgentError(null);
        },
        [
            addMessage,
            resetAgentState,
            setAgentError,
            setAgentStage,
            setAgentTask,
        ]
    );

    const handleApprovePermissions = useCallback(async () => {
        if (!agentTask) return;
        if (!vfs) {
            setAgentError('Workspace is still loading.');
            setAgentStage('error');
            return;
        }

        setPermissionsApproved(true);
        setAgentStage('planning');
        setAgentError(null);

        try {
            const snapshot = buildWorkspaceSnapshot(vfs);
            const plan = await generateAgentPlan({
                task: agentTask,
                workspaceFiles: snapshot.files
                    .filter((file) => file.type === 'file')
                    .map((file) => file.path),
                permissions: agentPermissions,
                workspaceId: workspace?.metadata.id,
                model: getClientModelPreference('agent_mode'),
            });
            setAgentPlan(plan);
            setAgentStage('awaiting_plan_approval');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to generate plan';
            setAgentError(message);
            setAgentStage('error');
        }
    }, [
        agentPermissions,
        agentTask,
        setAgentError,
        setAgentPlan,
        setAgentStage,
        setPermissionsApproved,
        vfs,
    ]);

    const runNextStep = useCallback(
        async (nextIndex: number) => {
            if (!agentPlan || !agentTask) return;
            if (!vfs) {
                setAgentError('Workspace is still loading.');
                setAgentStage('error');
                return;
            }

            const step = agentPlan.steps[nextIndex];
            setAgentCurrentStepIndex(nextIndex);
            setAgentStage('executing');
            setAgentError(null);

            try {
                const filesForContext = Array.from(
                    new Set([...step.filesToRead, ...step.filesToModify])
                ).map(normalizePath);
                const fileContents = getFileContentsByPath(vfs, filesForContext);

                const result = await executeAgentStep({
                    task: agentTask,
                    step,
                    permissions: agentPermissions,
                    existingFiles: workspaceFiles,
                    fileContents,
                    workspaceId: workspace?.metadata.id,
                    model: getClientModelPreference('agent_mode'),
                });

                setAgentStepResult(result);
                setAgentStage('awaiting_step_approval');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to execute step';
                setAgentError(message);
                setAgentStage('error');
            }
        },
        [
            agentPermissions,
            agentPlan,
            agentTask,
            normalizePath,
            setAgentCurrentStepIndex,
            setAgentError,
            setAgentStage,
            setAgentStepResult,
            vfs,
            workspaceFiles,
        ]
    );

    const handleApprovePlan = useCallback(async () => {
        if (!agentPlan) return;
        // User approval gate before any execution begins.
        await runNextStep(0);
    }, [agentPlan, runNextStep]);

    const handleApproveStep = useCallback(async () => {
        if (!agentPlan || !agentStepResult) return;

        try {
            const appliedChanges = agentStepResult.changes.map((change) => ({
                ...change,
                originalContent: originalContentByPath[change.filePath],
            }));
            setAgentAppliedChanges(mergeAppliedChanges(agentAppliedChanges, appliedChanges));
            applyStepChanges(agentStepResult.changes);
            setAgentStepResult(null);
            const nextIndex = agentCurrentStepIndex + 1;
            if (nextIndex >= agentPlan.steps.length) {
                setAgentStage('completed');
                return;
            }
            // Each step is reviewed before continuing to the next.
            await runNextStep(nextIndex);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to apply step';
            setAgentError(message);
            setAgentStage('error');
        }
    }, [
        agentCurrentStepIndex,
        agentPlan,
        agentStepResult,
        agentAppliedChanges,
        applyStepChanges,
        mergeAppliedChanges,
        originalContentByPath,
        runNextStep,
        setAgentError,
        setAgentAppliedChanges,
        setAgentStage,
        setAgentStepResult,
    ]);

    const handleRejectPlan = useCallback(() => {
        setAgentPlan(null);
        setAgentStage('completed');
    }, [setAgentPlan, setAgentStage]);

    const handleStopExecution = useCallback(() => {
        setAgentStepResult(null);
        setAgentStage('completed');
    }, [setAgentStage, setAgentStepResult]);

    const handlePrepareGitHubDraft = useCallback(async () => {
        if (!agentTask || !githubRepo || !selectedBaseBranch) {
            setGitHubError('Missing GitHub repository context.');
            setGitHubStage('error');
            return;
        }
        if (agentAppliedChanges.length === 0) {
            setGitHubError('No agent changes available to publish.');
            setGitHubStage('error');
            return;
        }

        setGitHubStage('drafting');
        setGitHubError(null);
        setGitHubPublishResult(null);

        try {
            const draft = await generateGitHubDraft({
                task: agentTask,
                repoFullName: `${githubRepo.owner}/${githubRepo.repo}`,
                baseBranch: selectedBaseBranch,
                changes: agentAppliedChanges,
                workspaceId: workspace?.metadata.id,
                model: getClientModelPreference('agent_mode'),
            });
            setGitHubDraft(draft);
            setGitHubStage('awaiting_review');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to generate GitHub draft';
            setGitHubError(message);
            setGitHubStage('error');
        }
    }, [agentAppliedChanges, agentTask, githubRepo, selectedBaseBranch]);

    const handlePublishGitHubChanges = useCallback(async () => {
        if (!agentTask || !githubRepo || !selectedBaseBranch || !gitHubDraft) {
            setGitHubError('Missing GitHub publish details.');
            setGitHubStage('error');
            return;
        }
        if (!vfs) {
            setGitHubError('Workspace is still loading.');
            setGitHubStage('error');
            return;
        }

        setGitHubStage('publishing');
        setGitHubError(null);

        try {
            const contentByPath = getFileContentsByPath(
                vfs,
                agentAppliedChanges.map((change) => change.filePath)
            );
            const changesPayload = agentAppliedChanges.map((change) => {
                if (change.changeType === 'delete') {
                    return { filePath: change.filePath, changeType: change.changeType };
                }
                const updatedContent = contentByPath[change.filePath];
                if (updatedContent === undefined) {
                    throw new Error(`Missing content for ${change.filePath}`);
                }
                return {
                    filePath: change.filePath,
                    changeType: change.changeType,
                    updatedContent,
                };
            });

            const response = await fetch('/api/github/agent/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner: githubRepo.owner,
                    repo: githubRepo.repo,
                    baseBranch: selectedBaseBranch,
                    task: agentTask,
                    branchName: buildDeterministicBranchName(agentTask, selectedBaseBranch),
                    commitMessage: gitHubDraft.commitMessage,
                    prTitle: gitHubDraft.prTitle,
                    prBody: gitHubDraft.prBody,
                    changes: changesPayload,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || 'Failed to publish changes');
            }

            const data: { prUrl: string; prNumber: number; branchName: string } = await response.json();
            setGitHubPublishResult(data);
            setGitHubStage('published');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to publish changes';
            setGitHubError(message);
            setGitHubStage('error');
        }
    }, [
        agentAppliedChanges,
        agentTask,
        gitHubDraft,
        githubRepo,
        selectedBaseBranch,
        vfs,
    ]);

    const handlePermissionToggle = useCallback(
        (key: keyof AgentPermissionState) => {
            setAgentPermissions({
                ...agentPermissions,
                [key]: !agentPermissions[key],
            });
        },
        [agentPermissions, setAgentPermissions]
    );

    const handleRevokePermissions = useCallback(() => {
        setPermissionsApproved(false);
        setAgentPlan(null);
        setAgentStepResult(null);
        setAgentCurrentStepIndex(-1);
        setAgentStage('awaiting_permissions');
    }, [
        setAgentCurrentStepIndex,
        setAgentPlan,
        setAgentStage,
        setAgentStepResult,
        setPermissionsApproved,
    ]);

    // Auto-send when a new user message is added (from templates)
    useEffect(() => {
        // Skip if already processing or streaming
        if (processingRef.current || isStreaming || agentMode !== 'chat') {
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
    }, [agentMode, messages, isStreaming, handleSendMessage]);

    const handleTemplateSelect = (template: PromptTemplate) => {
        // Call the parent handler to generate the prompt with context
        if (onTemplateSelect) {
            onTemplateSelect(template);
        }
        
        // Note: The parent handler will add the message to state,
        // and we'll detect it in useEffect to trigger sending
    };

    const handleClearChat = () => {
        setIsClearChatOpen(true);
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        }
    };

    const gitHubBranchName = useMemo(() => {
        if (!agentTask || !selectedBaseBranch) return null;
        return buildDeterministicBranchName(agentTask, selectedBaseBranch);
    }, [agentTask, selectedBaseBranch]);
    const hasGitHubPermissions =
        permissionsApproved &&
        agentPermissions.createBranch &&
        agentPermissions.commit &&
        agentPermissions.push &&
        agentPermissions.openPullRequest;
    const canShowGitHubOps =
        agentMode === 'agent' &&
        agentStage === 'completed' &&
        workspace?.metadata.type === 'github';
    const workspacePermissionOptions: Array<{ key: keyof AgentPermissionState; label: string }> = [
        { key: 'read', label: 'Read files' },
        { key: 'modify', label: 'Modify files' },
        { key: 'create', label: 'Create files' },
        { key: 'delete', label: 'Delete files' },
    ];
    const gitHubPermissionOptions: Array<{ key: keyof AgentPermissionState; label: string }> = [
        { key: 'createBranch', label: 'Create branch' },
        { key: 'commit', label: 'Commit changes' },
        { key: 'push', label: 'Push to remote' },
        { key: 'openPullRequest', label: 'Open pull request' },
    ];
    const isAgentBusy = agentMode === 'agent' && !['idle', 'completed', 'error'].includes(agentStage);
    const handleInputSend = useCallback(
        (message: string) => {
            if (agentMode === 'agent') {
                handleStartAgentTask(message);
            } else {
                handleSendMessage(message);
            }
        },
        [agentMode, handleSendMessage, handleStartAgentTask]
    );
    const inputPlaceholder =
        agentMode === 'agent'
            ? 'Describe the task for the agent...'
            : isStreaming
            ? 'AI is responding...'
            : 'Ask about your code...';

    return (
        <>
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
                        {agentMode === 'agent' ? 'AI Agent' : 'AI Assistant'}
                    </h2>
                </div>
                <div className="flex items-center gap-1">
                    <div className="flex items-center rounded border border-neutral-700 overflow-hidden mr-1">
                        <button
                            onClick={() => handleModeChange('chat')}
                            className={`px-2 py-1 text-xs ${
                                agentMode === 'chat'
                                    ? 'bg-neutral-700 text-neutral-100'
                                    : 'bg-neutral-850 text-neutral-400 hover:text-neutral-200'
                            }`}
                            title="Chat Mode"
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => handleModeChange('agent')}
                            className={`px-2 py-1 text-xs ${
                                agentMode === 'agent'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-neutral-850 text-neutral-400 hover:text-neutral-200'
                            }`}
                            title="Agent Mode"
                        >
                            Agent
                        </button>
                    </div>
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

            {agentMode === 'agent' && (
                <div className="overflow-y-auto px-3 py-3 text-xs text-neutral-300 bg-neutral-900 border-b border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-orange-400 font-semibold tracking-wide">
                            AUTONOMOUS MODE
                        </div>
                        {permissionsApproved && (
                            <button
                                onClick={handleRevokePermissions}
                                className="text-xs text-neutral-400 hover:text-neutral-200"
                            >
                                Revoke Permissions
                            </button>
                        )}
                    </div>

                    {agentTask && (
                        <div className="text-xs text-neutral-300">
                            <span className="font-medium">Task:</span> {agentTask}
                        </div>
                    )}

                    {agentStage === 'idle' && (
                        <div className="text-xs text-neutral-400">
                            Describe a task to begin. The agent will plan before touching code.
                        </div>
                    )}

                    {agentStage === 'awaiting_permissions' && (
                        <div className="space-y-3">
                            <div className="text-xs text-neutral-300">
                                The agent requests task-scoped permissions.
                            </div>
                            <div className="space-y-2">
                                <div className="text-[11px] text-neutral-500">Workspace permissions</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {workspacePermissionOptions.map((perm) => (
                                        <label key={perm.key} className="flex items-center gap-2 text-xs">
                                            <input
                                                type="checkbox"
                                                checked={agentPermissions[perm.key]}
                                                onChange={() => handlePermissionToggle(perm.key)}
                                                className="accent-orange-500"
                                            />
                                            <span>{perm.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="text-[11px] text-neutral-500">GitHub permissions</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {gitHubPermissionOptions.map((perm) => (
                                        <label key={perm.key} className="flex items-center gap-2 text-xs">
                                            <input
                                                type="checkbox"
                                                checked={agentPermissions[perm.key]}
                                                onChange={() => handlePermissionToggle(perm.key)}
                                                className="accent-orange-500"
                                            />
                                            <span>{perm.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleApprovePermissions}
                                disabled={!agentPermissions.read}
                                className="px-3 py-1.5 text-xs rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Approve Permissions
                            </button>
                            <div className="text-[11px] text-neutral-500">
                                Approval gate: the agent cannot plan or execute without explicit permission.
                            </div>
                        </div>
                    )}

                    {agentStage === 'planning' && (
                        <div className="text-xs text-neutral-400">
                            Building a step-by-step plan...
                        </div>
                    )}

                    {agentStage === 'awaiting_plan_approval' && agentPlan && (
                        <div className="space-y-3">
                            <div className="text-xs text-neutral-300">
                                <span className="font-medium">Plan summary:</span> {agentPlan.summary}
                            </div>
                            <div className="space-y-2">
                                {agentPlan.steps.map((step, index) => (
                                    <div key={step.id} className="border border-neutral-800 rounded p-2">
                                        <div className="text-xs text-neutral-200 font-medium">
                                            Step {index + 1}: {step.title}
                                        </div>
                                        <div className="text-[11px] text-neutral-400 mt-1">
                                            {step.description}
                                        </div>
                                        <div className="text-[11px] text-neutral-500 mt-2">
                                            Files to modify: {step.filesToModify.join(', ') || 'none'}
                                        </div>
                                        <div className="text-[11px] text-neutral-500 mt-1">
                                            Files to create: {step.filesToCreate.join(', ') || 'none'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleApprovePlan}
                                    className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                                >
                                    Approve Plan
                                </button>
                                <button
                                    onClick={handleRejectPlan}
                                    className="px-3 py-1.5 text-xs rounded bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
                                >
                                    Reject Plan
                                </button>
                            </div>
                            <div className="text-[11px] text-neutral-500">
                                Approval gate: execution starts only after you approve the plan.
                            </div>
                        </div>
                    )}

                    {agentStage === 'executing' && agentPlan && (
                        <div className="text-xs text-neutral-400">
                            Preparing step {agentCurrentStepIndex + 1} of {agentPlan.steps.length}...
                        </div>
                    )}

                    {agentStage === 'awaiting_step_approval' && agentStepResult && (
                        <div className="space-y-3">
                            <div className="text-xs text-neutral-300">
                                <span className="font-medium">Step result:</span> {agentStepResult.summary}
                            </div>
                            <AgentDiffViewer
                                changes={agentStepResult.changes}
                                originalContentByPath={originalContentByPath}
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleApproveStep}
                                    className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    Apply Step
                                </button>
                                <button
                                    onClick={handleStopExecution}
                                    className="px-3 py-1.5 text-xs rounded bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
                                >
                                    Stop
                                </button>
                            </div>
                            <div className="text-[11px] text-neutral-500">
                                Approval gate: changes apply only after this review.
                            </div>
                        </div>
                    )}

                    {agentStage === 'completed' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-neutral-400">Agent task completed.</span>
                                <button
                                    onClick={resetAgentState}
                                    className="text-xs text-neutral-300 hover:text-white"
                                >
                                    New Task
                                </button>
                            </div>
                            {canShowGitHubOps ? (
                                <div className="space-y-3 border border-neutral-800 rounded p-2">
                                    <div className="text-xs text-orange-400 font-semibold tracking-wide">
                                        GITHUB OPERATIONS
                                    </div>
                                    <div className="text-[11px] text-neutral-500">
                                        Repository:{' '}
                                        {githubRepo ? `${githubRepo.owner}/${githubRepo.repo}` : 'Not available'}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                                        <span className="font-medium text-neutral-300">Base branch:</span>
                                        <select
                                            value={selectedBaseBranch ?? ''}
                                            onChange={(event) => setSelectedBaseBranch(event.target.value)}
                                            disabled={isFetchingBranches || gitHubStage === 'publishing'}
                                            className="bg-neutral-850 border border-neutral-700 rounded px-2 py-1 text-neutral-200"
                                        >
                                            {selectedBaseBranch ? (
                                                <option value={selectedBaseBranch}>{selectedBaseBranch}</option>
                                            ) : (
                                                <option value="">Select branch</option>
                                            )}
                                            {gitHubBranches
                                                .filter((branch) => branch !== selectedBaseBranch)
                                                .map((branch) => (
                                                    <option key={branch} value={branch}>
                                                        {branch}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    {isFetchingBranches && (
                                        <div className="text-[11px] text-neutral-500">
                                            Loading branches...
                                        </div>
                                    )}
                                    {!hasGitHubPermissions && (
                                        <div className="text-[11px] text-neutral-500">
                                            Approve GitHub permissions to publish changes.
                                        </div>
                                    )}
                                    {agentAppliedChanges.length === 0 && (
                                        <div className="text-[11px] text-neutral-500">
                                            No agent changes available to publish.
                                        </div>
                                    )}
                                    {gitHubStage === 'idle' && (
                                        <button
                                            onClick={handlePrepareGitHubDraft}
                                            disabled={
                                                !hasGitHubPermissions ||
                                                agentAppliedChanges.length === 0 ||
                                                !selectedBaseBranch ||
                                                !githubRepo
                                            }
                                            className="px-3 py-1.5 text-xs rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Prepare GitHub Review
                                        </button>
                                    )}
                                    {gitHubStage === 'drafting' && (
                                        <div className="text-xs text-neutral-400">
                                            Generating commit + PR draft...
                                        </div>
                                    )}
                                    {gitHubStage === 'awaiting_review' && gitHubDraft && (
                                        <div className="space-y-3">
                                            <div className="text-xs text-neutral-300">
                                                <span className="font-medium">Branch:</span>{' '}
                                                {gitHubBranchName || 'pending'}
                                            </div>
                                            <div className="text-xs text-neutral-300">
                                                <span className="font-medium">Commit message:</span>
                                            </div>
                                            <div className="text-[11px] text-neutral-200 bg-neutral-900 border border-neutral-800 rounded px-2 py-1">
                                                {gitHubDraft.commitMessage}
                                            </div>
                                            <div className="text-xs text-neutral-300">
                                                <span className="font-medium">PR title:</span> {gitHubDraft.prTitle}
                                            </div>
                                            <div className="text-xs text-neutral-300">
                                                <span className="font-medium">PR description:</span>
                                            </div>
                                            <pre className="p-2 text-[11px] text-neutral-200 bg-neutral-950 border border-neutral-800 rounded whitespace-pre-wrap">
                                                {gitHubDraft.prBody}
                                            </pre>
                                            <AgentDiffViewer
                                                changes={agentAppliedChanges}
                                                originalContentByPath={appliedOriginalContentByPath}
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handlePublishGitHubChanges}
                                                    disabled={!hasGitHubPermissions}
                                                    className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Publish to GitHub
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setGitHubDraft(null);
                                                        setGitHubStage('idle');
                                                    }}
                                                    className="px-3 py-1.5 text-xs rounded bg-neutral-700 text-neutral-200 hover:bg-neutral-600"
                                                >
                                                    Edit Draft
                                                </button>
                                            </div>
                                            <div className="text-[11px] text-neutral-500">
                                                Approval gate: PR creation requires explicit publish.
                                            </div>
                                        </div>
                                    )}
                                    {gitHubStage === 'publishing' && (
                                        <div className="text-xs text-neutral-400">
                                            Publishing to GitHub...
                                        </div>
                                    )}
                                    {gitHubStage === 'published' && gitHubPublishResult && (
                                        <div className="text-xs text-green-400">
                                            PR #{gitHubPublishResult.prNumber} created.{' '}
                                            <a
                                                href={gitHubPublishResult.prUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="underline text-green-300"
                                            >
                                                Open PR
                                            </a>
                                        </div>
                                    )}
                                    {gitHubStage === 'error' && gitHubError && (
                                        <div className="space-y-2">
                                            <div className="text-xs text-red-400">{gitHubError}</div>
                                            <button
                                                onClick={() => {
                                                    setGitHubStage('idle');
                                                    setGitHubError(null);
                                                }}
                                                className="text-xs text-neutral-300 hover:text-white"
                                            >
                                                Back
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-[11px] text-neutral-500">
                                    GitHub operations are available only for GitHub-linked workspaces.
                                </div>
                            )}
                        </div>
                    )}

                    {agentStage === 'error' && (
                        <div className="space-y-2">
                            <div className="text-xs text-red-400">
                                {agentError || 'Agent encountered an error.'}
                            </div>
                            <button
                                onClick={resetAgentState}
                                className="text-xs text-neutral-300 hover:text-white"
                            >
                                Reset Agent
                            </button>
                        </div>
                    )}
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
            {agentMode === 'chat' && (
                <PromptTemplateSelector
                    onSelectTemplate={handleTemplateSelect}
                    disabled={isStreaming}
                />
            )}

            {/* Input */}
            <ChatInput
                onSend={handleInputSend}
                disabled={isStreaming || isAgentBusy}
                placeholder={inputPlaceholder}
            />
        </div>
        <Modal
            isOpen={isClearChatOpen}
            onClose={() => setIsClearChatOpen(false)}
            title="Clear chat"
            footer={
                <>
                    <button
                        onClick={() => setIsClearChatOpen(false)}
                        className="px-3 py-1.5 text-xs rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            clearMessages();
                            setIsClearChatOpen(false);
                        }}
                        className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-500"
                    >
                        Clear chat
                    </button>
                </>
            }
        >
            <p className="text-sm text-neutral-300">
                Clear all chat messages? This cannot be undone.
            </p>
        </Modal>
        </>
    );
}

// Re-export ChatMessage type for use in this component
import { ChatMessage as ChatMessageType } from '@/lib/ai/types';
