/**
 * ZIP Import Utilities
 * Extracts ZIP files and populates VFS
 */

import JSZip from 'jszip';
import { VirtualFileSystem } from './vfs';
import { WorkspaceMetadata, Workspace } from './types';

export interface ZipImportOptions {
  projectName?: string;
}

const MAX_ZIP_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25MB total imported text

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
  '.cache',
  '.idea',
  '.vscode',
  '__MACOSX',
]);

const IGNORED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
]);

function shouldIgnorePath(pathParts: string[], name: string): boolean {
  if (IGNORED_FILES.has(name)) return true;
  return pathParts.some((part) => IGNORED_DIRS.has(part));
}

function getZipEntrySize(zipEntry: JSZip.JSZipObject): number | null {
  const maybeEntry = zipEntry as unknown as {
    _data?: { uncompressedSize?: number };
  };
  const size = maybeEntry._data?.uncompressedSize;
  return typeof size === 'number' ? size : null;
}

/**
 * Import a ZIP file and create a workspace
 */
export async function importZipFile(
  file: File,
  options: ZipImportOptions = {}
): Promise<Workspace> {
  const zip = new JSZip();
  
  try {
    if (file.size > MAX_ZIP_BYTES) {
      throw new Error(
        `ZIP file is too large (${Math.round(file.size / (1024 * 1024))}MB). ` +
        `Please remove node_modules/.git and try again.`
      );
    }

    // Load ZIP file
    const zipContent = await zip.loadAsync(file);
    
    // Create new VFS
    const vfs = new VirtualFileSystem();
    const rootId = vfs.getRootId();
    
    // Track folder IDs by path
    const folderMap = new Map<string, string>();
    folderMap.set('', rootId);
    
    // Get all files and sort by path (to ensure parents are created first)
    const files = Object.keys(zipContent.files).sort();
    
    let totalBytes = 0;
    let skippedFiles = 0;

    for (const path of files) {
      const zipEntry = zipContent.files[path];
      
      // Skip root directory entries
      if (path === '' || path === '/') continue;
      
      // Normalize path (remove leading/trailing slashes)
      const normalizedPath = path.replace(/^\/+|\/+$/g, '');
      const pathParts = normalizedPath.split('/');
      const name = pathParts[pathParts.length - 1];
      if (shouldIgnorePath(pathParts, name)) {
        skippedFiles += 1;
        continue;
      }
      
      // Build parent path
      const parentPath = pathParts.slice(0, -1).join('/');
      
      // Ensure parent folder exists
      if (!folderMap.has(parentPath)) {
        // Create missing parent folders
        let currentPath = '';
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          const prevPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          
          if (!folderMap.has(currentPath)) {
            const parentFolderId = folderMap.get(prevPath) || rootId;
            const folderId = vfs.createFolder(parentFolderId, part);
            folderMap.set(currentPath, folderId);
          }
        }
      }
      
      const parentFolderId = folderMap.get(parentPath) || rootId;
      
      if (zipEntry.dir) {
        // It's a folder
        if (!folderMap.has(normalizedPath)) {
          const folderId = vfs.createFolder(parentFolderId, name);
          folderMap.set(normalizedPath, folderId);
        }
      } else {
        // It's a file
        const entrySize = getZipEntrySize(zipEntry);
        if (entrySize && entrySize > MAX_FILE_BYTES) {
          skippedFiles += 1;
          continue;
        }

        const content = await zipEntry.async('text');
        totalBytes += content.length;
        if (totalBytes > MAX_TOTAL_BYTES) {
          throw new Error(
            'Imported project is too large after filtering. ' +
            'Please remove node_modules/.git and large assets before importing.'
          );
        }
        vfs.createFile(parentFolderId, name, content);
      }
    }
    
    // Create workspace metadata
    const projectName = options.projectName || file.name.replace(/\.zip$/i, '') || 'Imported Project';
    const metadata: WorkspaceMetadata = {
      id: crypto.randomUUID(),
      name: projectName,
      source: 'zip',
      type: 'cloud',
      createdAt: new Date(),
      lastOpenedAt: new Date(),
    };
    
    const workspace: Workspace = {
      metadata,
      vfs: vfs.getStructure(),
    };

    if (skippedFiles > 0) {
      console.warn(`[ZIP Import] Skipped ${skippedFiles} files due to ignore rules or size limits.`);
    }

    return workspace;
  } catch (error) {
    console.error('Failed to import ZIP file:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to extract ZIP file. Please ensure it is a valid ZIP archive.';
    throw new Error(message);
  }
}

/**
 * Validate if a file is a valid ZIP
 */
export function isValidZipFile(file: File): boolean {
  return file.type === 'application/zip' || 
         file.type === 'application/x-zip-compressed' ||
         file.name.toLowerCase().endsWith('.zip');
}




