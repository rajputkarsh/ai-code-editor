'use client';

/**
 * Prompt History Panel
 * 
 * Displays history of AI prompts and allows re-running them.
 * 
 * Phase 2: Session-scoped only (no cloud persistence yet).
 */

import React from 'react';
import { Clock, RotateCw, Trash2, Code, Wand2, MessageSquare } from 'lucide-react';
import { useInlineAI, PromptHistoryEntry } from '@/app/(editor)/stores/inline-ai-state';

interface PromptHistoryProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PromptHistory: React.FC<PromptHistoryProps> = ({ isOpen, onClose }) => {
    const { promptHistory, clearHistory } = useInlineAI();

    if (!isOpen) return null;

    const typeIcons = {
        'inline-completion': <Code className="w-4 h-4" />,
        'code-action': <Wand2 className="w-4 h-4" />,
        'explain': <MessageSquare className="w-4 h-4" />,
    };
    
    const typeLabels = {
        'inline-completion': 'Inline Completion',
        'code-action': 'Code Action',
        'explain': 'Explanation',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-[90%] max-w-3xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-700">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-neutral-100">
                            Prompt History
                        </h2>
                        <span className="text-sm text-neutral-500">
                            ({promptHistory.length} {promptHistory.length === 1 ? 'entry' : 'entries'})
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {promptHistory.length > 0 && (
                            <button
                                onClick={clearHistory}
                                className="px-3 py-1.5 flex items-center gap-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Clear All
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-auto p-4">
                    {promptHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                            <Clock className="w-12 h-12 mb-3 opacity-50" />
                            <p>No prompt history yet</p>
                            <p className="text-sm mt-1">
                                AI interactions will appear here
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {promptHistory.slice().reverse().map((entry) => (
                                <HistoryEntry key={entry.id} entry={entry} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Single history entry component
 */
const HistoryEntry: React.FC<{ entry: PromptHistoryEntry }> = ({ entry }) => {
    const typeIcons = {
        'inline-completion': <Code className="w-4 h-4" />,
        'code-action': <Wand2 className="w-4 h-4" />,
        'explain': <MessageSquare className="w-4 h-4" />,
    };
    
    const typeLabels = {
        'inline-completion': 'Inline Completion',
        'code-action': 'Code Action',
        'explain': 'Explanation',
    };
    
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 hover:border-neutral-600 transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="text-blue-400">
                        {typeIcons[entry.type]}
                    </div>
                    <span className="text-sm font-medium text-neutral-200">
                        {typeLabels[entry.type]}
                    </span>
                </div>
                <span className="text-xs text-neutral-500">
                    {formatTime(entry.timestamp)}
                </span>
            </div>
            
            {/* Prompt */}
            <div className="text-sm text-neutral-300 mb-2">
                {entry.prompt}
            </div>
            
            {/* Metadata */}
            {entry.metadata && (
                <div className="text-xs text-neutral-500">
                    {typeof entry.metadata.fileName === 'string' && (
                        <span>File: {entry.metadata.fileName}</span>
                    )}
                    {typeof entry.metadata.lineNumber === 'number' && (
                        <span className="ml-2">Line: {entry.metadata.lineNumber}</span>
                    )}
                </div>
            )}
            
            {/* Response preview */}
            {entry.response && (
                <details className="mt-2">
                    <summary className="text-xs text-blue-400 cursor-pointer hover:text-blue-300">
                        View response
                    </summary>
                    <pre className="mt-2 p-2 bg-neutral-900 rounded text-xs text-neutral-400 overflow-auto max-h-32">
                        {entry.response.substring(0, 200)}
                        {entry.response.length > 200 && '...'}
                    </pre>
                </details>
            )}
        </div>
    );
};

