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

/**
 * Import a ZIP file and create a workspace
 */
export async function importZipFile(
  file: File,
  options: ZipImportOptions = {}
): Promise<Workspace> {
  const zip = new JSZip();
  
  try {
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
    
    for (const path of files) {
      const zipEntry = zipContent.files[path];
      
      // Skip root directory entries
      if (path === '' || path === '/') continue;
      
      // Normalize path (remove leading/trailing slashes)
      const normalizedPath = path.replace(/^\/+|\/+$/g, '');
      const pathParts = normalizedPath.split('/');
      const name = pathParts[pathParts.length - 1];
      
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
        const content = await zipEntry.async('text');
        vfs.createFile(parentFolderId, name, content);
      }
    }
    
    // Create workspace metadata
    const projectName = options.projectName || file.name.replace(/\.zip$/i, '') || 'Imported Project';
    const metadata: WorkspaceMetadata = {
      id: crypto.randomUUID(),
      name: projectName,
      source: 'zip',
      createdAt: new Date(),
      lastOpenedAt: new Date(),
    };
    
    return {
      metadata,
      vfs: vfs.getStructure(),
    };
  } catch (error) {
    console.error('Failed to import ZIP file:', error);
    throw new Error('Failed to extract ZIP file. Please ensure it is a valid ZIP archive.');
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



