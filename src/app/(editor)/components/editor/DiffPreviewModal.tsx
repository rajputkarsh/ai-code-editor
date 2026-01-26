'use client';

/**
 * Diff Preview Modal
 * 
 * Shows side-by-side diff of AI-generated code changes.
 * User must explicitly approve before changes are applied.
 * 
 * Phase 2 Safety: Never auto-applies changes.
 */

import React from 'react';
import { X, Check, Ban } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface DiffPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApprove: () => void;
    onReject: () => void;
    action: string;
    originalCode: string;
    modifiedCode: string;
    fileName: string;
}

export const DiffPreviewModal: React.FC<DiffPreviewModalProps> = ({
    isOpen,
    onClose,
    onApprove,
    onReject,
    action,
    originalCode,
    modifiedCode,
    fileName,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="large">
            <div className="flex flex-col h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-700">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-100">
                            AI Code Action: {action}
                        </h2>
                        <p className="text-sm text-neutral-400 mt-1">
                            {fileName}
                        </p>
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
                        {/* Original Code */}
                        <div className="border-r border-neutral-700 flex flex-col">
                            <div className="px-4 py-2 bg-neutral-800 text-sm font-medium text-neutral-300">
                                Original
                            </div>
                            <pre className="flex-1 overflow-auto p-4 text-sm font-mono bg-neutral-900 text-neutral-300">
                                {originalCode}
                            </pre>
                        </div>

                        {/* Modified Code */}
                        <div className="flex flex-col">
                            <div className="px-4 py-2 bg-green-900/30 text-sm font-medium text-green-400">
                                Modified
                            </div>
                            <pre className="flex-1 overflow-auto p-4 text-sm font-mono bg-neutral-900 text-neutral-300">
                                {modifiedCode}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between p-4 border-t border-neutral-700 bg-neutral-800">
                    <p className="text-sm text-neutral-400">
                        Review the changes before applying
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onReject}
                            className="px-4 py-2 flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors"
                        >
                            <Ban className="w-4 h-4" />
                            Reject
                        </button>
                        <button
                            onClick={onApprove}
                            className="px-4 py-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <Check className="w-4 h-4" />
                            Apply Changes
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

