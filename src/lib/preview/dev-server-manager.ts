/**
 * Dev Server Manager
 * 
 * Phase 4.5: Automatically manages dev servers for Vite/Next.js projects.
 * Integrates with WebContainer to start dev servers and track their URLs.
 */

import type { VFSStructure } from '@/lib/workspace/types';
import { streamTerminalExecution } from '@/lib/terminal/client';
import type { TerminalStreamEvent } from '@/lib/terminal/types';

export interface DevServerInfo {
  url: string;
  port: number;
  projectType: 'vite' | 'nextjs';
  isRunning: boolean;
  startTime: number;
}

export interface DevServerManagerOptions {
  onServerReady?: (info: DevServerInfo) => void;
  onServerError?: (error: string) => void;
  onStatusChange?: (status: string) => void;
}

/**
 * Dev Server Manager
 * Automatically starts and manages dev servers for preview
 */
export class DevServerManager {
  private activeServers: Map<string, DevServerInfo> = new Map();
  private options: DevServerManagerOptions;
  private abortControllers: Map<string, AbortController> = new Map();
  private serverReadyListeners: Set<(info: DevServerInfo) => void> = new Set();

  constructor(options: DevServerManagerOptions = {}) {
    this.options = options;
  }

  /**
   * Get dev server URL for a project type
   */
  getServerUrl(projectType: 'vite' | 'nextjs', workspaceId?: string): string | null {
    const key = this.getServerKey(projectType, workspaceId);
    const server = this.activeServers.get(key);
    return server?.isRunning ? server.url : null;
  }

  /**
   * Check if a dev server is running
   */
  isServerRunning(projectType: 'vite' | 'nextjs', workspaceId?: string): boolean {
    const key = this.getServerKey(projectType, workspaceId);
    const server = this.activeServers.get(key);
    return server?.isRunning ?? false;
  }

  /**
   * Start a dev server for the given project type
   */
  async startDevServer(
    vfs: VFSStructure,
    projectType: 'vite' | 'nextjs',
    workspaceId?: string
  ): Promise<string> {
    const key = this.getServerKey(projectType, workspaceId);
    
    // Check if server is already running
    const existing = this.activeServers.get(key);
    if (existing?.isRunning) {
      return existing.url;
    }

    // Stop any existing server for this project
    await this.stopDevServer(projectType, workspaceId);

    // Determine the command to run
    const command = this.getDevCommand(vfs, projectType);
    if (!command) {
      throw new Error(`No dev script found for ${projectType} project`);
    }

    this.options.onStatusChange?.(`Starting ${projectType} dev server...`);

    // Create abort controller for this server
    const abortController = new AbortController();
    this.abortControllers.set(key, abortController);

    // Track server info
    const serverInfo: DevServerInfo = {
      url: '',
      port: 0,
      projectType,
      isRunning: false,
      startTime: Date.now(),
    };
    this.activeServers.set(key, serverInfo);

    // Start the dev server
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Dev server failed to start within 60 seconds`));
        }
      }, 60000);

      streamTerminalExecution({
        command,
        signal: abortController.signal,
        onEvent: (event: TerminalStreamEvent) => {
          if (event.type === 'status' || event.type === 'output' || event.type === 'error') {
            this.options.onStatusChange?.(event.text);
          }

          // Parse server-ready events from WebContainer
          if (event.type === 'status' && event.text.includes('Server ready')) {
            // Extract URL from status message
            // Format: "Server ready on port 12345. Open: https://..."
            const urlMatch = event.text.match(/Open:\s*(https?:\/\/[^\s]+)/);
            const portMatch = event.text.match(/port\s+(\d+)/);
            
            if (urlMatch && portMatch) {
              const url = urlMatch[1];
              const port = parseInt(portMatch[1], 10);
              
              serverInfo.url = url;
              serverInfo.port = port;
              serverInfo.isRunning = true;
              
              clearTimeout(timeout);
              if (!resolved) {
                resolved = true;
                this.options.onServerReady?.(serverInfo);
                resolve(url);
              }
            }
          }

          // Check for common dev server ready patterns in output
          if (event.type === 'output' || event.type === 'status') {
            const text = event.text;
            
            // Vite patterns:
            // "Local: http://localhost:5173/"
            // "  ➜  Local:   http://localhost:5173/"
            // "VITE vX.X.X  ready in XXX ms"
            const viteUrlMatch = text.match(/(?:Local|➜).*?(https?:\/\/[^\s\)]+)/i);
            const viteReadyMatch = text.match(/VITE.*ready/i);
            
            if (viteUrlMatch && !resolved) {
              const url = viteUrlMatch[1].trim().replace(/[\)\s]+$/, '');
              serverInfo.url = url;
              serverInfo.port = this.extractPortFromUrl(url);
              serverInfo.isRunning = true;
              
              clearTimeout(timeout);
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(url);
            } else if (viteReadyMatch && !resolved) {
              // Vite is ready, try to construct URL from common port
              const defaultViteUrl = 'http://localhost:5173';
              serverInfo.url = defaultViteUrl;
              serverInfo.port = 5173;
              serverInfo.isRunning = true;
              
              clearTimeout(timeout);
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(defaultViteUrl);
            }

            // Next.js patterns:
            // "Local:        http://localhost:3000"
            // "Ready in Xms"
            // "- Local:        http://localhost:3000"
            const nextUrlMatch = text.match(/(?:Local|➜).*?(https?:\/\/[^\s\)]+)/i);
            const nextReadyMatch = text.match(/Ready\s+in/i);
            
            if (nextUrlMatch && !resolved && projectType === 'nextjs') {
              const url = nextUrlMatch[1].trim().replace(/[\)\s]+$/, '');
              serverInfo.url = url;
              serverInfo.port = this.extractPortFromUrl(url);
              serverInfo.isRunning = true;
              
              clearTimeout(timeout);
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(url);
            } else if (nextReadyMatch && !resolved && projectType === 'nextjs') {
              // Next.js is ready, try to construct URL from common port
              const defaultNextUrl = 'http://localhost:3000';
              serverInfo.url = defaultNextUrl;
              serverInfo.port = 3000;
              serverInfo.isRunning = true;
              
              clearTimeout(timeout);
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(defaultNextUrl);
            }
          }

          if (event.type === 'error') {
            this.options.onServerError?.(event.text);
            if (!resolved && event.text.includes('failed') || event.text.includes('error')) {
              clearTimeout(timeout);
              if (!resolved) {
                resolved = true;
                reject(new Error(event.text));
              }
            }
          }
        },
        onDone: () => {
          // Server stopped
          serverInfo.isRunning = false;
          if (!resolved) {
            clearTimeout(timeout);
            resolved = true;
            reject(new Error('Dev server stopped unexpectedly'));
          }
        },
      }).catch((error) => {
        if (!resolved) {
          clearTimeout(timeout);
          resolved = true;
          serverInfo.isRunning = false;
          reject(error);
        }
      });
    });
  }

  /**
   * Stop a dev server
   */
  async stopDevServer(projectType: 'vite' | 'nextjs', workspaceId?: string): Promise<void> {
    const key = this.getServerKey(projectType, workspaceId);
    const abortController = this.abortControllers.get(key);
    
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(key);
    }

    const server = this.activeServers.get(key);
    if (server) {
      server.isRunning = false;
      this.activeServers.delete(key);
    }
  }

  /**
   * Stop all dev servers
   */
  async stopAllServers(): Promise<void> {
    const keys = Array.from(this.activeServers.keys());
    await Promise.all(
      keys.map((key) => {
        const [projectType] = key.split(':');
        return this.stopDevServer(projectType as 'vite' | 'nextjs');
      })
    );
  }

  /**
   * Get the dev command for a project type
   */
  private getDevCommand(vfs: VFSStructure, projectType: 'vite' | 'nextjs'): string | null {
    // Find package.json
    const packageJsonNode = Object.values(vfs.nodes).find(
      (node) => node.name === 'package.json' && node.type === 'file'
    );

    if (!packageJsonNode?.content) {
      return null;
    }

    try {
      const packageJson = JSON.parse(packageJsonNode.content) as {
        scripts?: Record<string, string>;
      };

      const scripts = packageJson.scripts || {};
      
      // Check for common dev script names
      if (scripts.dev) {
        return `npm run dev`;
      }
      if (scripts.start) {
        return `npm start`;
      }
      if (scripts['start:dev']) {
        return `npm run start:dev`;
      }

      // Default based on project type
      if (projectType === 'vite') {
        return `npm run dev`;
      }
      if (projectType === 'nextjs') {
        return `npm run dev`;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract port from URL
   */
  private extractPortFromUrl(url: string): number {
    const match = url.match(/:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get server key for tracking
   */
  private getServerKey(projectType: 'vite' | 'nextjs', workspaceId?: string): string {
    return `${projectType}:${workspaceId || 'default'}`;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopAllServers();
    this.activeServers.clear();
    this.abortControllers.clear();
    this.serverReadyListeners.clear();
  }
}
