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
    openFile: (fileId: string) => void;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string, pane?: 'primary' | 'secondary') => void;
    toggleSplit: () => void;
}

const EditorStateContext = createContext<EditorStateContextType | undefined>(undefined);

export function EditorStateProvider({ children }: { children: React.ReactNode }) {
    const [tabs, setTabs] = useState<EditorTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [activeSecondaryTabId, setActiveSecondaryTabId] = useState<string | null>(null);
    const [isSplit, setIsSplit] = useState(false);

    // Correct implementation of openFile using synchronous updates
    const openFile = useCallback((fileId: string) => {
        // Check existing tabs synchronously from current state
        const existingTab = tabs.find((t) => t.fileId === fileId);

        if (existingTab) {
            setActiveTabId(existingTab.id);
            return;
        }

        const newTab: EditorTab = { id: crypto.randomUUID(), fileId };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
    }, [tabs]);

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
        } else {
            setActiveTabId(tabId);
        }
    }, [isSplit]);

    const toggleSplit = useCallback(() => {
        setIsSplit((prev) => {
            const next = !prev;
            if (next && !activeSecondaryTabId && activeTabId) {
                // Simplified: Copy active tab to secondary when opening split
                setActiveSecondaryTabId(activeTabId);
            }
            return next;
        });
    }, [activeTabId, activeSecondaryTabId]);

    const value = useMemo(
        () => ({
            activeTabId,
            activeSecondaryTabId,
            isSplit,
            tabs,
            openFile,
            closeTab,
            setActiveTab,
            toggleSplit
        }),
        [activeTabId, activeSecondaryTabId, isSplit, tabs, openFile, closeTab, setActiveTab, toggleSplit]
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
