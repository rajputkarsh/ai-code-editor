/**
 * Workspace Factory
 * Creates and initializes workspaces
 */

import { VirtualFileSystem } from './vfs';
import {
  Workspace,
  WorkspaceMetadata,
  WorkspaceType,
  WorkspaceSource,
  GitHubMetadata,
  WorkspaceTemplateType,
} from './types';
import { initializeWorkspaceTemplate } from './templates';

/**
 * Create a new empty workspace
 */
export function createEmptyWorkspace(
  name: string = 'New Project',
  options?: {
    type?: WorkspaceType;
    source?: WorkspaceSource;
    githubMetadata?: GitHubMetadata;
    template?: WorkspaceTemplateType;
  }
): Workspace {
  const vfs = new VirtualFileSystem();
  const resolvedType = options?.type ?? 'cloud';
  const resolvedSource = options?.source ?? (resolvedType === 'github' ? 'github' : 'manual');
  const templateResult = options?.template
    ? initializeWorkspaceTemplate(vfs, name, options.template)
    : null;
  
  const metadata: WorkspaceMetadata = {
    id: crypto.randomUUID(),
    name,
    source: resolvedSource,
    type: resolvedType,
    createdAt: new Date(),
    lastOpenedAt: new Date(),
    projectType: templateResult?.projectType,
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




