/**
 * Editor State Persistence Hook (Phase 1.5)
 *
 * This module provides utilities to:
 * - Restore editor state from persisted workspace
 * - Capture current editor state for persistence
 * - Sync editor state with workspace autosave
 *
 * Design Principles:
 * - Editor components remain unaware of persistence
 * - Restoration happens automatically on workspace load
 * - State capture is lightweight and non-blocking
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useWorkspace } from './workspace-provider';
import { useEditorState } from './editor-state';
import type { EditorState } from '@/lib/workspace/types';

interface EditorStatePersistenceOptions {
  isPreviewOpen?: boolean;
  onRestorePreview?: (isOpen: boolean) => void;
}

/**
 * Hook to sync editor state with workspace persistence
 *
 * This hook:
 * 1. Restores editor state when workspace is loaded
 * 2. Provides a function to capture current editor state for saving
 * 3. Triggers autosave when editor state changes (tabs, layout)
 */
export function useEditorStatePersistence(options?: EditorStatePersistenceOptions) {
  const { workspace, markDirty, setEditorStateCapture } = useWorkspace();
  const { tabs, activeTabId, activeSecondaryTabId, isSplit, openFile, setActiveTab, toggleSplit, resetState } = useEditorState();
  const previousWorkspaceIdRef = useRef<string | null>(null);
  const isPreviewOpen = options?.isPreviewOpen ?? false;
  const onRestorePreview = options?.onRestorePreview;

  /**
   * Restore editor state from workspace
   *
   * Called automatically when workspace is loaded or changed.
   * Restores:
   * - Split view layout
   * - Open tabs
   * - Active tabs in both panes
   * - Preview panel visibility
   *
   * Note: Cursor positions are restored by Monaco editor when files are opened.
   */
  useEffect(() => {
    const currentWorkspaceId = workspace?.metadata.id ?? null;

    if (previousWorkspaceIdRef.current && currentWorkspaceId && previousWorkspaceIdRef.current !== currentWorkspaceId) {
      resetState();
    }

    previousWorkspaceIdRef.current = currentWorkspaceId;
  }, [resetState, workspace?.metadata.id]);

  useEffect(() => {
    if (!workspace?.editorState || tabs.length > 0) {
      // Skip if no editor state to restore, or if tabs already exist (already restored)
      return;
    }

    const editorState = workspace.editorState;
    console.log('[Editor Persistence] Restoring editor state:', editorState);

    // Restore split view first
    if (editorState.isSplit && !isSplit) {
      toggleSplit();
    }

    // Restore open tabs
    editorState.openTabs.forEach((tab) => {
      openFile(tab.fileId);
    });

    // Restore active tabs (with a small delay to ensure tabs are rendered)
    setTimeout(() => {
      if (editorState.activeTabId) {
        setActiveTab(editorState.activeTabId, 'primary');
      }
      if (editorState.isSplit && editorState.activeSecondaryTabId) {
        setActiveTab(editorState.activeSecondaryTabId, 'secondary');
      }
    }, 50);

    // Restore preview panel visibility
    if (editorState.isPreviewOpen && onRestorePreview) {
      onRestorePreview(true);
    }
  }, [workspace?.metadata.id]); // Only run when workspace changes

  /**
   * Capture current editor state for persistence
   *
   * Returns the current editor state in a format suitable for saving.
   * Called by workspace autosave system.
   */
  const getEditorStateToPersist = useCallback((): EditorState => {
    return {
      openTabs: tabs.map((tab) => ({
        id: tab.id,
        fileId: tab.fileId,
      })),
      activeTabId,
      activeSecondaryTabId,
      isSplit,
      isPreviewOpen,
    };
  }, [tabs, activeTabId, activeSecondaryTabId, isSplit, isPreviewOpen]);

  /**
   * Register the editor state capture function with workspace provider
   */
  useEffect(() => {

    const editorStateFn = () => getEditorStateToPersist();
    setEditorStateCapture(editorStateFn);

    return () => {
      setEditorStateCapture(null);
    };
  }, [getEditorStateToPersist, setEditorStateCapture]);

  /**
   * Trigger autosave when editor state changes
   *
   * This ensures that tab changes and layout changes are persisted.
   */
  useEffect(() => {
    if (!workspace || tabs.length === 0) return;

    // Trigger autosave when tabs, layout, or preview visibility change
    markDirty('LAYOUT_CHANGED');
  }, [tabs.length, activeTabId, activeSecondaryTabId, isSplit, isPreviewOpen]);

  return {
    getEditorStateToPersist,
  };
}
