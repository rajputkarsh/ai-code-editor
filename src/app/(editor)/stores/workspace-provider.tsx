'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Workspace, VirtualFileSystem, importZipFile, createEmptyWorkspace } from '@/lib/workspace';
import { createWorkspaceAPI, updateWorkspaceAPI, getLatestWorkspaceAPI } from '@/lib/workspace/api-client';
import { createAutosaveManager, type AutosaveManager } from '@/lib/workspace/autosave';
import type { EditorState } from '@/lib/workspace/types';

interface WorkspaceContextType {
  workspace: Workspace | null;
  vfs: VirtualFileSystem | null;
  isLoading: boolean;
  error: string | null;
  importFromZip: (file: File) => Promise<void>;
  createNewWorkspace: (name?: string) => void;
  loadWorkspace: (workspace: Workspace) => void;
  updateWorkspaceName: (name: string) => void;
  saveWorkspace: (editorState?: EditorState) => Promise<void>;
  markDirty: (eventType?: 'FILE_CONTENT_CHANGED' | 'FILE_CREATED' | 'FILE_RENAMED' | 'FILE_DELETED' | 'TAB_CHANGED' | 'LAYOUT_CHANGED') => void; // Trigger autosave
  getEditorStateCapture: (() => EditorState | undefined) | null; // Function to capture current editor state
  setEditorStateCapture: (fn: (() => EditorState | undefined) | null) => void; // Register editor state capture function
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [vfs, setVfs] = useState<VirtualFileSystem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Phase 1.6: Enhanced autosave using AutosaveManager
  const autosaveManagerRef = useRef<AutosaveManager | null>(null);
  const isRestoringRef = useRef(false);
  
  // Phase 1.5: Editor state capture function (set by editor-persistence hook)
  const [editorStateCaptureFn, setEditorStateCaptureFn] = useState<(() => EditorState | undefined) | null>(null);

  /**
   * Initialize autosave manager
   * 
   * Phase 1.6: Creates AutosaveManager instance when workspace is loaded.
   */
  useEffect(() => {
    if (!workspace || !vfs) return;

    // Create autosave manager with callback
    const autosaveCallback = async (vfsStructure: any, editorState?: EditorState) => {
      try {
        await updateWorkspaceAPI(workspace.metadata.id, vfsStructure, editorState);
        console.log('[Autosave] Saved workspace:', workspace.metadata.name);
      } catch (err) {
        console.error('[Autosave] Failed to save workspace:', err);
        throw err;
      }
    };

    autosaveManagerRef.current = createAutosaveManager(autosaveCallback, {
      debounceMs: 2000,
      verbose: false,
    });

    // Cleanup on unmount
    return () => {
      if (autosaveManagerRef.current) {
        autosaveManagerRef.current.destroy();
        autosaveManagerRef.current = null;
      }
    };
  }, [workspace, vfs]);

  /**
   * Restore workspace on mount
   * 
   * Phase 1.6 Draft Recovery:
   * Automatically loads the most recently opened workspace when the editor loads.
   * If no workspace exists, creates a new default workspace.
   * This provides seamless experience across sessions and devices.
   */
  useEffect(() => {
    const restoreWorkspace = async () => {
      if (isRestoringRef.current || workspace) return;
      
      isRestoringRef.current = true;
      setIsLoading(true);

      try {
        const latestWorkspace = await getLatestWorkspaceAPI();
        
        if (latestWorkspace) {
          console.log('[Phase 1.6] Restored workspace:', latestWorkspace.metadata.name);
          setWorkspace(latestWorkspace);
          const vfsInstance = new VirtualFileSystem(latestWorkspace.vfs);
          setVfs(vfsInstance);
        } else {
          // No workspace exists - create a new default workspace
          console.log('[Phase 1.6] No workspace found, creating new workspace...');
          const newWorkspace = createEmptyWorkspace('My Project');
          setWorkspace(newWorkspace);
          const vfsInstance = new VirtualFileSystem(newWorkspace.vfs);
          setVfs(vfsInstance);
          
          // Save the new workspace to the server
          try {
            await createWorkspaceAPI({
              id: newWorkspace.metadata.id,
              name: newWorkspace.metadata.name,
              source: newWorkspace.metadata.source,
              vfs: newWorkspace.vfs,
            });
            console.log('[Phase 1.6] Created new workspace:', newWorkspace.metadata.name);
          } catch (saveErr) {
            console.warn('[Phase 1.6] Failed to save new workspace (will try on first edit):', saveErr);
          }
        }
      } catch (err) {
        console.warn('[Phase 1.6] Failed to restore workspace:', err);
        // Create a fallback workspace even if API fails
        const fallbackWorkspace = createEmptyWorkspace('My Project');
        setWorkspace(fallbackWorkspace);
        const vfsInstance = new VirtualFileSystem(fallbackWorkspace.vfs);
        setVfs(vfsInstance);
      } finally {
        setIsLoading(false);
        isRestoringRef.current = false;
      }
    };

    restoreWorkspace();
  }, []); // Run only once on mount


  /**
   * Manual save workspace
   * 
   * Phase 1.6: Uses AutosaveManager for force save.
   * Can be called explicitly (e.g., on Cmd+S or before navigation).
   * Also used after creating a new workspace.
   */
  const saveWorkspace = useCallback(async (editorState?: EditorState) => {
    if (!workspace || !vfs) return;

    setError(null);

    try {
      const currentVfs = vfs.getStructure();
      
      // Update workspace with latest editor state if provided
      const workspaceToSave: Workspace = {
        ...workspace,
        vfs: currentVfs,
        editorState: editorState || workspace.editorState,
      };

      // Check if workspace already exists on server
      if (!workspace.metadata.userId) {
        // New workspace - create it
        const result = await createWorkspaceAPI({
          id: workspace.metadata.id,
          name: workspace.metadata.name,
          source: workspace.metadata.source,
          vfs: currentVfs,
          editorState: editorState,
        });

        if ('error' in result) {
          throw new Error(result.error);
        }

        console.log('[Phase 1.6] Created new workspace:', workspace.metadata.name);
      } else {
        // Existing workspace - use autosave manager for force save
        if (autosaveManagerRef.current) {
          await autosaveManagerRef.current.forceSave(currentVfs, editorState);
        } else {
          // Fallback if autosave manager not initialized
          await updateWorkspaceAPI(workspace.metadata.id, currentVfs, editorState);
        }
        console.log('[Phase 1.6] Saved workspace:', workspace.metadata.name);
      }
      
      // Update local workspace state with editor state
      setWorkspace(workspaceToSave);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save workspace';
      setError(errorMessage);
      console.error('[Phase 1.6] Save error:', err);
    }
  }, [workspace, vfs]);

  /**
   * Mark workspace as dirty (needs saving)
   * 
   * Phase 1.5/1.6: Triggers autosave using AutosaveManager.
   * Should be called after any file modification or editor state change.
   * 
   * @param eventType - Type of change that triggered the save
   */
  const markDirty = useCallback((eventType: 'FILE_CONTENT_CHANGED' | 'FILE_CREATED' | 'FILE_RENAMED' | 'FILE_DELETED' | 'TAB_CHANGED' | 'LAYOUT_CHANGED' = 'FILE_CONTENT_CHANGED') => {
    if (!workspace || !vfs || !autosaveManagerRef.current) return;

    const currentVfs = vfs.getStructure();
    
    // Capture current editor state if capture function is registered
    const currentEditorState = editorStateCaptureFn ? editorStateCaptureFn() : workspace.editorState;
    
    autosaveManagerRef.current.trigger(
      {
        type: eventType,
        timestamp: Date.now(),
      },
      currentVfs,
      currentEditorState
    );
  }, [workspace, vfs, editorStateCaptureFn]);

  /**
   * Import workspace from ZIP file
   */
  const importFromZip = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const importedWorkspace = await importZipFile(file);
      setWorkspace(importedWorkspace);
      
      // Create VFS instance from imported structure
      const vfsInstance = new VirtualFileSystem(importedWorkspace.vfs);
      setVfs(vfsInstance);
      
      // Save imported workspace to server
      await saveWorkspace();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import ZIP file';
      setError(errorMessage);
      console.error('ZIP import error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [saveWorkspace]);

  /**
   * Create a new empty workspace
   */
  const createNewWorkspace = useCallback(async (name: string = 'New Project') => {
    const newWorkspace = createEmptyWorkspace(name);
    setWorkspace(newWorkspace);
    
    const vfsInstance = new VirtualFileSystem(newWorkspace.vfs);
    setVfs(vfsInstance);
    setError(null);
    
    // Save new workspace to server
    await saveWorkspace();
  }, [saveWorkspace]);

  /**
   * Load an existing workspace
   */
  const loadWorkspace = useCallback((workspace: Workspace) => {
    setWorkspace(workspace);
    const vfsInstance = new VirtualFileSystem(workspace.vfs);
    setVfs(vfsInstance);
    setError(null);
  }, []);

  /**
   * Update workspace name
   */
  const updateWorkspaceName = useCallback((name: string) => {
    setWorkspace((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          name,
        },
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      workspace,
      vfs,
      isLoading,
      error,
      importFromZip,
      createNewWorkspace,
      loadWorkspace,
      updateWorkspaceName,
      saveWorkspace,
      markDirty,
      getEditorStateCapture: editorStateCaptureFn,
      setEditorStateCapture: setEditorStateCaptureFn,
    }),
    [workspace, vfs, isLoading, error, importFromZip, createNewWorkspace, loadWorkspace, updateWorkspaceName, saveWorkspace, markDirty, editorStateCaptureFn]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

