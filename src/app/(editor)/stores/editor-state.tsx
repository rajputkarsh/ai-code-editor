'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface EditorTab {
    id: string; // Creates a unique ID for the tab instance
    fileId: string;
}

interface EditorStateContextType {
    activeTabId: string | null;
    activeSecondaryTabId: string | null; // For split view
    isSplit: boolean;
    tabs: EditorTab[];
    activePaneForFileOpen: 'primary' | 'secondary'; // Which pane to open new files in
    openFile: (fileId: string, pane?: 'primary' | 'secondary') => void;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string, pane?: 'primary' | 'secondary') => void;
    setActivePaneForFileOpen: (pane: 'primary' | 'secondary') => void;
    toggleSplit: () => void;
}

const EditorStateContext = createContext<EditorStateContextType | undefined>(undefined);

export function EditorStateProvider({ children }: { children: React.ReactNode }) {
    const [tabs, setTabs] = useState<EditorTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [activeSecondaryTabId, setActiveSecondaryTabId] = useState<string | null>(null);
    const [isSplit, setIsSplit] = useState(false);
    const [activePaneForFileOpen, setActivePaneForFileOpen] = useState<'primary' | 'secondary'>('primary');

    // Updated openFile to support opening in specific panes
    const openFile = useCallback((fileId: string, pane?: 'primary' | 'secondary') => {
        // Determine which pane to use
        const targetPane = pane || activePaneForFileOpen;
        
        // Check if file is already open in a tab
        const existingTab = tabs.find((t) => t.fileId === fileId);

        if (existingTab) {
            // File already has a tab, activate it in the target pane
            if (targetPane === 'secondary' && isSplit) {
                setActiveSecondaryTabId(existingTab.id);
                // If same tab is in both panes, clear it from primary
                if (existingTab.id === activeTabId) {
                    // Find another tab for primary pane
                    const otherTab = tabs.find(t => t.id !== existingTab.id);
                    setActiveTabId(otherTab ? otherTab.id : null);
                }
            } else {
                setActiveTabId(existingTab.id);
                // If same tab is in both panes, clear it from secondary
                if (isSplit && existingTab.id === activeSecondaryTabId) {
                    // Find another tab for secondary pane
                    const otherTab = tabs.find(t => t.id !== existingTab.id);
                    setActiveSecondaryTabId(otherTab ? otherTab.id : null);
                }
            }
            return;
        }

        // Create new tab and activate it in the target pane
        const newTab: EditorTab = { id: crypto.randomUUID(), fileId };
        setTabs(prev => [...prev, newTab]);
        
        if (targetPane === 'secondary' && isSplit) {
            setActiveSecondaryTabId(newTab.id);
        } else {
            setActiveTabId(newTab.id);
        }
    }, [tabs, activePaneForFileOpen, isSplit, activeTabId, activeSecondaryTabId]);

    const closeTab = useCallback((tabId: string) => {
        setTabs((prev) => {
            const newTabs = prev.filter((t) => t.id !== tabId);

            if (tabId === activeTabId) {
                setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
            }
            if (tabId === activeSecondaryTabId) {
                setActiveSecondaryTabId(null);
            }

            return newTabs;
        });
    }, [activeTabId, activeSecondaryTabId]);

    const setActiveTab = useCallback((tabId: string, pane: 'primary' | 'secondary' = 'primary') => {
        if (pane === 'secondary' && isSplit) {
            setActiveSecondaryTabId(tabId);
            // When user clicks a tab in secondary pane, make secondary the active pane
            setActivePaneForFileOpen('secondary');
            // If same tab is now in both panes, clear it from primary
            if (tabId === activeTabId) {
                const otherTab = tabs.find(t => t.id !== tabId);
                setActiveTabId(otherTab ? otherTab.id : null);
            }
        } else {
            setActiveTabId(tabId);
            // When user clicks a tab in primary pane, make primary the active pane
            setActivePaneForFileOpen('primary');
            // If same tab is now in both panes, clear it from secondary
            if (isSplit && tabId === activeSecondaryTabId) {
                const otherTab = tabs.find(t => t.id !== tabId);
                setActiveSecondaryTabId(otherTab ? otherTab.id : null);
            }
        }
    }, [isSplit, activeTabId, activeSecondaryTabId, tabs]);

    const toggleSplit = useCallback(() => {
        setIsSplit((prev) => {
            const next = !prev;
            if (next) {
                // When enabling split view, set up secondary pane
                if (!activeSecondaryTabId) {
                    // If there are at least 2 tabs, use the second one
                    // Otherwise, use the first tab in both panes
                    if (tabs.length >= 2) {
                        setActiveSecondaryTabId(tabs[1].id);
                    } else if (activeTabId) {
                        setActiveSecondaryTabId(activeTabId);
                    }
                }
                // Set secondary as active pane when opening split
                setActivePaneForFileOpen('secondary');
            } else {
                // When disabling split, reset to primary pane
                setActivePaneForFileOpen('primary');
            }
            return next;
        });
    }, [activeTabId, activeSecondaryTabId, tabs]);

    const value = useMemo(
        () => ({
            activeTabId,
            activeSecondaryTabId,
            isSplit,
            tabs,
            activePaneForFileOpen,
            openFile,
            closeTab,
            setActiveTab,
            setActivePaneForFileOpen,
            toggleSplit
        }),
        [activeTabId, activeSecondaryTabId, isSplit, tabs, activePaneForFileOpen, openFile, closeTab, setActiveTab, toggleSplit]
    );

    return <EditorStateContext.Provider value={value}>{children}</EditorStateContext.Provider>;
}

export function useEditorState() {
    const context = useContext(EditorStateContext);
    if (!context) {
        throw new Error('useEditorState must be used within a EditorStateProvider');
    }
    return context;
}
