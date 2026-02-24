'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Workspace, VirtualFileSystem, importZipFile, createEmptyWorkspace } from '@/lib/workspace';
import {
  createWorkspaceAPI,
  updateWorkspaceAPI,
  listWorkspacesAPI,
  loadWorkspaceAPI,
  renameWorkspaceAPI,
  deleteWorkspaceAPI,
  activateWorkspaceAPI,
} from '@/lib/workspace/api-client';
import { createAutosaveManager, type AutosaveManager, type AutosaveState } from '@/lib/workspace/autosave';
import type { EditorState, WorkspaceType, WorkspaceSource, GitHubMetadata } from '@/lib/workspace/types';

interface WorkspaceSummary {
  id: string;
  name: string;
  type: WorkspaceType;
  source: WorkspaceSource;
  teamId?: string | null;
  createdAt: Date;
  lastOpenedAt: Date;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  vfs: VirtualFileSystem | null;
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  refreshWorkspaces: () => Promise<{
    workspaces: WorkspaceSummary[];
    activeWorkspaceId: string | null;
  }>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  importFromZip: (file: File) => Promise<void>;
  createNewWorkspace: (
    name?: string,
    options?: {
      save?: boolean;
      type?: WorkspaceType;
      source?: WorkspaceSource;
      githubMetadata?: GitHubMetadata;
    }
  ) => Promise<{
    workspace: Workspace;
    vfs: VirtualFileSystem;
  }>;
  loadWorkspace: (workspace: Workspace) => void;
  updateWorkspaceName: (name: string) => void;
  saveWorkspace: (editorState?: EditorState) => Promise<void>;
  markDirty: (eventType?: 'FILE_CONTENT_CHANGED' | 'FILE_CREATED' | 'FILE_RENAMED' | 'FILE_DELETED' | 'TAB_CHANGED' | 'LAYOUT_CHANGED', fileId?: string) => void; // Trigger autosave
  getEditorStateCapture: (() => EditorState | undefined) | null; // Function to capture current editor state
  setEditorStateCapture: (fn: (() => EditorState | undefined) | null) => void; // Register editor state capture function
  autosaveState: AutosaveState; // Current autosave state for UI indicators
  dirtyFiles: Set<string>; // Track which files have unsaved changes
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [vfs, setVfs] = useState<VirtualFileSystem | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  // Active workspace is server-side source of truth for scoping operations.
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Phase 1.6: Enhanced autosave using AutosaveManager
  const autosaveManagerRef = useRef<AutosaveManager | null>(null);
  const isRestoringRef = useRef(false);
  const workspaceRef = useRef<Workspace | null>(null);
  const vfsRef = useRef<VirtualFileSystem | null>(null);
  const persistedWorkspaceIdsRef = useRef<Set<string>>(new Set());
  
  // Phase 1.5: Editor state capture function (set by editor-persistence hook)
  const [editorStateCaptureFn, setEditorStateCaptureFn] = useState<(() => EditorState | undefined) | null>(null);
  
  // Autosave state for UI indicators
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle');
  
  // Track which files have unsaved changes
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());

  const initAutosaveManager = useCallback((targetWorkspace: Workspace, targetVfs: VirtualFileSystem) => {
    if (autosaveManagerRef.current) {
      autosaveManagerRef.current.destroy();
      autosaveManagerRef.current = null;
    }

    // Create autosave manager with callback
    const autosaveCallback = async (vfsStructure: any, editorState?: EditorState) => {
      const currentWorkspace = workspaceRef.current;
      if (!currentWorkspace) return;

      try {
        await updateWorkspaceAPI(currentWorkspace.metadata.id, vfsStructure, editorState);
        console.log('[Autosave] Saved workspace:', currentWorkspace.metadata.name);
      } catch (err) {
        console.error('[Autosave] Failed to save workspace:', err);
        throw err;
      }
    };

    autosaveManagerRef.current = createAutosaveManager(autosaveCallback, {
      debounceMs: 2000,
      verbose: false,
    });

    // Register state change callback for UI indicators
    autosaveManagerRef.current.onStateChange((state) => {
      setAutosaveState(state);
      
      // Clear dirty files when save completes
      if (state === 'synced') {
        setDirtyFiles(new Set());
      }
    });
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const result = await listWorkspacesAPI();
    const { workspaces: workspaceList, activeWorkspaceId: activeId } = result;
    setWorkspaces(workspaceList);
    setActiveWorkspaceId(activeId);

    workspaceList.forEach((ws) => {
      persistedWorkspaceIdsRef.current.add(ws.id);
    });
    return result;
  }, []);

  /**
   * Initialize autosave manager
   * 
   * Phase 1.6: Creates AutosaveManager instance when workspace is loaded.
   */
  useEffect(() => {
    workspaceRef.current = workspace;
    vfsRef.current = vfs;

    if (!workspace || !vfs) return;
    initAutosaveManager(workspace, vfs);

    // Cleanup on unmount
    return () => {
      if (autosaveManagerRef.current) {
        autosaveManagerRef.current.destroy();
        autosaveManagerRef.current = null;
      }
    };
  }, [workspace, vfs, initAutosaveManager]);

  /**
   * Restore workspace on mount
   *
   * Phase 2.5 Active Workspace Semantics:
   * - Load the active workspace (server-side source of truth)
   * - Fall back to most recent workspace when no active workspace is set
   * - Create a new default workspace when none exist
   */
  useEffect(() => {
    const restoreWorkspace = async () => {
      if (isRestoringRef.current || workspace) return;
      
      isRestoringRef.current = true;
      setIsLoading(true);

      try {
        const { workspaces: workspaceList, activeWorkspaceId: activeId } = await refreshWorkspaces();
        const fallbackWorkspaceId = workspaceList[0]?.id ?? null;
        const targetWorkspaceId = activeId ?? fallbackWorkspaceId;

        if (targetWorkspaceId) {
          if (!activeId) {
            await activateWorkspaceAPI(targetWorkspaceId);
            setActiveWorkspaceId(targetWorkspaceId);
          }

          const loadedWorkspace = await loadWorkspaceAPI(targetWorkspaceId);
          if (loadedWorkspace) {
            console.log('[Phase 2.5] Restored workspace:', loadedWorkspace.metadata.name);
            setWorkspace(loadedWorkspace);
            const vfsInstance = new VirtualFileSystem(loadedWorkspace.vfs);
            setVfs(vfsInstance);
            persistedWorkspaceIdsRef.current.add(loadedWorkspace.metadata.id);
          } else {
            throw new Error('Failed to load active workspace');
          }
        } else {
          // No workspace exists - create a new default workspace
          console.log('[Phase 2.5] No workspace found, creating new workspace...');
          const newWorkspace = createEmptyWorkspace('My Project');
          setWorkspace(newWorkspace);
          const vfsInstance = new VirtualFileSystem(newWorkspace.vfs);
          setVfs(vfsInstance);

          // Save the new workspace to the server and set it active
          try {
            const result = await createWorkspaceAPI({
              id: newWorkspace.metadata.id,
              name: newWorkspace.metadata.name,
              type: newWorkspace.metadata.type,
              source: newWorkspace.metadata.source,
              vfs: newWorkspace.vfs,
            });

            if ('error' in result) {
              throw new Error(result.error);
            }

            persistedWorkspaceIdsRef.current.add(newWorkspace.metadata.id);
            await activateWorkspaceAPI(newWorkspace.metadata.id);
            await refreshWorkspaces();
            setActiveWorkspaceId(newWorkspace.metadata.id);
            console.log('[Phase 2.5] Created new workspace:', newWorkspace.metadata.name);
          } catch (saveErr) {
            console.warn('[Phase 2.5] Failed to save new workspace (will try on first edit):', saveErr);
          }
        }
      } catch (err) {
        console.warn('[Phase 2.5] Failed to restore workspace:', err);
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
  }, [refreshWorkspaces]); // Run only once on mount


  /**
   * Manual save workspace
   * 
   * Phase 1.6: Uses AutosaveManager for force save.
   * Can be called explicitly (e.g., on Cmd+S or before navigation).
   * Also used after creating a new workspace.
   */
  const saveWorkspace = useCallback(async (editorState?: EditorState) => {
    const currentWorkspace = workspaceRef.current;
    const currentVfs = vfsRef.current;
    if (!currentWorkspace || !currentVfs) return;

    setError(null);

    try {
      const currentVfsStructure = currentVfs.getStructure();
      
      // Update workspace with latest editor state if provided
      const workspaceToSave: Workspace = {
        ...currentWorkspace,
        vfs: currentVfsStructure,
        editorState: editorState || currentWorkspace.editorState,
      };

      // Check if workspace already exists on server
      const isPersisted = persistedWorkspaceIdsRef.current.has(currentWorkspace.metadata.id);
      if (!isPersisted) {
        // New workspace - create it
        const result = await createWorkspaceAPI({
          id: currentWorkspace.metadata.id,
          name: currentWorkspace.metadata.name,
          type: currentWorkspace.metadata.type,
          source: currentWorkspace.metadata.source,
          vfs: currentVfsStructure,
          editorState: editorState,
          githubMetadata: currentWorkspace.metadata.githubMetadata,
        });

        if ('error' in result) {
          throw new Error(result.error);
        }

        persistedWorkspaceIdsRef.current.add(currentWorkspace.metadata.id);
        await refreshWorkspaces();
        setActiveWorkspaceId(currentWorkspace.metadata.id);
        console.log('[Phase 1.6] Created new workspace:', currentWorkspace.metadata.name);
      } else {
        // Existing workspace - use autosave manager for force save
        if (autosaveManagerRef.current) {
          await autosaveManagerRef.current.forceSave(currentVfsStructure, editorState);
        } else {
          // Fallback if autosave manager not initialized
          await updateWorkspaceAPI(currentWorkspace.metadata.id, currentVfsStructure, editorState);
        }
        console.log('[Phase 1.6] Saved workspace:', currentWorkspace.metadata.name);
      }
      
      // Update local workspace state with editor state
      setWorkspace(workspaceToSave);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save workspace';
      setError(errorMessage);
      console.error('[Phase 1.6] Save error:', err);
    }
  }, []);

  /**
   * Mark workspace as dirty (needs saving)
   * 
   * Phase 1.5/1.6: Triggers autosave using AutosaveManager.
   * Should be called after any file modification or editor state change.
   * 
   * @param eventType - Type of change that triggered the save
   * @param fileId - Optional file ID for file-specific changes
   */
  const markDirty = useCallback((eventType: 'FILE_CONTENT_CHANGED' | 'FILE_CREATED' | 'FILE_RENAMED' | 'FILE_DELETED' | 'TAB_CHANGED' | 'LAYOUT_CHANGED' = 'FILE_CONTENT_CHANGED', fileId?: string) => {
    const currentWorkspace = workspaceRef.current;
    const currentVfs = vfsRef.current;
    if (!currentWorkspace || !currentVfs || !autosaveManagerRef.current) return;

    // Track dirty files for file-specific changes
    if (fileId && (eventType === 'FILE_CONTENT_CHANGED' || eventType === 'FILE_CREATED' || eventType === 'FILE_RENAMED')) {
      setDirtyFiles(prev => new Set(prev).add(fileId));
    }

    const currentVfsStructure = currentVfs.getStructure();
    
    // Capture current editor state if capture function is registered
    const currentEditorState =
      typeof editorStateCaptureFn === 'function'
        ? editorStateCaptureFn()
        : currentWorkspace.editorState;
    
    autosaveManagerRef.current.trigger(
      {
        type: eventType,
        timestamp: Date.now(),
      },
      currentVfsStructure,
      currentEditorState as EditorState
    );
  }, [editorStateCaptureFn]);

  /**
   * Import workspace from ZIP file
   */
  const importFromZip = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const importedWorkspace = await importZipFile(file);
      setWorkspace(importedWorkspace);
      setActiveWorkspaceId(importedWorkspace.metadata.id);
      
      // Create VFS instance from imported structure
      const vfsInstance = new VirtualFileSystem(importedWorkspace.vfs);
      setVfs(vfsInstance);
      workspaceRef.current = importedWorkspace;
      vfsRef.current = vfsInstance;
      initAutosaveManager(importedWorkspace, vfsInstance);

      setWorkspaces((prev) => [
        {
          id: importedWorkspace.metadata.id,
          name: importedWorkspace.metadata.name,
          type: importedWorkspace.metadata.type,
          source: importedWorkspace.metadata.source,
          createdAt: importedWorkspace.metadata.createdAt,
          lastOpenedAt: importedWorkspace.metadata.lastOpenedAt,
        },
        ...prev.filter((ws) => ws.id !== importedWorkspace.metadata.id),
      ]);
      
      // Save imported workspace to server
      await saveWorkspace();
      await refreshWorkspaces();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import ZIP file';
      setError(errorMessage);
      console.error('ZIP import error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [initAutosaveManager, refreshWorkspaces, saveWorkspace]);

  /**
   * Create a new empty workspace
   */
  const createNewWorkspace = useCallback(async (
    name: string = 'New Project',
    options?: {
      save?: boolean;
      type?: WorkspaceType;
      source?: WorkspaceSource;
      githubMetadata?: GitHubMetadata;
    }
  ) => {
    const resolvedType = options?.type ?? 'cloud';
    const resolvedSource = options?.source ?? (resolvedType === 'github' ? 'github' : 'manual');

    const newWorkspace = createEmptyWorkspace(name, {
      type: resolvedType,
      source: resolvedSource,
      githubMetadata: options?.githubMetadata,
    });
    setWorkspace(newWorkspace);
    setActiveWorkspaceId(newWorkspace.metadata.id);
    
    const vfsInstance = new VirtualFileSystem(newWorkspace.vfs);
    setVfs(vfsInstance);
    setError(null);
    workspaceRef.current = newWorkspace;
    vfsRef.current = vfsInstance;
    initAutosaveManager(newWorkspace, vfsInstance);

    setWorkspaces((prev) => [
      {
        id: newWorkspace.metadata.id,
        name: newWorkspace.metadata.name,
        type: newWorkspace.metadata.type,
        source: newWorkspace.metadata.source,
        createdAt: newWorkspace.metadata.createdAt,
        lastOpenedAt: newWorkspace.metadata.lastOpenedAt,
      },
      ...prev.filter((ws) => ws.id !== newWorkspace.metadata.id),
    ]);
    
    // Save new workspace to server (optional)
    if (options?.save !== false) {
      try {
        const result = await createWorkspaceAPI({
          id: newWorkspace.metadata.id,
          name: newWorkspace.metadata.name,
          type: newWorkspace.metadata.type,
          source: newWorkspace.metadata.source,
          vfs: newWorkspace.vfs,
          githubMetadata: newWorkspace.metadata.githubMetadata,
        });

        if ('error' in result) {
          throw new Error(result.error);
        }

        persistedWorkspaceIdsRef.current.add(newWorkspace.metadata.id);
        await refreshWorkspaces();
        console.log('[Phase 2.5] Created new workspace:', newWorkspace.metadata.name);
      } catch (saveErr) {
        console.warn('[Phase 2.5] Failed to save new workspace (will try on first edit):', saveErr);
      }
    }

    return { workspace: newWorkspace, vfs: vfsInstance };
  }, [initAutosaveManager, refreshWorkspaces]);

  /**
   * Load an existing workspace
   */
  const loadWorkspace = useCallback((workspace: Workspace) => {
    setWorkspace(workspace);
    setActiveWorkspaceId(workspace.metadata.id);
    const vfsInstance = new VirtualFileSystem(workspace.vfs);
    setVfs(vfsInstance);
    setError(null);
    workspaceRef.current = workspace;
    vfsRef.current = vfsInstance;
    initAutosaveManager(workspace, vfsInstance);
    persistedWorkspaceIdsRef.current.add(workspace.metadata.id);
  }, [initAutosaveManager]);

  /**
   * Update workspace name (local state)
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
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === workspaceRef.current?.metadata.id ? { ...ws, name } : ws
      )
    );
  }, []);

  /**
   * Switch active workspace
   *
   * Persists current workspace state, activates the target workspace,
   * and loads its VFS/editor state without a page reload.
   */
  const switchWorkspace = useCallback(async (workspaceId: string) => {
    if (workspace?.metadata.id === workspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const editorState =
        typeof editorStateCaptureFn === 'function'
          ? editorStateCaptureFn()
          : undefined;
      await saveWorkspace(editorState);

      const activated = await activateWorkspaceAPI(workspaceId);
      if (!activated) {
        throw new Error('Failed to activate workspace');
      }

      const nextWorkspace = await loadWorkspaceAPI(workspaceId);
      if (!nextWorkspace) {
        throw new Error('Failed to load workspace');
      }

      setWorkspace(nextWorkspace);
      setActiveWorkspaceId(workspaceId);
      const vfsInstance = new VirtualFileSystem(nextWorkspace.vfs);
      setVfs(vfsInstance);
      workspaceRef.current = nextWorkspace;
      vfsRef.current = vfsInstance;
      initAutosaveManager(nextWorkspace, vfsInstance);
      persistedWorkspaceIdsRef.current.add(nextWorkspace.metadata.id);

      await refreshWorkspaces();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch workspace';
      setError(errorMessage);
      console.error('[Phase 2.5] Switch workspace error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [editorStateCaptureFn, initAutosaveManager, refreshWorkspaces, saveWorkspace, workspace?.metadata.id]);

  /**
   * Rename a workspace (server + local)
   */
  const renameWorkspace = useCallback(async (workspaceId: string, name: string) => {
    setError(null);

    const success = await renameWorkspaceAPI(workspaceId, name);
    if (!success) {
      setError('Failed to rename workspace');
      return;
    }

    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === workspaceId ? { ...ws, name } : ws))
    );

    if (workspace?.metadata.id === workspaceId) {
      updateWorkspaceName(name);
    }
  }, [updateWorkspaceName, workspace?.metadata.id]);

  /**
   * Delete a workspace (server + local)
   */
  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    setError(null);

    const success = await deleteWorkspaceAPI(workspaceId);
    if (!success) {
      setError('Failed to delete workspace');
      return;
    }

    persistedWorkspaceIdsRef.current.delete(workspaceId);
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== workspaceId));

    if (workspace?.metadata.id === workspaceId) {
      const { workspaces: workspaceList } = await refreshWorkspaces();
      const nextWorkspaceId = workspaceList.find((ws) => ws.id !== workspaceId)?.id ?? null;

      if (nextWorkspaceId) {
        const activated = await activateWorkspaceAPI(nextWorkspaceId);
        if (activated) {
          const nextWorkspace = await loadWorkspaceAPI(nextWorkspaceId);
          if (nextWorkspace) {
            setWorkspace(nextWorkspace);
            setActiveWorkspaceId(nextWorkspaceId);
            const vfsInstance = new VirtualFileSystem(nextWorkspace.vfs);
            setVfs(vfsInstance);
            workspaceRef.current = nextWorkspace;
            vfsRef.current = vfsInstance;
            initAutosaveManager(nextWorkspace, vfsInstance);
            persistedWorkspaceIdsRef.current.add(nextWorkspace.metadata.id);
          }
        }
      } else {
        await createNewWorkspace('My Project');
      }
    } else {
      await refreshWorkspaces();
    }
  }, [createNewWorkspace, initAutosaveManager, refreshWorkspaces, workspace?.metadata.id]);


  const value = useMemo(
    () => ({
      workspace,
      vfs,
      workspaces,
      activeWorkspaceId,
      isLoading,
      error,
      refreshWorkspaces,
      switchWorkspace,
      renameWorkspace,
      deleteWorkspace,
      importFromZip,
      createNewWorkspace,
      loadWorkspace,
      updateWorkspaceName,
      saveWorkspace,
      markDirty,
      getEditorStateCapture: editorStateCaptureFn,
      setEditorStateCapture: setEditorStateCaptureFn,
      autosaveState,
      dirtyFiles,
    }),
    [
      workspace,
      vfs,
      workspaces,
      activeWorkspaceId,
      isLoading,
      error,
      refreshWorkspaces,
      switchWorkspace,
      renameWorkspace,
      deleteWorkspace,
      importFromZip,
      createNewWorkspace,
      loadWorkspace,
      updateWorkspaceName,
      saveWorkspace,
      markDirty,
      editorStateCaptureFn,
      autosaveState,
      dirtyFiles,
    ]
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
