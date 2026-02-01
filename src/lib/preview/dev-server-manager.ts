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
      let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          timeoutId = null;
          reject(new Error(`Dev server failed to start within 90 seconds`));
        }
      }, 90000);
      
      const clearTimeoutSafe = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

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
              
              clearTimeoutSafe();
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
              
              clearTimeoutSafe();
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(url);
            } else if (viteReadyMatch && !resolved) {
              // Vite is ready, try to construct URL from common port
              const defaultViteUrl = 'http://localhost:5173';
              serverInfo.url = defaultViteUrl;
              serverInfo.port = 5173;
              serverInfo.isRunning = true;
              
              clearTimeoutSafe();
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(defaultViteUrl);
            }

            // Next.js patterns:
            // "Local:        http://localhost:3000"
            // "Ready in Xms"
            // "- Local:        http://localhost:3000"
            // "○ Compiling / ..."
            // "✓ Ready in Xms"
            const nextUrlMatch = text.match(/(?:Local|➜).*?(https?:\/\/[^\s\)]+)/i);
            const nextReadyMatch = text.match(/(?:✓|Ready)\s+(?:in|compiled)/i);
            const nextCompilingMatch = text.match(/○\s+Compiling/i);
            
            if (nextUrlMatch && !resolved && projectType === 'nextjs') {
              const url = nextUrlMatch[1].trim().replace(/[\)\s]+$/, '');
              serverInfo.url = url;
              serverInfo.port = this.extractPortFromUrl(url);
              serverInfo.isRunning = true;
              
              clearTimeoutSafe();
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(url);
            } else if (nextReadyMatch && !resolved && projectType === 'nextjs') {
              // Next.js is ready, try to construct URL from common port
              const defaultNextUrl = 'http://localhost:3000';
              serverInfo.url = defaultNextUrl;
              serverInfo.port = 3000;
              serverInfo.isRunning = true;
              
              clearTimeoutSafe();
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(defaultNextUrl);
            } else if (nextCompilingMatch && !resolved && projectType === 'nextjs') {
              // Next.js is compiling - this is a good sign, extend timeout
              clearTimeoutSafe();
              timeoutId = setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  timeoutId = null;
                  reject(new Error(`Dev server is still compiling after 120 seconds. Please check the terminal for details.`));
                }
              }, 120000);
            }
          }

          if (event.type === 'error') {
            this.options.onServerError?.(event.text);
            // Only reject on actual errors, not warnings
            if (!resolved && (event.text.includes('failed') || event.text.includes('Error:') || event.text.includes('error:'))) {
              clearTimeoutSafe();
              if (!resolved) {
                resolved = true;
                serverInfo.isRunning = false;
                reject(new Error(event.text));
              }
            }
          }

          // Handle exit events - for dev servers, exit code 124 means it's still running
          if (event.type === 'exit') {
            // Exit code 124 is used for long-running dev servers that are still active
            // This means the process is running but hit a timeout (which is expected for dev servers)
            if (event.exitCode === 124) {
              // If server is already running, this is fine
              if (serverInfo.isRunning) {
                return;
              }
              // If server isn't running yet, it might still be starting
              // Don't reject immediately - wait a bit more
              if (!resolved) {
                // Extend timeout a bit more
                clearTimeoutSafe();
                timeoutId = setTimeout(() => {
                  if (!resolved && !serverInfo.isRunning) {
                    resolved = true;
                    timeoutId = null;
                    reject(new Error('Dev server process timed out before becoming ready. Check terminal for details.'));
                  }
                }, 30000);
              }
              return;
            }
            // For other exit codes, only reject if server wasn't marked as running
            if (!resolved && !serverInfo.isRunning && event.exitCode !== 0) {
              clearTimeoutSafe();
              resolved = true;
              serverInfo.isRunning = false;
              reject(new Error(`Dev server exited with code ${event.exitCode}`));
            }
          }
        },
        onDone: () => {
          // Stream ended - this is normal for long-running processes
          // For dev servers, the stream ends but the server continues running
          // Don't reject if server is already running
          if (serverInfo.isRunning) {
            // Server is running, stream ending is expected
            return;
          }
          // Only reject if we never detected the server as ready
          // Give it a bit more time - sometimes the ready message comes right before stream ends
          if (!resolved) {
            // Wait a bit longer to see if server becomes ready
            setTimeout(() => {
              if (!resolved && !serverInfo.isRunning) {
                clearTimeoutSafe();
                resolved = true;
                serverInfo.isRunning = false;
                reject(new Error('Dev server stream ended before server was ready. The server may still be starting - check the terminal output for details.'));
              }
            }, 5000);
          }
        },
      }).catch((error) => {
        if (!resolved) {
          clearTimeoutSafe();
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
