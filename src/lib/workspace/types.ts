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

export interface WorkspaceMetadata {
  id: string;
  name: string;
  source: WorkspaceSource;
  createdAt: Date;
  lastOpenedAt: Date;
  userId?: string; // Owner of the workspace (for cloud persistence)
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


