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
}

export interface Workspace {
  metadata: WorkspaceMetadata;
  vfs: VFSStructure;
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

