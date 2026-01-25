'use client';

import React from 'react';
import { useEditorState } from '@/app/(editor)/stores/editor-state';
import { useFileSystem } from '@/app/(editor)/stores/file-system';
import { X, Columns } from 'lucide-react';

export const EditorTabs = () => {
    const { tabs, activeTabId, setActiveTab, closeTab, isSplit, toggleSplit, activeSecondaryTabId, activePaneForFileOpen } = useEditorState();
    const { files } = useFileSystem();

    if (tabs.length === 0) return null;

    return (
        <div className="flex items-center justify-between bg-neutral-900 border-b border-neutral-800 pr-2">
            <div className="flex items-center overflow-x-auto no-scrollbar">
                {tabs.map((tab) => {
                    const file = files[tab.fileId];
                    if (!file) return null;

                    // Check if tab is active in either pane
                    const isActivePrimary = tab.id === activeTabId;
                    const isActiveSecondary = isSplit && tab.id === activeSecondaryTabId;
                    const isActive = isActivePrimary || isActiveSecondary;

                    // Determine which pane this tab should activate in
                    // Key principle: Don't move tabs between panes on click
                    // Only activate them where they currently are
                    let targetPane: 'primary' | 'secondary' = 'primary';
                    if (isSplit) {
                        // If tab is currently displayed in a pane, activate it there
                        if (isActiveSecondary) {
                            targetPane = 'secondary';
                        } else if (isActivePrimary) {
                            targetPane = 'primary';
                        } else {
                            // Tab is not currently active in any pane
                            // Activate it in the currently active pane
                            targetPane = activePaneForFileOpen;
                        }
                    }

                    // Visual indicator for which pane the tab is in
                    let paneIndicator = null;
                    if (isSplit) {
                        if (isActivePrimary && !isActiveSecondary) {
                            paneIndicator = <span className="text-[10px] bg-blue-600 px-1 rounded ml-1">L</span>;
                        } else if (isActiveSecondary && !isActivePrimary) {
                            paneIndicator = <span className="text-[10px] bg-purple-600 px-1 rounded ml-1">R</span>;
                        }
                    }

                    return (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id, targetPane)}
                            className={`
                group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-r border-neutral-800 min-w-[120px] max-w-[200px] select-none
                ${isActive ? 'bg-neutral-800 text-white border-t-2 border-t-blue-500' : 'text-neutral-500 hover:bg-neutral-800/50'}
              `}
                        >
                            <span className="truncate flex-1 flex items-center">
                                {file.name}
                                {paneIndicator}
                            </span>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                className={`p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-neutral-700 ${isActive ? 'opacity-100' : ''}`}
                            >
                                <X size={13} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={toggleSplit}
                className={`p-1.5 rounded hover:bg-neutral-700 text-neutral-400 transition-colors ${isSplit ? 'text-blue-400 bg-neutral-800' : ''}`}
                title={isSplit ? 'Close Split View' : 'Open Split View (Ctrl+\\)'}
            >
                <Columns size={16} />
            </button>
        </div>
    );
};
