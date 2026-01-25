'use client';

import React, { useState } from 'react';
import { EditorLayout } from '../components/layout/EditorLayout';
import { EditorToolbar } from '../components/layout/EditorToolbar';
import { FileExplorer } from '../components/file-explorer/FileExplorer';
import { EditorTabs } from '../components/editor/EditorTabs';
import { LazyCodeEditor } from '../components/editor/LazyCodeEditor';
import { LazyAIChatPanel } from '../components/ai-chat/LazyAIChatPanel';
import { useEditorState } from '../stores/editor-state';
import { useFileSystem } from '../stores/file-system';
import { useAIChatState } from '../stores/ai-chat-state';
import { useSelectionState } from '../stores/selection-state';
import { PromptTemplate } from '@/lib/ai/prompt-templates';
import { ChatContext } from '@/lib/ai/types';
import { detectLanguage } from '@/lib/file-utils';

const EditorArea = () => {
    const { activeTabId, activeSecondaryTabId, isSplit, tabs, activePaneForFileOpen, setActivePaneForFileOpen } = useEditorState();
    const { files } = useFileSystem();

    const activeTab1 = tabs.find(t => t.id === activeTabId);
    const activeFile1 = activeTab1 ? files[activeTab1.fileId] : null;

    const activeTab2 = tabs.find(t => t.id === activeSecondaryTabId);
    const activeFile2 = activeTab2 ? files[activeTab2.fileId] : null;

    const renderEmptyState = (msg: string, pane: 'primary' | 'secondary') => (
        <div 
            className="h-full w-full flex items-center justify-center text-neutral-600 select-none bg-[#1e1e1e]"
        >
            <div className="text-center">
                <p className="mb-2 text-lg font-medium">{msg}</p>
                <p className="text-sm">Select a file to start editing</p>
                {isSplit && (
                    <button
                        onClick={() => setActivePaneForFileOpen(pane)}
                        className={`
                            mt-3 px-3 py-1.5 rounded text-xs transition-colors
                            ${activePaneForFileOpen === pane 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            }
                        `}
                    >
                        {activePaneForFileOpen === pane ? '● Active Pane' : 'Click to Activate'}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e]">
            <EditorTabs />
            {/* Editor panes - side by side on desktop, stacked on mobile/tablet */}
            <div className="flex-1 relative flex flex-col md:flex-row">
                {/* Pane 1 - Primary (Left) */}
                <div 
                    className={`
                        ${isSplit ? 'md:w-1/2 w-full md:border-r border-b md:border-b-0 border-neutral-800' : 'w-full'} 
                        ${isSplit ? 'h-1/2 md:h-full' : 'h-full'}
                        relative
                    `}
                >
                    {/* Active pane indicator - click to activate */}
                    {isSplit && (
                        <button
                            onClick={() => setActivePaneForFileOpen('primary')}
                            className={`
                                absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded shadow-lg transition-all
                                ${activePaneForFileOpen === 'primary'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                                }
                            `}
                        >
                            {activePaneForFileOpen === 'primary' ? '● Left Active' : 'Left'}
                        </button>
                    )}
                    {activeTab1 && activeFile1 ? (
                        <LazyCodeEditor key={activeTab1.id} fileId={activeFile1.id} />
                    ) : (isSplit ? renderEmptyState("Left Pane", 'primary') : (
                        <div className="h-full w-full flex items-center justify-center text-neutral-600 select-none">
                            <div className="text-center px-4">
                                <p className="mb-2 text-lg font-medium">Welcome to AI Code Editor</p>
                                <p className="text-sm">Select a file to start editing</p>
                                <p className="text-xs mt-4 opacity-50">Click the split view button to work on multiple files</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pane 2 - Secondary (Right) - Stacks below Pane 1 on mobile, side-by-side on desktop */}
                {isSplit && (
                    <div 
                        className="md:w-1/2 w-full h-1/2 md:h-full relative"
                    >
                        {/* Active pane indicator - click to activate */}
                        <button
                            onClick={() => setActivePaneForFileOpen('secondary')}
                            className={`
                                absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded shadow-lg transition-all
                                ${activePaneForFileOpen === 'secondary'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                                }
                            `}
                        >
                            {activePaneForFileOpen === 'secondary' ? '● Right Active' : 'Right'}
                        </button>
                        {activeTab2 && activeFile2 ? (
                            <LazyCodeEditor key={activeTab2.id} fileId={activeFile2.id} />
                        ) : renderEmptyState("Right Pane", 'secondary')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function EditorPage() {
    // Panel visibility state (single source of truth)
    const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);

    const { addMessage, setContextInfo } = useAIChatState();
    const { activeTabId, tabs } = useEditorState();
    const { files } = useFileSystem();
    const { selection, hasSelection } = useSelectionState();

    /**
     * Handle template selection from AI chat panel
     * This creates a chat context and sends the prompt
     * Uses selection if available, otherwise uses full file
     */
    const handleTemplateSelect = (template: PromptTemplate) => {
        // Get active file
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) {
            alert('Please open a file first');
            return;
        }

        const activeFile = files[activeTab.fileId];
        if (!activeFile) {
            alert('No active file found');
            return;
        }

        // Create context - use selection if available, otherwise full file
        const context: ChatContext = {
            fileId: activeFile.id,
            fileName: activeFile.name,
            content: activeFile.content || '',
            language: detectLanguage(activeFile.name),
        };

        // Add selection info if available
        if (hasSelection && selection && selection.fileId === activeFile.id) {
            context.selection = {
                text: selection.text,
                startLine: selection.startLine,
                endLine: selection.endLine,
            };
        }

        // Generate prompt from template
        const prompt = template.generatePrompt(context);

        // Set context info with selection details
        const contextInfoText = context.selection
            ? `${activeFile.name}, lines ${context.selection.startLine}-${context.selection.endLine}`
            : `${activeFile.name} (full file)`;
        setContextInfo(contextInfoText);

        // Add user message with metadata
        addMessage({
            role: 'user',
            content: prompt,
            contextMetadata: {
                fileName: activeFile.name,
                language: context.language,
                isSelection: !!context.selection,
                lineRange: context.selection
                    ? {
                          start: context.selection.startLine,
                          end: context.selection.endLine,
                      }
                    : undefined,
            },
        });

        // Open panel if not already open
        setIsAIChatOpen(true);
    };

    return (
        <EditorLayout
            sidebar={<FileExplorer />}
            editor={
                <div className="flex flex-col h-full">
                    {/* VS Code-style Toolbar */}
                    <EditorToolbar
                        isFileExplorerOpen={isFileExplorerOpen}
                        isAIChatOpen={isAIChatOpen}
                        onFileExplorerToggle={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
                        onAIChatToggle={() => setIsAIChatOpen(!isAIChatOpen)}
                    />
                    <EditorArea />
                </div>
            }
            aiChat={isAIChatOpen && (
                <LazyAIChatPanel 
                    onTemplateSelect={handleTemplateSelect}
                    onClose={() => setIsAIChatOpen(false)}
                />
            )}
            isSidebarOpen={isFileExplorerOpen}
            onSidebarToggle={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
        />
    );
}
