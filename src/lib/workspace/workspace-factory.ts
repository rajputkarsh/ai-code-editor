/**
 * Workspace Factory
 * Creates and initializes workspaces
 */

import { VirtualFileSystem } from './vfs';
import { Workspace, WorkspaceMetadata, WorkspaceType, WorkspaceSource, GitHubMetadata } from './types';

/**
 * Create a new empty workspace
 */
export function createEmptyWorkspace(
  name: string = 'New Project',
  options?: {
    type?: WorkspaceType;
    source?: WorkspaceSource;
    githubMetadata?: GitHubMetadata;
  }
): Workspace {
  const vfs = new VirtualFileSystem();
  const resolvedType = options?.type ?? 'cloud';
  const resolvedSource = options?.source ?? (resolvedType === 'github' ? 'github' : 'manual');
  
  const metadata: WorkspaceMetadata = {
    id: crypto.randomUUID(),
    name,
    source: resolvedSource,
    type: resolvedType,
    createdAt: new Date(),
    lastOpenedAt: new Date(),
    githubMetadata: options?.githubMetadata,
  };
  
  return {
    metadata,
    vfs: vfs.getStructure(),
  };
}

/**
 * Update workspace last opened timestamp
 */
export function updateLastOpened(workspace: Workspace): Workspace {
  return {
    ...workspace,
    metadata: {
      ...workspace.metadata,
      lastOpenedAt: new Date(),
    },
  };
}

/**
 * Rename workspace
 */
export function renameWorkspace(workspace: Workspace, newName: string): Workspace {
  return {
    ...workspace,
    metadata: {
      ...workspace.metadata,
      name: newName,
    },
  };
}




