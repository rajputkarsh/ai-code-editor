/**
 * Workspace Factory
 * Creates and initializes workspaces
 */

import { VirtualFileSystem } from './vfs';
import { Workspace, WorkspaceMetadata } from './types';

/**
 * Create a new empty workspace
 */
export function createEmptyWorkspace(name: string = 'New Project'): Workspace {
  const vfs = new VirtualFileSystem();
  
  const metadata: WorkspaceMetadata = {
    id: crypto.randomUUID(),
    name,
    source: 'manual',
    createdAt: new Date(),
    lastOpenedAt: new Date(),
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



