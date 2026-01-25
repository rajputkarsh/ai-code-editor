/**
 * Workspace Persistence Operations
 * 
 * High-level database operations for workspace CRUD.
 * These functions handle the interaction between the application layer and the database.
 * 
 * Design principles:
 * - All operations require authentication (userId)
 * - Operations validate workspace ownership
 * - Timestamps are managed automatically
 * - Gracefully handles missing DATABASE_URL (returns null/empty arrays)
 */

import { eq, and, desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { Workspace, VFSStructure, EditorState } from '../types';
import { serializeVFS, serializeEditorState } from './serialization';

const { workspaces: workspacesTable } = schema;

/**
 * Create a new workspace in the database
 * 
 * @param userId - Clerk user ID (workspace owner)
 * @param workspace - Workspace object to persist
 * @returns The created workspace ID, or null if database is not configured
 */
export async function createWorkspace(
  userId: string,
  workspace: Workspace
): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const result = await db
      .insert(workspacesTable)
      .values({
        id: workspace.metadata.id,
        userId: userId,
        name: workspace.metadata.name,
        source: workspace.metadata.source,
        vfsData: serializeVFS(workspace.vfs),
        editorStateData: workspace.editorState ? serializeEditorState(workspace.editorState) : null,
        createdAt: workspace.metadata.createdAt,
        lastOpenedAt: workspace.metadata.lastOpenedAt,
        updatedAt: new Date(),
      })
      .returning({ id: workspacesTable.id });

    return result[0].id;
  } catch (error) {
    console.error('Failed to create workspace:', error);
    throw new Error('Failed to create workspace');
  }
}

/**
 * Update an existing workspace
 * 
 * Only updates VFS and editor state. Does not modify metadata fields.
 * Automatically updates `updatedAt` timestamp.
 * 
 * @param userId - Clerk user ID (for ownership validation)
 * @param workspaceId - ID of workspace to update
 * @param vfs - Updated virtual file system
 * @param editorState - Updated editor state (optional)
 */
export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  vfs: VFSStructure,
  editorState?: EditorState
): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db
      .update(workspacesTable)
      .set({
        vfsData: serializeVFS(vfs),
        editorStateData: editorState ? serializeEditorState(editorState) : null,
        updatedAt: new Date(),
        lastOpenedAt: new Date(), // Update last opened when workspace is saved
      })
      .where(
        and(
          eq(workspacesTable.id, workspaceId),
          eq(workspacesTable.userId, userId)
        )
      );
  } catch (error) {
    console.error('Failed to update workspace:', error);
    throw new Error('Failed to update workspace');
  }
}

/**
 * Load a workspace by ID
 * 
 * Validates ownership before returning.
 * 
 * @param userId - Clerk user ID (for ownership validation)
 * @param workspaceId - ID of workspace to load
 * @returns Workspace object or null if not found
 */
export async function loadWorkspace(
  userId: string,
  workspaceId: string
): Promise<Workspace | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(workspacesTable)
      .where(
        and(
          eq(workspacesTable.id, workspaceId),
          eq(workspacesTable.userId, userId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    
    return {
      metadata: {
        id: row.id,
        name: row.name,
        source: row.source as 'zip' | 'github' | 'manual',
        createdAt: row.createdAt,
        lastOpenedAt: row.lastOpenedAt,
        userId: row.userId,
      },
      vfs: row.vfsData as VFSStructure,
      editorState: row.editorStateData as EditorState | undefined,
    };
  } catch (error) {
    console.error('Failed to load workspace:', error);
    throw new Error('Failed to load workspace');
  }
}

/**
 * List all workspaces for a user
 * 
 * Returns workspaces ordered by last opened (most recent first).
 * Only returns metadata, not full VFS content (for performance).
 * 
 * @param userId - Clerk user ID
 * @returns Array of workspace metadata objects
 */
export async function listWorkspaces(userId: string): Promise<Array<{
  id: string;
  name: string;
  source: string;
  lastOpenedAt: Date;
  createdAt: Date;
}>> {
  const db = getDb();
  if (!db) return [];

  try {
    const result = await db
      .select({
        id: workspacesTable.id,
        name: workspacesTable.name,
        source: workspacesTable.source,
        lastOpenedAt: workspacesTable.lastOpenedAt,
        createdAt: workspacesTable.createdAt,
      })
      .from(workspacesTable)
      .where(eq(workspacesTable.userId, userId))
      .orderBy(desc(workspacesTable.lastOpenedAt));

    return result;
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return [];
  }
}

/**
 * Delete a workspace
 * 
 * Validates ownership before deletion.
 * This is a hard delete (no soft delete/archiving).
 * 
 * @param userId - Clerk user ID (for ownership validation)
 * @param workspaceId - ID of workspace to delete
 */
export async function deleteWorkspace(
  userId: string,
  workspaceId: string
): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db
      .delete(workspacesTable)
      .where(
        and(
          eq(workspacesTable.id, workspaceId),
          eq(workspacesTable.userId, userId)
        )
      );
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    throw new Error('Failed to delete workspace');
  }
}

/**
 * Get the most recently opened workspace for a user
 * 
 * Used for auto-restore on editor load.
 * 
 * @param userId - Clerk user ID
 * @returns Most recent workspace or null if none exist
 */
export async function getLastOpenedWorkspace(userId: string): Promise<Workspace | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.userId, userId))
      .orderBy(desc(workspacesTable.lastOpenedAt))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    
    return {
      metadata: {
        id: row.id,
        name: row.name,
        source: row.source as 'zip' | 'github' | 'manual',
        createdAt: row.createdAt,
        lastOpenedAt: row.lastOpenedAt,
        userId: row.userId,
      },
      vfs: row.vfsData as VFSStructure,
      editorState: row.editorStateData as EditorState | undefined,
    };
  } catch (error) {
    console.error('Failed to get last opened workspace:', error);
    return null;
  }
}

