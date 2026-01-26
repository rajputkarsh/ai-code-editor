'use client';

/**
 * Code Explanation Panel
 * 
 * Displays AI-generated explanations for:
 * - Entire files
 * - Individual functions
 * - Selected code
 * 
 * Phase 2: Read-only, non-destructive analysis.
 */

import React from 'react';
import { X, FileText, Code, MousePointer } from 'lucide-react';

interface CodeExplanationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    explanation: string;
    code: string;
    fileName?: string;
    scope: 'file' | 'function' | 'selection';
}

export const CodeExplanationPanel: React.FC<CodeExplanationPanelProps> = ({
    isOpen,
    onClose,
    explanation,
    code,
    fileName,
    scope,
}) => {
    if (!isOpen) return null;

    const scopeIcons = {
        file: <FileText className="w-4 h-4" />,
        function: <Code className="w-4 h-4" />,
        selection: <MousePointer className="w-4 h-4" />,
    };
    
    const scopeLabels = {
        file: 'File Explanation',
        function: 'Function Explanation',
        selection: 'Code Explanation',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-[90%] max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-700">
                    <div className="flex items-center gap-2">
                        <div className="text-blue-400">
                            {scopeIcons[scope]}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-100">
                                {scopeLabels[scope]}
                            </h2>
                            {fileName && (
                                <p className="text-sm text-neutral-400 mt-0.5">
                                    {fileName}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-neutral-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Code Preview */}
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-neutral-400 mb-2">Code</h3>
                        <pre className="p-4 bg-neutral-800 rounded-lg text-sm font-mono text-neutral-300 overflow-auto max-h-48">
                            {code}
                        </pre>
                    </div>

                    {/* Explanation */}
                    <div>
                        <h3 className="text-sm font-medium text-neutral-400 mb-2">Explanation</h3>
                        <div className="prose prose-invert prose-sm max-w-none">
                            <div className="text-neutral-300 whitespace-pre-wrap">
                                {explanation}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-neutral-700 bg-neutral-800">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

