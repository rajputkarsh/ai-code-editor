'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Workspace, VirtualFileSystem, importZipFile, createEmptyWorkspace } from '@/lib/workspace';
import { createWorkspaceAPI, updateWorkspaceAPI, getLatestWorkspaceAPI } from '@/lib/workspace/api-client';
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
  markDirty: () => void; // Trigger autosave
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

/**
 * Debounce delay for autosave (in milliseconds)
 * 
 * This delay prevents excessive API calls during rapid file edits.
 * Autosave is triggered after the user stops making changes for this duration.
 */
const AUTOSAVE_DEBOUNCE_MS = 2000;

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [vfs, setVfs] = useState<VirtualFileSystem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  // Refs for autosave logic
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const isRestoringRef = useRef(false);

  /**
   * Restore workspace on mount
   * 
   * Automatically loads the most recently opened workspace when the editor loads.
   * This provides a seamless experience across sessions and devices.
   */
  useEffect(() => {
    const restoreWorkspace = async () => {
      if (isRestoringRef.current || workspace) return;
      
      isRestoringRef.current = true;
      setIsLoading(true);

      try {
        const latestWorkspace = await getLatestWorkspaceAPI();
        
        if (latestWorkspace) {
          console.log('Restored workspace:', latestWorkspace.metadata.name);
          setWorkspace(latestWorkspace);
          const vfsInstance = new VirtualFileSystem(latestWorkspace.vfs);
          setVfs(vfsInstance);
        }
      } catch (err) {
        console.warn('Failed to restore workspace:', err);
        // Don't show error to user - just silently continue without restoration
      } finally {
        setIsLoading(false);
        isRestoringRef.current = false;
      }
    };

    restoreWorkspace();
  }, []); // Run only once on mount

  /**
   * Autosave effect
   * 
   * Debounced autosave: waits for AUTOSAVE_DEBOUNCE_MS of inactivity before saving.
   * This prevents excessive API calls during rapid edits.
   */
  useEffect(() => {
    if (!isDirty || !workspace || !vfs) {
      return;
    }

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Set new timer for debounced save
    autosaveTimerRef.current = setTimeout(async () => {
      if (isSavingRef.current) return;

      isSavingRef.current = true;
      try {
        const currentVfs = vfs.getStructure();
        await updateWorkspaceAPI(workspace.metadata.id, currentVfs, workspace.editorState);
        setIsDirty(false);
        console.log('Autosaved workspace:', workspace.metadata.name);
      } catch (err) {
        console.error('Autosave failed:', err);
        // Keep isDirty true to retry on next change
      } finally {
        isSavingRef.current = false;
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    // Cleanup timer on unmount or dependency change
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isDirty, workspace, vfs]);

  /**
   * Manual save workspace
   * 
   * Can be called explicitly (e.g., on Cmd+S or before navigation).
   * Also used after creating a new workspace.
   */
  const saveWorkspace = useCallback(async (editorState?: EditorState) => {
    if (!workspace || !vfs || isSavingRef.current) return;

    isSavingRef.current = true;
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

        console.log('Created new workspace:', workspace.metadata.name);
      } else {
        // Existing workspace - update it
        await updateWorkspaceAPI(
          workspace.metadata.id,
          currentVfs,
          editorState
        );
        console.log('Updated workspace:', workspace.metadata.name);
      }

      setIsDirty(false);
      
      // Update local workspace state with editor state
      setWorkspace(workspaceToSave);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save workspace';
      setError(errorMessage);
      console.error('Save error:', err);
    } finally {
      isSavingRef.current = false;
    }
  }, [workspace, vfs]);

  /**
   * Mark workspace as dirty (needs saving)
   * 
   * This triggers the autosave debounce timer.
   * Should be called after any file modification.
   */
  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

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
    }),
    [workspace, vfs, isLoading, error, importFromZip, createNewWorkspace, loadWorkspace, updateWorkspaceName, saveWorkspace, markDirty]
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

