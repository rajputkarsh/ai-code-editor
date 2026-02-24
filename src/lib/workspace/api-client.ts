/**
 * Workspace API Client
 * 
 * Client-side wrapper for workspace API endpoints.
 * Provides type-safe methods for calling the Hono workspace API.
 * 
 * All methods automatically include authentication via cookies (Clerk session).
 */

import type {
  Workspace,
  VFSStructure,
  EditorState,
  WorkspaceType,
  WorkspaceSource,
  GitHubMetadata,
  WorkspaceProjectType,
} from './types';

const API_BASE = '/api/workspaces';

/**
 * Create a new workspace on the server
 */
export async function createWorkspaceAPI(workspace: {
  id: string;
  name: string;
  type: WorkspaceType;
  projectType?: WorkspaceProjectType;
  teamId?: string;
  source?: WorkspaceSource;
  vfs: VFSStructure;
  editorState?: EditorState;
  githubMetadata?: GitHubMetadata;
}): Promise<{ id: string } | { error: string }> {
  try {
    const githubMetadata = workspace.githubMetadata
      ? {
          ...workspace.githubMetadata,
          lastSyncedAt: workspace.githubMetadata.lastSyncedAt
            ? workspace.githubMetadata.lastSyncedAt.toISOString()
            : undefined,
        }
      : undefined;

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...workspace,
        githubMetadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || 'Failed to create workspace' };
    }

    return await response.json();
  } catch (error) {
    console.error('API error creating workspace:', error);
    return { error: 'Network error' };
  }
}

/**
 * Load a workspace by ID
 */
export async function loadWorkspaceAPI(workspaceId: string): Promise<Workspace | null> {
  try {
    const response = await fetch(`${API_BASE}/${workspaceId}`);

    if (!response.ok) {
      console.error('Failed to load workspace:', response.status);
      return null;
    }

    const workspace = await response.json();
    const githubMetadata = workspace.metadata?.githubMetadata
      ? {
          ...workspace.metadata.githubMetadata,
          lastSyncedAt: workspace.metadata.githubMetadata.lastSyncedAt
            ? new Date(workspace.metadata.githubMetadata.lastSyncedAt)
            : undefined,
        }
      : undefined;

    return {
      ...workspace,
      metadata: {
        ...workspace.metadata,
        createdAt: new Date(workspace.metadata.createdAt),
        lastOpenedAt: new Date(workspace.metadata.lastOpenedAt),
        githubMetadata,
      },
    };
  } catch (error) {
    console.error('API error loading workspace:', error);
    return null;
  }
}

/**
 * Update an existing workspace
 */
export async function updateWorkspaceAPI(
  workspaceId: string,
  vfs: VFSStructure,
  editorState?: EditorState
): Promise<boolean> {
  try {
    const payload: { vfs: VFSStructure; editorState?: EditorState } = { vfs };
    if (editorState !== undefined && editorState !== null) {
      payload.editorState = editorState;
    }
    const response = await fetch(`${API_BASE}/${workspaceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error('API error updating workspace:', error);
    return false;
  }
}

/**
 * Delete a workspace
 */
export async function deleteWorkspaceAPI(workspaceId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/${workspaceId}`, {
      method: 'DELETE',
    });

    return response.ok;
  } catch (error) {
    console.error('API error deleting workspace:', error);
    return false;
  }
}

/**
 * List all workspaces for the current user
 */
export async function listWorkspacesAPI(): Promise<{
  workspaces: Array<{
    id: string;
    name: string;
    source: WorkspaceSource;
    projectType?: WorkspaceProjectType;
    type: WorkspaceType;
    teamId?: string | null;
    lastOpenedAt: Date;
    createdAt: Date;
  }>;
  activeWorkspaceId: string | null;
}> {
  try {
    const response = await fetch(API_BASE);

    if (!response.ok) {
      return { workspaces: [], activeWorkspaceId: null };
    }

    const data = await response.json();
    
    // Convert date strings to Date objects
    const workspaces = data.workspaces.map((ws: any) => ({
      ...ws,
      lastOpenedAt: new Date(ws.lastOpenedAt),
      createdAt: new Date(ws.createdAt),
    }));

    return {
      workspaces,
      activeWorkspaceId: data.activeWorkspaceId ?? null,
    };
  } catch (error) {
    console.error('API error listing workspaces:', error);
    return { workspaces: [], activeWorkspaceId: null };
  }
}

/**
 * Rename a workspace
 */
export async function renameWorkspaceAPI(workspaceId: string, name: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/${workspaceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    return response.ok;
  } catch (error) {
    console.error('API error renaming workspace:', error);
    return false;
  }
}

/**
 * Set the active workspace
 */
export async function activateWorkspaceAPI(workspaceId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/${workspaceId}/activate`, {
      method: 'POST',
    });

    return response.ok;
  } catch (error) {
    console.error('API error activating workspace:', error);
    return false;
  }
}
