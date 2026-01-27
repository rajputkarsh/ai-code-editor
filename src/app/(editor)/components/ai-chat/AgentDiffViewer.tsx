import React from 'react';
import type { AgentStepChange } from '@/lib/ai/agent/types';

interface AgentDiffViewerProps {
    changes: AgentStepChange[];
    originalContentByPath: Record<string, string>;
}

export function AgentDiffViewer({ changes, originalContentByPath }: AgentDiffViewerProps) {
    if (changes.length === 0) {
        return (
            <div className="text-xs text-neutral-400">
                No file changes proposed for this step.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {changes.map((change) => {
                const originalContent = originalContentByPath[change.filePath] ?? '';
                const updatedContent = change.updatedContent ?? '';
                return (
                    <div
                        key={`${change.changeType}:${change.filePath}`}
                        className="border border-neutral-800 rounded-lg overflow-hidden"
                    >
                        <div className="flex items-center justify-between px-3 py-2 bg-neutral-850 border-b border-neutral-800">
                            <div className="text-sm font-medium text-neutral-200">
                                {change.filePath}
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded bg-neutral-700 text-neutral-200 uppercase">
                                {change.changeType}
                            </span>
                        </div>
                        <div className="grid grid-cols-2">
                            <div className="border-r border-neutral-800">
                                <div className="px-3 py-1 text-xs text-neutral-400 bg-neutral-900">
                                    Before
                                </div>
                                <pre className="p-3 text-xs font-mono text-neutral-200 bg-neutral-950 whitespace-pre-wrap">
                                    {change.changeType === 'create'
                                        ? '(new file)'
                                        : originalContent || '(empty)'}
                                </pre>
                            </div>
                            <div>
                                <div className="px-3 py-1 text-xs text-neutral-400 bg-neutral-900">
                                    After
                                </div>
                                <pre className="p-3 text-xs font-mono text-neutral-200 bg-neutral-950 whitespace-pre-wrap">
                                    {change.changeType === 'delete'
                                        ? '(deleted)'
                                        : updatedContent || '(empty)'}
                                </pre>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

