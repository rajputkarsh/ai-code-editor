'use client';

/**
 * EditorToolbar Component
 * VS Code-style toolbar with panel toggle buttons
 * 
 * Features:
 * - Toggle file explorer visibility
 * - Toggle AI assistant panel visibility
 * - Clean, minimal design matching editor theme
 */

import React from 'react';
import { PanelLeft, MessageSquare, Wand2, Clock, FileText, Github, Terminal, Monitor } from 'lucide-react';
import { WorkspaceSelector } from './WorkspaceSelector';

interface EditorToolbarProps {
    isFileExplorerOpen: boolean;
    isAIChatOpen: boolean;
    isTerminalOpen: boolean;
    isPreviewOpen: boolean;
    onFileExplorerToggle: () => void;
    onAIChatToggle: () => void;
    onTerminalToggle: () => void;
    onPreviewToggle: () => void;
    onCodeActionsClick?: () => void;
    onPromptHistoryClick?: () => void;
    onExplainClick?: () => void;
    onGitHubClick?: () => void;
}

export function EditorToolbar({
    isFileExplorerOpen,
    isAIChatOpen,
    isTerminalOpen,
    isPreviewOpen,
    onFileExplorerToggle,
    onAIChatToggle,
    onTerminalToggle,
    onPreviewToggle,
    onCodeActionsClick,
    onPromptHistoryClick,
    onExplainClick,
    onGitHubClick,
}: EditorToolbarProps) {
    return (
        <div className="flex items-center justify-between h-8 px-4 bg-[#1e1e1e] border-b border-neutral-800 text-neutral-300">
            {/* Left section - AI Actions */}
            <div className="flex items-center gap-2">
                <WorkspaceSelector />
                {onCodeActionsClick && (
                    <button
                        onClick={onCodeActionsClick}
                        className="p-1 rounded-md transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800"
                        title="AI Code Actions"
                    >
                        <Wand2 className="w-3 h-3" />
                    </button>
                )}
                {onExplainClick && (
                    <button
                        onClick={onExplainClick}
                        className="p-1 rounded-md transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800"
                        title="Explain Code"
                    >
                        <FileText className="w-3 h-3" />
                    </button>
                )}
                {onPromptHistoryClick && (
                    <button
                        onClick={onPromptHistoryClick}
                        className="p-1 rounded-md transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800"
                        title="Prompt History"
                    >
                        <Clock className="w-3 h-3" />
                    </button>
                )}
                <div className="w-px h-4 bg-neutral-700 mx-1" />
                {onGitHubClick && (
                    <button
                        onClick={onGitHubClick}
                        className="p-1 rounded-md transition-colors text-neutral-400 hover:text-white hover:bg-neutral-800"
                        title="GitHub"
                    >
                        <Github className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Right section - Panel toggles */}
            <div className="flex items-center gap-1">
                {/* File Explorer Toggle */}
                <button
                    onClick={onFileExplorerToggle}
                    className={`p-1 rounded-md transition-colors ${isFileExplorerOpen ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                    title={isFileExplorerOpen ? 'Hide file explorer' : 'Show file explorer'}
                    aria-label={isFileExplorerOpen ? 'Hide file explorer' : 'Show file explorer'}
                >
                    <PanelLeft className="w-3 h-3" />
                </button>

                {/* AI Assistant Toggle */}
                <button
                    onClick={onAIChatToggle}
                    className={`p-1 rounded-md transition-colors ${isAIChatOpen ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                    title={isAIChatOpen ? 'Hide AI assistant' : 'Show AI assistant'}
                    aria-label={isAIChatOpen ? 'Hide AI assistant' : 'Show AI assistant'}
                >
                    <MessageSquare className="w-3 h-3" />
                </button>

                {/* Terminal Toggle */}
                <button
                    onClick={onTerminalToggle}
                    className={`p-1 rounded-md transition-colors ${isTerminalOpen ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                    title={isTerminalOpen ? 'Hide terminal' : 'Show terminal'}
                    aria-label={isTerminalOpen ? 'Hide terminal' : 'Show terminal'}
                >
                    <Terminal className="w-3 h-3" />
                </button>

                {/* Preview Toggle */}
                <button
                    onClick={onPreviewToggle}
                    className={`p-1 rounded-md transition-colors ${isPreviewOpen ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                    title={isPreviewOpen ? 'Hide preview' : 'Show preview'}
                    aria-label={isPreviewOpen ? 'Hide preview' : 'Show preview'}
                >
                    <Monitor className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

