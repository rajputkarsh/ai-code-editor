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
import { PanelLeft, MessageSquare } from 'lucide-react';

interface EditorToolbarProps {
    isFileExplorerOpen: boolean;
    isAIChatOpen: boolean;
    onFileExplorerToggle: () => void;
    onAIChatToggle: () => void;
}

export function EditorToolbar({
    isFileExplorerOpen,
    isAIChatOpen,
    onFileExplorerToggle,
    onAIChatToggle,
}: EditorToolbarProps) {
    return (
        <div className="flex items-center justify-between h-8 px-4 bg-[#1e1e1e] border-b border-neutral-800 text-neutral-300">
            {/* Left section - could be used for breadcrumbs, file path, etc. */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">
                    {/* Reserved for file path / breadcrumbs */}
                </span>
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
            </div>
        </div>
    );
}

