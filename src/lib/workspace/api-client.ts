/**
 * Workspace API Client
 * 
 * Client-side wrapper for workspace API endpoints.
 * Provides type-safe methods for calling the Hono workspace API.
 * 
 * All methods automatically include authentication via cookies (Clerk session).
 */

import type { Workspace, VFSStructure, EditorState } from './types';

const API_BASE = '/api/workspace';

/**
 * Create a new workspace on the server
 */
export async function createWorkspaceAPI(workspace: {
  id: string;
  name: string;
  source: 'zip' | 'github' | 'manual';
  vfs: VFSStructure;
  editorState?: EditorState;
}): Promise<{ id: string } | { error: string }> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspace),
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

    return await response.json();
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
    const response = await fetch(`${API_BASE}/${workspaceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vfs, editorState }),
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
export async function listWorkspacesAPI(): Promise<Array<{
  id: string;
  name: string;
  source: string;
  lastOpenedAt: Date;
  createdAt: Date;
}>> {
  try {
    const response = await fetch(API_BASE);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    // Convert date strings to Date objects
    return data.workspaces.map((ws: any) => ({
      ...ws,
      lastOpenedAt: new Date(ws.lastOpenedAt),
      createdAt: new Date(ws.createdAt),
    }));
  } catch (error) {
    console.error('API error listing workspaces:', error);
    return [];
  }
}

/**
 * Get the most recently opened workspace
 */
export async function getLatestWorkspaceAPI(): Promise<Workspace | null> {
  try {
    const response = await fetch(`${API_BASE}/latest/get`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (!data.workspace) {
      return null;
    }

    // Convert date strings to Date objects
    const workspace = data.workspace;
    return {
      ...workspace,
      metadata: {
        ...workspace.metadata,
        createdAt: new Date(workspace.metadata.createdAt),
        lastOpenedAt: new Date(workspace.metadata.lastOpenedAt),
      },
    };
  } catch (error) {
    console.error('API error getting latest workspace:', error);
    return null;
  }
}

