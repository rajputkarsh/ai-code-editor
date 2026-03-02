/**
 * Workspace Module
 * Exports all workspace-related functionality
 */

export * from './types';
export * from './vfs';
export * from './zip-importer';
export {
  createEmptyWorkspace,
  updateLastOpened,
  renameWorkspace as renameWorkspaceLocal,
} from './workspace-factory';
export * from './sample-project';
export * from './templates';
// NOTE: Do NOT re-export './persistence' here. Those are server-only operations
// (they import clerkClient via collaboration/operations) and must never enter
// the client bundle. Server routes import directly from '@/lib/workspace/persistence'.
export * from './api-client';
