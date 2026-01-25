/**
 * Workspace API Routes (Hono)
 * 
 * RESTful API for workspace persistence operations.
 * 
 * Routes:
 * - POST   /workspace        - Create a new workspace
 * - GET    /workspace/:id    - Load a specific workspace
 * - PUT    /workspace/:id    - Update an existing workspace
 * - DELETE /workspace/:id    - Delete a workspace
 * - GET    /workspaces       - List all user workspaces
 * - GET    /workspace/latest - Get most recently opened workspace
 * 
 * All routes require authentication via Clerk middleware.
 * All operations validate workspace ownership.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import {
  createWorkspace,
  updateWorkspace,
  loadWorkspace,
  listWorkspaces,
  deleteWorkspace,
  getLastOpenedWorkspace,
} from '@/lib/workspace/persistence';
import type { VFSStructure, EditorState, Workspace } from '@/lib/workspace/types';

export const workspaceApp = new Hono();

/**
 * Schema for creating a new workspace
 */
const createWorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  source: z.enum(['zip', 'github', 'manual']),
  vfs: z.object({
    nodes: z.record(z.string(), z.any()),
    rootId: z.string(),
  }),
  editorState: z.object({
    openTabs: z.array(z.object({
      id: z.string(),
      fileId: z.string(),
    })),
    activeTabId: z.string().nullable(),
    activeSecondaryTabId: z.string().nullable(),
    isSplit: z.boolean(),
    cursorPosition: z.object({
      fileId: z.string(),
      line: z.number(),
      column: z.number(),
    }).optional(),
  }).optional(),
});

/**
 * Schema for updating a workspace
 */
const updateWorkspaceSchema = z.object({
  vfs: z.object({
    nodes: z.record(z.string(), z.any()),
    rootId: z.string(),
  }),
  editorState: z.object({
    openTabs: z.array(z.object({
      id: z.string(),
      fileId: z.string(),
    })),
    activeTabId: z.string().nullable(),
    activeSecondaryTabId: z.string().nullable(),
    isSplit: z.boolean(),
    cursorPosition: z.object({
      fileId: z.string(),
      line: z.number(),
      column: z.number(),
    }).optional(),
  }).optional(),
});

/**
 * Helper: Extract userId from context (set by auth middleware)
 */
function getUserId(c: Context): string {
  const userId = c.get('userId');
  if (!userId) {
    throw new Error('Unauthorized: userId not found in context');
  }
  return userId;
}

/**
 * POST /workspace
 * Create a new workspace
 */
workspaceApp.post(
  '/',
  zValidator('json', createWorkspaceSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const data = c.req.valid('json');

      const workspace: Workspace = {
        metadata: {
          id: data.id,
          name: data.name,
          source: data.source,
          createdAt: new Date(),
          lastOpenedAt: new Date(),
          userId,
        },
        vfs: data.vfs as VFSStructure,
        editorState: data.editorState as EditorState | undefined,
      };

      const workspaceId = await createWorkspace(userId, workspace);

      if (!workspaceId) {
        return c.json(
          { error: 'Database not configured. Workspace persistence is disabled.' },
          503
        );
      }

      return c.json({ id: workspaceId }, 201);
    } catch (error) {
      console.error('Error creating workspace:', error);
      return c.json(
        { error: 'Failed to create workspace' },
        500
      );
    }
  }
);

/**
 * GET /workspace/:id
 * Load a specific workspace
 */
workspaceApp.get('/:id', async (c) => {
  try {
    const userId = getUserId(c);
    const workspaceId = c.req.param('id');

    const workspace = await loadWorkspace(userId, workspaceId);

    if (!workspace) {
      return c.json({ error: 'Workspace not found' }, 404);
    }

    return c.json(workspace);
  } catch (error) {
    console.error('Error loading workspace:', error);
    return c.json({ error: 'Failed to load workspace' }, 500);
  }
});

/**
 * PUT /workspace/:id
 * Update an existing workspace
 */
workspaceApp.put(
  '/:id',
  zValidator('json', updateWorkspaceSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const workspaceId = c.req.param('id');
      const data = c.req.valid('json');

      await updateWorkspace(
        userId,
        workspaceId,
        data.vfs as VFSStructure,
        data.editorState as EditorState | undefined
      );

      return c.json({ success: true });
    } catch (error) {
      console.error('Error updating workspace:', error);
      return c.json({ error: 'Failed to update workspace' }, 500);
    }
  }
);

/**
 * DELETE /workspace/:id
 * Delete a workspace
 */
workspaceApp.delete('/:id', async (c) => {
  try {
    const userId = getUserId(c);
    const workspaceId = c.req.param('id');

    await deleteWorkspace(userId, workspaceId);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting workspace:', error);
    return c.json({ error: 'Failed to delete workspace' }, 500);
  }
});

/**
 * GET /workspaces
 * List all workspaces for the authenticated user
 */
workspaceApp.get('/', async (c) => {
  try {
    const userId = getUserId(c);
    const workspaces = await listWorkspaces(userId);

    return c.json({ workspaces });
  } catch (error) {
    console.error('Error listing workspaces:', error);
    return c.json({ error: 'Failed to list workspaces' }, 500);
  }
});

/**
 * GET /workspace/latest
 * Get the most recently opened workspace
 */
workspaceApp.get('/latest/get', async (c) => {
  try {
    const userId = getUserId(c);
    const workspace = await getLastOpenedWorkspace(userId);

    if (!workspace) {
      return c.json({ workspace: null });
    }

    return c.json({ workspace });
  } catch (error) {
    console.error('Error getting latest workspace:', error);
    return c.json({ error: 'Failed to get latest workspace' }, 500);
  }
});

