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
  getActiveWorkspaceId,
  setActiveWorkspace,
  renameWorkspace,
} from '@/lib/workspace/persistence';
import {
  StorageLimitExceededError,
  WorkspaceCountLimitExceededError,
} from '@/lib/workspace/persistence/storage-utils';
import type { VFSStructure, EditorState, Workspace } from '@/lib/workspace/types';

export const workspaceApp = new Hono();

/**
 * Schema for creating a new workspace
 * Phase 1.6: Added GitHub metadata support
 */
const createWorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['cloud', 'github']).optional(),
  source: z.enum(['zip', 'github', 'manual']).optional(),
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
  githubMetadata: z.object({
    repositoryUrl: z.string().url(),
    branch: z.string(),
    lastSyncedCommit: z.string().optional(),
    lastSyncedAt: z.string().datetime().optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  const resolvedSource = data.source ?? (data.type === 'github' ? 'github' : 'manual');
  const resolvedType = data.type ?? (resolvedSource === 'github' ? 'github' : 'cloud');

  if (resolvedType === 'github' && !data.githubMetadata) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'GitHub workspaces require githubMetadata',
      path: ['githubMetadata'],
    });
  }

  if (resolvedType === 'github' && resolvedSource !== 'github') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'GitHub workspaces must use source="github"',
      path: ['source'],
    });
  }
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

const renameWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
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
 * 
 * Phase 1.6: Enforces workspace count and storage limits
 */
workspaceApp.post(
  '/',
  zValidator('json', createWorkspaceSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const data = c.req.valid('json');

      const resolvedSource = data.source ?? (data.type === 'github' ? 'github' : 'manual');
      const resolvedType = data.type ?? (resolvedSource === 'github' ? 'github' : 'cloud');

      // Convert GitHub metadata dates from strings to Date objects
      const githubMetadata = data.githubMetadata ? {
        repositoryUrl: data.githubMetadata.repositoryUrl,
        branch: data.githubMetadata.branch,
        lastSyncedCommit: data.githubMetadata.lastSyncedCommit,
        lastSyncedAt: data.githubMetadata.lastSyncedAt 
          ? new Date(data.githubMetadata.lastSyncedAt) 
          : undefined,
      } : undefined;

      const workspace: Workspace = {
        metadata: {
          id: data.id,
          name: data.name,
          source: resolvedSource,
          type: resolvedType,
          createdAt: new Date(),
          lastOpenedAt: new Date(),
          userId,
          githubMetadata,
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

      await setActiveWorkspace(userId, workspaceId);

      return c.json({ id: workspaceId }, 201);
    } catch (error) {
      // Phase 1.6: Handle limit errors with appropriate status codes
      if (error instanceof WorkspaceCountLimitExceededError) {
        return c.json(
          { 
            error: error.message,
            code: 'WORKSPACE_COUNT_LIMIT_EXCEEDED',
            currentCount: error.currentCount,
            maxCount: error.maxCount,
          },
          429 // Too Many Requests
        );
      }

      if (error instanceof StorageLimitExceededError) {
        return c.json(
          {
            error: error.message,
            code: 'STORAGE_LIMIT_EXCEEDED',
            currentSize: error.currentSize,
            attemptedSize: error.attemptedSize,
            maxSize: error.maxSize,
          },
          413 // Payload Too Large
        );
      }

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
 * 
 * Phase 1.6: Enforces storage limits on updates
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
      // Phase 1.6: Handle storage limit errors
      if (error instanceof StorageLimitExceededError) {
        return c.json(
          {
            error: error.message,
            code: 'STORAGE_LIMIT_EXCEEDED',
            currentSize: error.currentSize,
            attemptedSize: error.attemptedSize,
            maxSize: error.maxSize,
          },
          413 // Payload Too Large
        );
      }

      console.error('Error updating workspace:', error);
      return c.json({ error: 'Failed to update workspace' }, 500);
    }
  }
);

/**
 * PATCH /workspace/:id
 * Rename a workspace
 */
workspaceApp.patch(
  '/:id',
  zValidator('json', renameWorkspaceSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const workspaceId = c.req.param('id');
      const data = c.req.valid('json');

      await renameWorkspace(userId, workspaceId, data.name);

      return c.json({ success: true });
    } catch (error) {
      console.error('Error renaming workspace:', error);
      return c.json({ error: 'Failed to rename workspace' }, 500);
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
 * POST /workspace/:id/activate
 * Set the active workspace for the authenticated user
 */
workspaceApp.post('/:id/activate', async (c) => {
  try {
    const userId = getUserId(c);
    const workspaceId = c.req.param('id');

    await setActiveWorkspace(userId, workspaceId);

    return c.json({ activeWorkspaceId: workspaceId });
  } catch (error) {
    console.error('Error activating workspace:', error);
    return c.json({ error: 'Failed to activate workspace' }, 500);
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
    const activeWorkspaceId = await getActiveWorkspaceId(userId);

    return c.json({ workspaces, activeWorkspaceId });
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

