'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Workspace, VirtualFileSystem, importZipFile, createEmptyWorkspace } from '@/lib/workspace';

interface WorkspaceContextType {
  workspace: Workspace | null;
  vfs: VirtualFileSystem | null;
  isLoading: boolean;
  error: string | null;
  importFromZip: (file: File) => Promise<void>;
  createNewWorkspace: (name?: string) => void;
  loadWorkspace: (workspace: Workspace) => void;
  updateWorkspaceName: (name: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [vfs, setVfs] = useState<VirtualFileSystem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import ZIP file';
      setError(errorMessage);
      console.error('ZIP import error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new empty workspace
   */
  const createNewWorkspace = useCallback((name: string = 'New Project') => {
    const newWorkspace = createEmptyWorkspace(name);
    setWorkspace(newWorkspace);
    
    const vfsInstance = new VirtualFileSystem(newWorkspace.vfs);
    setVfs(vfsInstance);
    setError(null);
  }, []);

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
    }),
    [workspace, vfs, isLoading, error, importFromZip, createNewWorkspace, loadWorkspace, updateWorkspaceName]
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

