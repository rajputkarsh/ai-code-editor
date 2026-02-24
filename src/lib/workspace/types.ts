/**
 * Core types for the Virtual File System and Workspace
 * Framework-agnostic - no React dependencies
 */

export type FileType = 'file' | 'folder';

export interface VFSNode {
  id: string;
  name: string;
  type: FileType;
  parentId: string | null;
  depth: number;
  children?: string[]; // IDs of child nodes (for folders)
  content?: string; // File content (for files)
}

export interface VFSStructure {
  nodes: Record<string, VFSNode>;
  rootId: string;
}

export type WorkspaceSource = 'zip' | 'github' | 'manual';
export type WorkspaceType = 'cloud' | 'github';
export type WorkspaceProjectType = 'vite-react';
export type WorkspaceTemplateType = 'react-vite';

/**
 * GitHub repository metadata for GitHub-linked workspaces
 * 
 * Phase 1.6 GitHub Interoperability Rules:
 * - For GitHub-linked projects, the GitHub repository is the source of truth
 * - Cloud workspace tracks local uncommitted changes and editor state
 * - No automatic push or background syncing
 */
export interface GitHubMetadata {
  repositoryUrl: string;
  branch: string;
  lastSyncedCommit?: string; // SHA of last synced commit
  lastSyncedAt?: Date;
}

export interface WorkspaceMetadata {
  id: string;
  name: string;
  source: WorkspaceSource;
  /**
   * Workspace type determines the source of truth.
   * - cloud: application backend is the source of truth
   * - github: GitHub repository is the source of truth
   */
  type: WorkspaceType;
  createdAt: Date;
  lastOpenedAt: Date;
  userId?: string; // Owner of the workspace (for cloud persistence)
  teamId?: string; // Team owner when workspace is collaborative
  projectType?: WorkspaceProjectType;
  githubMetadata?: GitHubMetadata; // Only present for GitHub-linked workspaces
}

/**
 * Editor state that needs to be persisted
 * Captures the current editor configuration and open files
 */
export interface EditorState {
  openTabs: Array<{
    id: string;
    fileId: string;
  }>;
  activeTabId: string | null;
  activeSecondaryTabId: string | null;
  isSplit: boolean;
  cursorPosition?: {
    fileId: string;
    line: number;
    column: number;
  };
}

/**
 * Complete workspace state for persistence
 * Includes file system, editor state, and metadata
 */
export interface Workspace {
  metadata: WorkspaceMetadata;
  vfs: VFSStructure;
  editorState?: EditorState;
}

/**
 * Serializable workspace data for database storage
 * All Date fields converted to ISO strings for JSON serialization
 */
export interface SerializedWorkspace {
  id: string;
  userId: string;
  name: string;
  source: WorkspaceSource;
  projectType?: WorkspaceProjectType;
  vfsData: string; // JSON string of VFSStructure
  editorStateData: string | null; // JSON string of EditorState
  createdAt: string; // ISO date string
  lastOpenedAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface VFSOperations {
  readFile: (id: string) => string | undefined;
  writeFile: (id: string, content: string) => void;
  createFile: (parentId: string, name: string, content?: string) => string;
  createFolder: (parentId: string, name: string) => string;
  renameNode: (id: string, newName: string) => void;
  deleteNode: (id: string) => void;
  getNode: (id: string) => VFSNode | undefined;
  listDirectory: (folderId: string) => VFSNode[];
  getNodePath: (id: string) => string;
}


