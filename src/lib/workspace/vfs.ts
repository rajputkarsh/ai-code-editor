/**
 * Virtual File System Implementation
 * Framework-agnostic - can be used without React
 */

import { VFSNode, VFSStructure, FileType } from './types';

export class VirtualFileSystem {
  private nodes: Record<string, VFSNode>;
  private rootId: string;

  constructor(initialStructure?: VFSStructure) {
    if (initialStructure) {
      this.nodes = { ...initialStructure.nodes };
      this.rootId = initialStructure.rootId;
    } else {
      // Create default root
      this.rootId = 'root';
      this.nodes = {
        [this.rootId]: {
          id: this.rootId,
          name: 'Project',
          type: 'folder',
          parentId: null,
          depth: 0,
          children: [],
        },
      };
    }
  }

  /**
   * Get current VFS structure (for serialization/state updates)
   */
  getStructure(): VFSStructure {
    return {
      nodes: { ...this.nodes },
      rootId: this.rootId,
    };
  }

  /**
   * Get root ID
   */
  getRootId(): string {
    return this.rootId;
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): VFSNode | undefined {
    return this.nodes[id];
  }

  /**
   * Read file content
   */
  readFile(id: string): string | undefined {
    const node = this.nodes[id];
    if (node && node.type === 'file') {
      return node.content || '';
    }
    return undefined;
  }

  /**
   * Write file content
   */
  writeFile(id: string, content: string): void {
    const node = this.nodes[id];
    if (node && node.type === 'file') {
      this.nodes[id] = { ...node, content };
    }
  }

  /**
   * Create a new file
   */
  createFile(parentId: string, name: string, content: string = ''): string {
    const parent = this.nodes[parentId];
    if (!parent || parent.type !== 'folder') {
      throw new Error('Parent must be a folder');
    }

    const id = this.generateId();
    const newFile: VFSNode = {
      id,
      name,
      type: 'file',
      parentId,
      depth: parent.depth + 1,
      content,
    };

    this.nodes[id] = newFile;
    this.nodes[parentId] = {
      ...parent,
      children: [...(parent.children || []), id],
    };

    return id;
  }

  /**
   * Create a new folder
   */
  createFolder(parentId: string, name: string): string {
    const parent = this.nodes[parentId];
    if (!parent || parent.type !== 'folder') {
      throw new Error('Parent must be a folder');
    }

    const id = this.generateId();
    const newFolder: VFSNode = {
      id,
      name,
      type: 'folder',
      parentId,
      depth: parent.depth + 1,
      children: [],
    };

    this.nodes[id] = newFolder;
    this.nodes[parentId] = {
      ...parent,
      children: [...(parent.children || []), id],
    };

    return id;
  }

  /**
   * Rename a node
   */
  renameNode(id: string, newName: string): void {
    const node = this.nodes[id];
    if (node && id !== this.rootId) {
      this.nodes[id] = { ...node, name: newName };
    }
  }

  /**
   * Delete a node (and all its children if it's a folder)
   */
  deleteNode(id: string): void {
    const node = this.nodes[id];
    if (!node || id === this.rootId) {
      return; // Cannot delete root or non-existent nodes
    }

    const parentId = node.parentId;
    if (parentId) {
      const parent = this.nodes[parentId];
      if (parent) {
        this.nodes[parentId] = {
          ...parent,
          children: (parent.children || []).filter((childId) => childId !== id),
        };
      }
    }

    // Recursively delete children
    this.deleteRecursive(id);
  }

  /**
   * List all direct children of a folder
   */
  listDirectory(folderId: string): VFSNode[] {
    const folder = this.nodes[folderId];
    if (!folder || folder.type !== 'folder') {
      return [];
    }

    return (folder.children || [])
      .map((childId) => this.nodes[childId])
      .filter((node): node is VFSNode => node !== undefined);
  }

  /**
   * Get the full path of a node
   */
  getNodePath(id: string): string {
    const parts: string[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const node = this.nodes[currentId];
      if (!node) break;

      if (currentId !== this.rootId) {
        parts.unshift(node.name);
      }

      currentId = node.parentId;
    }

    return '/' + parts.join('/');
  }

  /**
   * Helper: Recursively delete a node and all its descendants
   */
  private deleteRecursive(id: string): void {
    const node = this.nodes[id];
    if (!node) return;

    if (node.type === 'folder' && node.children) {
      node.children.forEach((childId) => this.deleteRecursive(childId));
    }

    delete this.nodes[id];
  }

  /**
   * Helper: Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }
}

