'use client';

/**
 * Selection State Management
 * Tracks the current code selection in the active editor
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface CodeSelection {
    fileId: string;
    text: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
}

interface SelectionStateContextType {
    selection: CodeSelection | null;
    setSelection: (selection: CodeSelection | null) => void;
    clearSelection: () => void;
    hasSelection: boolean;
}

const SelectionStateContext = createContext<SelectionStateContextType | undefined>(undefined);

export function SelectionStateProvider({ children }: { children: React.ReactNode }) {
    const [selection, setSelectionState] = useState<CodeSelection | null>(null);

    const setSelection = useCallback((selection: CodeSelection | null) => {
        setSelectionState(selection);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectionState(null);
    }, []);

    const hasSelection = useMemo(() => {
        return selection !== null && selection.text.trim().length > 0;
    }, [selection]);

    const value = useMemo(
        () => ({
            selection,
            setSelection,
            clearSelection,
            hasSelection,
        }),
        [selection, setSelection, clearSelection, hasSelection]
    );

    return <SelectionStateContext.Provider value={value}>{children}</SelectionStateContext.Provider>;
}

export function useSelectionState() {
    const context = useContext(SelectionStateContext);
    if (!context) {
        throw new Error('useSelectionState must be used within a SelectionStateProvider');
    }
    return context;
}


