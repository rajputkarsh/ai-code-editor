/**
 * Storage Utilities for Workspace Persistence
 * 
 * Phase 1.6 - Storage Strategy Implementation
 * 
 * This module provides utilities for:
 * - Calculating workspace storage size
 * - Enforcing storage limits
 * - Tracking storage usage per user
 * 
 * Storage Strategy (Phase 1.6):
 * - All workspace data stored in PostgreSQL database
 * - File contents stored as text in JSONB (vfsData)
 * - No binary files or large assets supported initially
 * - Storage limits enforced per user
 */

import type { VFSStructure, VFSNode } from '../types';

/**
 * Calculate the storage size of a VFS structure in bytes
 * 
 * This calculates the approximate storage size by:
 * - Summing the length of all file contents
 * - Adding overhead for node metadata (names, IDs, etc.)
 * 
 * Note: This is an approximation. Actual database storage may differ
 * due to JSONB compression and database overhead.
 * 
 * @param vfs - Virtual file system structure
 * @returns Size in bytes
 */
export function calculateVFSSize(vfs: VFSStructure): number {
  let totalSize = 0;

  // Iterate through all nodes
  for (const nodeId in vfs.nodes) {
    const node = vfs.nodes[nodeId];
    
    // Add size of file content (if it's a file)
    if (node.type === 'file' && node.content) {
      // Use Buffer to get accurate byte size (handles UTF-8 correctly)
      totalSize += Buffer.byteLength(node.content, 'utf8');
    }
    
    // Add overhead for node metadata
    totalSize += calculateNodeMetadataSize(node);
  }

  return totalSize;
}

/**
 * Calculate the approximate size of node metadata
 * 
 * Includes:
 * - Node ID
 * - Node name
 * - Parent ID
 * - Children array (for folders)
 * - Other metadata fields
 * 
 * @param node - VFS node
 * @returns Size in bytes
 */
function calculateNodeMetadataSize(node: VFSNode): number {
  let size = 0;

  // ID (UUID string)
  size += Buffer.byteLength(node.id, 'utf8');

  // Name
  size += Buffer.byteLength(node.name, 'utf8');

  // Parent ID (if present)
  if (node.parentId) {
    size += Buffer.byteLength(node.parentId, 'utf8');
  }

  // Children array (for folders)
  if (node.children) {
    node.children.forEach((childId) => {
      size += Buffer.byteLength(childId, 'utf8');
    });
  }

  // Add overhead for JSON structure (brackets, commas, quotes, etc.)
  // Approximate: 50 bytes per node
  size += 50;

  return size;
}

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Check if adding a workspace would exceed user's storage limit
 * 
 * @param currentTotalSize - Current total storage used by user (bytes)
 * @param newWorkspaceSize - Size of workspace to add (bytes)
 * @param maxStorageBytes - Maximum storage allowed per user (bytes)
 * @returns true if within limit, false if would exceed
 */
export function isWithinStorageLimit(
  currentTotalSize: number,
  newWorkspaceSize: number,
  maxStorageBytes: number
): boolean {
  return currentTotalSize + newWorkspaceSize <= maxStorageBytes;
}

/**
 * Calculate total storage used by a user across all workspaces
 * 
 * This is a helper for enforcing per-user storage limits.
 * Should be called before creating or updating workspaces.
 * 
 * @param workspaces - Array of VFS structures for all user workspaces
 * @returns Total size in bytes
 */
export function calculateTotalUserStorage(workspaces: VFSStructure[]): number {
  return workspaces.reduce((total, vfs) => {
    return total + calculateVFSSize(vfs);
  }, 0);
}

/**
 * Storage limit error class
 * 
 * Thrown when a workspace operation would exceed storage limits.
 */
export class StorageLimitExceededError extends Error {
  constructor(
    public currentSize: number,
    public attemptedSize: number,
    public maxSize: number
  ) {
    super(
      `Storage limit exceeded. Current: ${formatBytes(currentSize)}, ` +
      `Attempted: ${formatBytes(attemptedSize)}, ` +
      `Max: ${formatBytes(maxSize)}`
    );
    this.name = 'StorageLimitExceededError';
  }
}

/**
 * Workspace count limit error class
 * 
 * Thrown when a user tries to create more workspaces than allowed.
 */
export class WorkspaceCountLimitExceededError extends Error {
  constructor(
    public currentCount: number,
    public maxCount: number
  ) {
    super(
      `Workspace count limit exceeded. Current: ${currentCount}, Max: ${maxCount}`
    );
    this.name = 'WorkspaceCountLimitExceededError';
  }
}

