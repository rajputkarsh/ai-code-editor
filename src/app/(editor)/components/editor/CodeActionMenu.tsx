'use client';

/**
 * AI Code Action Context Menu
 * 
 * Provides right-click menu for AI-powered code actions:
 * - Refactor function
 * - Convert to TypeScript
 * - Add comments
 * - Improve performance
 * 
 * Phase 2: All actions show diff preview before applying.
 */

import React, { useState } from 'react';
import { Wand2, FileCode, MessageSquare, Zap } from 'lucide-react';

export interface CodeAction {
    id: 'refactor' | 'convert-to-typescript' | 'add-comments' | 'optimize';
    label: string;
    icon: React.ReactNode;
    description: string;
}

export const CODE_ACTIONS: CodeAction[] = [
    {
        id: 'refactor',
        label: 'Refactor Code',
        icon: <Wand2 className="w-4 h-4" />,
        description: 'Improve code readability and maintainability',
    },
    {
        id: 'convert-to-typescript',
        label: 'Convert to TypeScript',
        icon: <FileCode className="w-4 h-4" />,
        description: 'Add TypeScript type annotations',
    },
    {
        id: 'add-comments',
        label: 'Add Comments',
        icon: <MessageSquare className="w-4 h-4" />,
        description: 'Add explanatory comments to code',
    },
    {
        id: 'optimize',
        label: 'Optimize Performance',
        icon: <Zap className="w-4 h-4" />,
        description: 'Improve code performance',
    },
];

interface CodeActionMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    onClose: () => void;
    onActionSelect: (actionId: string) => void;
}

export const CodeActionMenu: React.FC<CodeActionMenuProps> = ({
    isOpen,
    position,
    onClose,
    onActionSelect,
}) => {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop to close menu */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />
            
            {/* Menu */}
            <div
                className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-2 min-w-[240px]"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                }}
            >
                <div className="px-3 py-2 text-xs font-semibold text-neutral-400 border-b border-neutral-800">
                    AI Code Actions
                </div>
                
                {CODE_ACTIONS.map((action) => (
                    <button
                        key={action.id}
                        className="w-full px-3 py-2 flex items-start gap-3 hover:bg-neutral-800 transition-colors text-left"
                        onClick={() => {
                            onActionSelect(action.id);
                            onClose();
                        }}
                    >
                        <div className="text-blue-400 mt-0.5">
                            {action.icon}
                        </div>
                        <div className="flex-1">
                            <div className="text-sm text-neutral-100 font-medium">
                                {action.label}
                            </div>
                            <div className="text-xs text-neutral-500">
                                {action.description}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </>
    );
};

