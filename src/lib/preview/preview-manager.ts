/**
 * Preview Manager
 * 
 * Phase 4.5: Manages live preview state and project type detection.
 * Handles preview updates when workspace files change.
 * 
 * Architecture:
 * - Preview runs in isolated iframe
 * - Supports static HTML/CSS/JS, React apps, and basic dev servers
 * - Debounced updates to prevent excessive rebuilds
 * - Best-effort preview (fails gracefully for unsupported projects)
 */

import type { VFSStructure, VFSNode } from '@/lib/workspace/types';
import { DevServerManager, type DevServerInfo } from './dev-server-manager';

export type PreviewProjectType = 
  | 'static'           // Static HTML/CSS/JS
  | 'react'            // React app (client-side)
  | 'vite'             // Vite project (requires dev server)
  | 'nextjs'           // Next.js project (client-side preview only)
  | 'unsupported';     // Project type not supported

export interface PreviewState {
  isEnabled: boolean;
  projectType: PreviewProjectType;
  previewUrl: string | null;
  error: string | null;
  isLoading: boolean;
}

export interface PreviewManagerOptions {
  onStateChange?: (state: PreviewState) => void;
  debounceMs?: number;
  workspaceId?: string;
  onStatusChange?: (status: string) => void;
}

/**
 * Detect project type from VFS structure
 */
export function detectProjectType(vfs: VFSStructure): PreviewProjectType {
  const nodes = vfs.nodes;
  const rootId = vfs.rootId;
  
  // Check for package.json
  const packageJsonNode = Object.values(nodes).find(
    node => node.name === 'package.json' && node.type === 'file'
  );
  
  if (packageJsonNode && packageJsonNode.content) {
    try {
      const packageJson = JSON.parse(packageJsonNode.content);
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for Next.js
      if (dependencies['next']) {
        return 'nextjs';
      }
      
      // Check for Vite
      if (dependencies['vite'] || packageJson.devDependencies?.['vite']) {
        return 'vite';
      }
      
      // Check for React
      if (dependencies['react']) {
        return 'react';
      }
    } catch {
      // Invalid package.json, fall through to static check
    }
  }
  
  // Check for index.html (static site)
  const hasIndexHtml = Object.values(nodes).some(
    node => node.name === 'index.html' && node.type === 'file'
  );
  
  if (hasIndexHtml) {
    return 'static';
  }
  
  return 'unsupported';
}

/**
 * Get entry point for preview based on project type
 */
export function getPreviewEntryPoint(vfs: VFSStructure, projectType: PreviewProjectType): string | null {
  const nodes = vfs.nodes;
  
  switch (projectType) {
    case 'static':
      // Find index.html
      const indexHtml = Object.values(nodes).find(
        node => node.name === 'index.html' && node.type === 'file'
      );
      return indexHtml ? indexHtml.id : null;
      
    case 'react':
    case 'vite':
    case 'nextjs':
      // For React/Vite/Next.js, we need to find the entry point
      // Check package.json for main/entry
      const packageJsonNode = Object.values(nodes).find(
        node => node.name === 'package.json' && node.type === 'file'
      );
      
      if (packageJsonNode?.content) {
        try {
          const packageJson = JSON.parse(packageJsonNode.content);
          const entry = packageJson.main || packageJson.module || 'index.js';
          
          // Find the entry file
          const entryNode = Object.values(nodes).find(
            node => {
              const path = getNodePath(vfs, node.id);
              return path.endsWith(entry) || path.endsWith('src/index.js') || path.endsWith('src/index.tsx');
            }
          );
          
          if (entryNode) {
            return entryNode.id;
          }
          
          // Fallback: look for common entry points
          const commonEntries = ['src/index.js', 'src/index.tsx', 'src/main.js', 'src/main.tsx', 'index.js', 'index.tsx'];
          for (const entryPath of commonEntries) {
            const node = Object.values(nodes).find(
              n => getNodePath(vfs, n.id) === entryPath || getNodePath(vfs, n.id).endsWith(entryPath)
            );
            if (node) {
              return node.id;
            }
          }
        } catch {
          // Invalid package.json
        }
      }
      
      return null;
      
    default:
      return null;
  }
}

/**
 * Get full path of a node in the VFS
 */
function getNodePath(vfs: VFSStructure, nodeId: string): string {
  const parts: string[] = [];
  let currentId: string | null = nodeId;
  const nodes = vfs.nodes;
  
  while (currentId) {
    const node: VFSNode | undefined = nodes[currentId];
    if (!node) break;
    
    if (currentId !== vfs.rootId) {
      parts.unshift(node.name);
    }
    
    currentId = node.parentId;
  }
  
  return '/' + parts.join('/');
}

/**
 * Preview Manager class
 * Manages preview state and handles file change updates
 */
export class PreviewManager {
  private state: PreviewState;
  private vfs: VFSStructure | null = null;
  private options: Required<Omit<PreviewManagerOptions, 'workspaceId'>> & { workspaceId?: string };
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private updateCallbacks: Set<(state: PreviewState) => void> = new Set();
  private devServerManager: DevServerManager;
  
  constructor(options: PreviewManagerOptions = {}) {
    this.options = {
      onStateChange: options.onStateChange || (() => {}),
      debounceMs: options.debounceMs ?? 300,
      workspaceId: options.workspaceId,
      onStatusChange: options.onStatusChange || (() => {}),
    };
    
    this.state = {
      isEnabled: false,
      projectType: 'unsupported',
      previewUrl: null,
      error: null,
      isLoading: false,
    };

    // Initialize dev server manager
    this.devServerManager = new DevServerManager({
      onServerReady: (info: DevServerInfo) => {
        this.options.onStatusChange?.(`Dev server ready at ${info.url}`);
        // Update preview when server is ready
        if (this.state.isEnabled && this.vfs) {
          this.scheduleUpdate();
        }
      },
      onServerError: (error: string) => {
        this.options.onStatusChange?.(`Dev server error: ${error}`);
      },
      onStatusChange: (status: string) => {
        this.options.onStatusChange?.(status);
      },
    });
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: PreviewState) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }
  
  /**
   * Update VFS and trigger preview update if enabled
   */
  updateVFS(vfs: VFSStructure): void {
    this.vfs = vfs;
    
    if (this.state.isEnabled) {
      this.scheduleUpdate();
    } else {
      // Update project type detection even when disabled
      const projectType = detectProjectType(vfs);
      this.updateState({ projectType });
    }
  }
  
  /**
   * Enable preview
   */
  enable(): void {
    if (this.state.isEnabled) return;
    
    if (!this.vfs) {
      this.updateState({
        isEnabled: true,
        error: 'No workspace loaded',
      });
      return;
    }
    
    const projectType = detectProjectType(this.vfs);

    if (projectType === 'nextjs') {
      this.updateState({
        isEnabled: true,
        projectType,
        error: 'Next.js preview requires server-based execution. Turbopack is not supported in WebContainer.',
        isLoading: false,
        previewUrl: null,
      });
      return;
    }
    
    if (projectType === 'unsupported') {
      this.updateState({
        isEnabled: true,
        projectType,
        error: 'Project type not supported for preview. Supported types: static HTML, React, Vite.',
      });
      return;
    }
    
    this.updateState({
      isEnabled: true,
      projectType,
      error: null,
      isLoading: true,
    });
    
    // Trigger initial preview generation
    this.scheduleUpdate();
  }
  
  /**
   * Disable preview
   */
  disable(): void {
    if (!this.state.isEnabled) return;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.updateState({
      isEnabled: false,
      previewUrl: null,
      error: null,
      isLoading: false,
    });
  }
  
  /**
   * Toggle preview on/off
   */
  toggle(): void {
    if (this.state.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
  }
  
  /**
   * Get current state
   */
  getState(): PreviewState {
    return { ...this.state };
  }
  
  /**
   * Schedule a debounced preview update
   */
  private scheduleUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.updatePreview();
    }, this.options.debounceMs);
  }
  
  /**
   * Update preview based on current VFS state
   */
  private async updatePreview(): Promise<void> {
    if (!this.vfs || !this.state.isEnabled) return;
    
    // Revoke old blob URL before creating new one
    if (this.state.previewUrl && this.state.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.state.previewUrl);
    }
    
    this.updateState({ isLoading: true, error: null });
    
    try {
      const previewUrl = await this.generatePreviewUrl(this.vfs, this.state.projectType);
      
      this.updateState({
        previewUrl,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate preview';
      this.updateState({
        previewUrl: null,
        isLoading: false,
        error: errorMessage,
      });
    }
  }
  
  /**
   * Generate preview URL based on project type
   */
  private async generatePreviewUrl(vfs: VFSStructure, projectType: PreviewProjectType): Promise<string> {
    switch (projectType) {
      case 'static':
        return this.generateStaticPreviewUrl(vfs);
        
      case 'react':
        return this.generateReactPreviewUrl(vfs);
        
      case 'vite':
        // Automatically start dev server if not running
        return this.generateDevServerPreviewUrl(vfs, projectType);

      case 'nextjs':
        throw new Error('Next.js preview requires server-based execution. Turbopack is not supported in WebContainer.');
        
      default:
        throw new Error('Unsupported project type');
    }
  }

  /**
   * Generate preview URL using dev server
   */
  private async generateDevServerPreviewUrl(
    vfs: VFSStructure,
    projectType: 'vite' | 'nextjs'
  ): Promise<string> {
    // Check if server is already running
    const existingUrl = this.devServerManager.getServerUrl(projectType, this.options.workspaceId);
    if (existingUrl) {
      console.info('[Preview] Reusing existing dev server URL', {
        projectType,
        workspaceId: this.options.workspaceId,
        url: existingUrl,
      });
      return existingUrl;
    }

    // Start dev server automatically
    try {
      this.options.onStatusChange?.(`Starting ${projectType} dev server...`);
      const url = await this.devServerManager.startDevServer(
        vfs,
        projectType,
        this.options.workspaceId
      );
      console.info('[Preview] Dev server URL bound to preview state', {
        projectType,
        workspaceId: this.options.workspaceId,
        url,
      });
      return url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start dev server';
      throw new Error(`Failed to start ${projectType} dev server: ${errorMessage}`);
    }
  }
  
  /**
   * Generate preview URL for static HTML/CSS/JS
   * 
   * This creates a blob URL with the HTML content.
   * For a full implementation, we'd need to:
   * - Resolve relative paths for CSS/JS files
   * - Inline external resources or create data URLs
   * - Handle subdirectories properly
   * 
   * Current implementation is best-effort and works for:
   * - Self-contained HTML files
   * - HTML with inline CSS/JS
   * - HTML with absolute URLs for external resources
   */
  private generateStaticPreviewUrl(vfs: VFSStructure): string {
    const entryPointId = getPreviewEntryPoint(vfs, 'static');
    if (!entryPointId) {
      throw new Error('No index.html found');
    }
    
    const entryNode = vfs.nodes[entryPointId];
    if (!entryNode || entryNode.type !== 'file' || !entryNode.content) {
      throw new Error('Invalid index.html');
    }
    
    // Get the directory path of the HTML file
    const htmlPath = getNodePath(vfs, entryPointId);
    const htmlDir = htmlPath.substring(0, htmlPath.lastIndexOf('/') || 0);
    
    // Process HTML content to resolve relative paths
    // This is a simplified version - in production, we'd use a proper HTML parser
    let htmlContent = entryNode.content;
    
    // Try to resolve relative paths for CSS and JS
    // Match: href="path/to/file.css" or src="path/to/file.js"
    htmlContent = htmlContent.replace(
      /(href|src)=["']([^"']+)["']/g,
      (match, attr, path) => {
        // Skip absolute URLs and data URLs
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('#')) {
          return match;
        }
        
        // Resolve relative path
        const resolvedPath = this.resolveRelativePath(htmlDir, path, vfs);
        if (resolvedPath) {
          // Try to inline the file content
          const fileContent = this.getFileContentByPath(vfs, resolvedPath);
          if (fileContent !== null) {
            if (attr === 'href' && resolvedPath.endsWith('.css')) {
              // Inline CSS
              return `${attr}="data:text/css;charset=utf-8,${encodeURIComponent(fileContent)}"`;
            } else if (attr === 'src' && (resolvedPath.endsWith('.js') || resolvedPath.endsWith('.mjs'))) {
              // Inline JS
              return `${attr}="data:text/javascript;charset=utf-8,${encodeURIComponent(fileContent)}"`;
            }
          }
        }
        
        // If we can't resolve or inline, return original
        return match;
      }
    );
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }
  
  /**
   * Resolve a relative path from a base directory
   */
  private resolveRelativePath(baseDir: string, relativePath: string, vfs: VFSStructure): string | null {
    // Remove leading ./ or ../
    let path = relativePath.replace(/^\.\//, '');
    
    // Handle parent directory references (simplified)
    if (path.startsWith('../')) {
      // For now, we don't handle parent directory traversal
      // In production, we'd properly resolve this
      return null;
    }
    
    // Combine base directory with relative path
    const resolved = baseDir === '/' ? `/${path}` : `${baseDir}/${path}`;
    
    // Normalize path (remove double slashes)
    return resolved.replace(/\/+/g, '/');
  }
  
  /**
   * Get file content by path
   */
  private getFileContentByPath(vfs: VFSStructure, path: string): string | null {
    // Find node by path
    const node = Object.values(vfs.nodes).find((n) => {
      const nodePath = getNodePath(vfs, n.id);
      return nodePath === path || nodePath.endsWith(path);
    });
    
    if (node && node.type === 'file' && node.content) {
      return node.content;
    }
    
    return null;
  }
  
  /**
   * Generate preview URL for React app
   * This is a simplified client-side bundling approach
   */
  private async generateReactPreviewUrl(vfs: VFSStructure): Promise<string> {
    // For React apps, we need to:
    // 1. Find the entry point
    // 2. Bundle dependencies (simplified - use CDN for React)
    // 3. Create an HTML wrapper with the bundled code
    
    const entryPointId = getPreviewEntryPoint(vfs, 'react');
    if (!entryPointId) {
      throw new Error('No React entry point found');
    }
    
    // For now, return a placeholder that indicates React preview needs more work
    // In a full implementation, we'd use esbuild or similar to bundle
    throw new Error('React preview requires bundling. Please use a dev server (npm run dev) or wait for full bundling support.');
  }
  
  /**
   * Update state and notify subscribers
   */
  private updateState(updates: Partial<PreviewState>): void {
    this.state = { ...this.state, ...updates };
    
    // Notify all subscribers
    this.updateCallbacks.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Preview state callback error:', error);
      }
    });
    
    // Call the main callback
    this.options.onStateChange(this.state);
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Revoke blob URLs to free memory
    if (this.state.previewUrl && this.state.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.state.previewUrl);
    }
    
    // Stop all dev servers
    this.devServerManager.dispose();
    
    this.updateCallbacks.clear();
  }
}
