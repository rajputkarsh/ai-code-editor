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
export * from './persistence';
export * from './api-client';

