'use client';

import React from 'react';
import { EditorLayout } from '../components/layout/EditorLayout';
import { FileExplorer } from '../components/file-explorer/FileExplorer';
import { EditorTabs } from '../components/editor/EditorTabs';
import { CodeEditor } from '../components/editor/CodeEditor';
import { useEditorState } from '../stores/editor-state';
import { useFileSystem } from '../stores/file-system';

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
            <div className="flex-1 relative flex">
                {/* Pane 1 */}
                <div className={`${isSplit ? 'w-1/2 border-r border-neutral-800' : 'w-full'} h-full`}>
                    {activeTab1 && activeFile1 ? (
                        <CodeEditor key={activeTab1.id} fileId={activeFile1.id} />
                    ) : (isSplit ? renderEmptyState("Active Editor") : (
                        <div className="h-full w-full flex items-center justify-center text-neutral-600 select-none">
                            <div className="text-center">
                                <p className="mb-2 text-lg font-medium">Welcome to AI Code Editor</p>
                                <p className="text-sm">Select a file to start editing</p>
                                <p className="text-xs mt-4 opacity-50">CMD+P to search files (coming soon)</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pane 2 */}
                {isSplit && (
                    <div className="w-1/2 h-full">
                        {activeTab2 && activeFile2 ? (
                            <CodeEditor key={activeTab2.id} fileId={activeFile2.id} />
                        ) : renderEmptyState("Secondary Editor")}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function EditorPage() {
    return (
        <EditorLayout
            sidebar={<FileExplorer />}
            editor={<EditorArea />}
        />
    );
}
