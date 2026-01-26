'use client';

/**
 * File Diff Modal
 * 
 * Phase 2: Shows diff between local file and GitHub HEAD.
 * Read-only comparison for GitHub-linked workspaces.
 */

import React from 'react';
import { X, GitCompare } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { GitFileStatus } from '@/lib/workspace/git-status';

interface FileDiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    originalContent: string;
    currentContent: string;
    status: GitFileStatus;
}

export const FileDiffModal: React.FC<FileDiffModalProps> = ({
    isOpen,
    onClose,
    fileName,
    originalContent,
    currentContent,
    status,
}) => {
    const statusLabels = {
        modified: 'Modified',
        added: 'Added (New File)',
        deleted: 'Deleted',
        untracked: 'Untracked',
        unmodified: 'Unmodified',
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="large">
            <div className="flex flex-col h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-700">
                    <div className="flex items-center gap-2">
                        <GitCompare className="w-5 h-5 text-blue-400" />
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-100">
                                Diff vs GitHub HEAD
                            </h2>
                            <p className="text-sm text-neutral-400 mt-0.5">
                                {fileName} · <span className="text-yellow-400">{statusLabels[status]}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-neutral-400" />
                    </button>
                </div>

                {/* Diff View */}
                <div className="flex-1 overflow-hidden">
                    <div className="grid grid-cols-2 h-full">
                        {/* Original (GitHub HEAD) */}
                        <div className="border-r border-neutral-700 flex flex-col">
                            <div className="px-4 py-2 bg-neutral-800 text-sm font-medium text-neutral-300 flex items-center justify-between">
                                <span>GitHub HEAD</span>
                                <span className="text-xs text-neutral-500">
                                    {originalContent.split('\n').length} lines
                                </span>
                            </div>
                            <pre className="flex-1 overflow-auto p-4 text-sm font-mono bg-neutral-900 text-neutral-300 leading-relaxed">
                                {status === 'added' ? (
                                    <div className="text-neutral-600 italic">
                                        (File does not exist in GitHub)
                                    </div>
                                ) : (
                                    originalContent
                                )}
                            </pre>
                        </div>

                        {/* Current (Local) */}
                        <div className="flex flex-col">
                            <div className="px-4 py-2 bg-blue-900/30 text-sm font-medium text-blue-400 flex items-center justify-between">
                                <span>Local (Modified)</span>
                                <span className="text-xs text-neutral-500">
                                    {currentContent.split('\n').length} lines
                                </span>
                            </div>
                            <pre className="flex-1 overflow-auto p-4 text-sm font-mono bg-neutral-900 text-neutral-300 leading-relaxed">
                                {status === 'deleted' ? (
                                    <div className="text-red-400 italic">
                                        (File deleted locally)
                                    </div>
                                ) : (
                                    currentContent
                                )}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-neutral-700 bg-neutral-800">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-neutral-400">
                            This is a read-only comparison. Changes are stored locally.
                        </p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

