'use client';

import React from 'react';
import { EditorLayout } from '../components/layout/EditorLayout';
import { FileExplorer } from '../components/file-explorer/FileExplorer';
import { EditorTabs } from '../components/editor/EditorTabs';
import { LazyCodeEditor } from '../components/editor/LazyCodeEditor';
import { LazyAIChatPanel } from '../components/ai-chat/LazyAIChatPanel';
import { useEditorState } from '../stores/editor-state';
import { useFileSystem } from '../stores/file-system';
import { useAIChatState } from '../stores/ai-chat-state';
import { useSelectionState } from '../stores/selection-state';
import { MessageSquare } from 'lucide-react';
import { PromptTemplate } from '@/lib/ai/prompt-templates';
import { ChatContext } from '@/lib/ai/types';
import { detectLanguage } from '@/lib/file-utils';

const EditorArea = () => {
    const { activeTabId, activeSecondaryTabId, isSplit, tabs } = useEditorState();
    const { files } = useFileSystem();

    const activeTab1 = tabs.find(t => t.id === activeTabId);
    const activeFile1 = activeTab1 ? files[activeTab1.fileId] : null;

    const activeTab2 = tabs.find(t => t.id === activeSecondaryTabId);
    const activeFile2 = activeTab2 ? files[activeTab2.fileId] : null;

    const renderEmptyState = (msg: string) => (
        <div className="h-full w-full flex items-center justify-center text-neutral-600 select-none bg-[#1e1e1e]">
            <div className="text-center">
                <p className="mb-2 text-lg font-medium">{msg}</p>
                <p className="text-sm">Select a file to start editing</p>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e]">
            <EditorTabs />
            {/* Editor panes - side by side on desktop, stacked on mobile/tablet */}
            <div className="flex-1 relative flex flex-col md:flex-row">
                {/* Pane 1 */}
                <div className={`
                    ${isSplit ? 'md:w-1/2 w-full md:border-r border-b md:border-b-0 border-neutral-800' : 'w-full'} 
                    ${isSplit ? 'h-1/2 md:h-full' : 'h-full'}
                `}>
                    {activeTab1 && activeFile1 ? (
                        <LazyCodeEditor key={activeTab1.id} fileId={activeFile1.id} />
                    ) : (isSplit ? renderEmptyState("Active Editor") : (
                        <div className="h-full w-full flex items-center justify-center text-neutral-600 select-none">
                            <div className="text-center px-4">
                                <p className="mb-2 text-lg font-medium">Welcome to AI Code Editor</p>
                                <p className="text-sm">Select a file to start editing</p>
                                <p className="text-xs mt-4 opacity-50">CMD+P to search files (coming soon)</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pane 2 - Stacks below Pane 1 on mobile, side-by-side on desktop */}
                {isSplit && (
                    <div className="md:w-1/2 w-full h-1/2 md:h-full">
                        {activeTab2 && activeFile2 ? (
                            <LazyCodeEditor key={activeTab2.id} fileId={activeFile2.id} />
                        ) : renderEmptyState("Secondary Editor")}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function EditorPage() {
    const { addMessage, openPanel, setContextInfo, isPanelOpen } = useAIChatState();
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
        openPanel();
    };

    return (
        <EditorLayout
            sidebar={<FileExplorer />}
            editor={
                <div className="flex flex-col h-full">
                    <EditorArea />
                    {/* AI Chat Toggle Button */}
                    {!isPanelOpen && (
                        <button
                            onClick={openPanel}
                            className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg transition-colors"
                            title="Open AI Chat"
                        >
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-sm font-medium">AI Assistant</span>
                        </button>
                    )}
                </div>
            }
            aiChat={<LazyAIChatPanel onTemplateSelect={handleTemplateSelect} />}
        />
    );
}
