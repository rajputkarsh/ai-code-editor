/**
 * Dev Server Manager
 *
 * Phase 4.5: Automatically manages dev servers for Vite/Next.js projects.
 * Integrates with WebContainer to start dev servers and track their URLs.
 */

import type { VFSStructure } from '@/lib/workspace/types';
import type { TerminalStreamEvent } from '@/lib/terminal/types';
import { runTerminalCommand } from '@/lib/terminal/webcontainer';

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

    // Strict lifecycle: one server process per workspace. Kill existing before spawn.
    await this.stopWorkspaceServers(workspaceId);

    const command = this.getDevCommand(vfs, projectType);
    if (!command) {
      throw new Error(`No dev script found for ${projectType} project`);
    }

    this.options.onStatusChange?.(`Starting ${projectType} dev server...`);

    const abortController = new AbortController();
    this.abortControllers.set(key, abortController);

    const serverInfo: DevServerInfo = {
      url: '',
      port: 0,
      projectType,
      isRunning: false,
      startTime: Date.now(),
    };
    this.activeServers.set(key, serverInfo);

    return new Promise((resolve, reject) => {
      let resolved = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          timeoutId = null;
          reject(new Error('Dev server failed to start within 900 seconds'));
        }
      }, 900_000);

      const clearTimeoutSafe = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const handleExit = (event: TerminalStreamEvent & { type: 'exit' }) => {
        // Exit code 124 is used for long-running dev servers in this runner.
        if (event.exitCode === 124) {
          if (serverInfo.isRunning) {
            return;
          }

          if (!resolved) {
            clearTimeoutSafe();
            timeoutId = setTimeout(() => {
              if (!resolved && !serverInfo.isRunning) {
                resolved = true;
                timeoutId = null;
                reject(
                  new Error(
                    'Dev server process timed out before becoming ready. Check terminal for details.'
                  )
                );
              }
            }, 30_000);
          }
          return;
        }

        if (!resolved && !serverInfo.isRunning && event.exitCode !== 0) {
          clearTimeoutSafe();
          resolved = true;
          serverInfo.isRunning = false;
          reject(new Error(`Dev server exited with code ${event.exitCode}`));
        }
      };

      // Reuse WebContainer execution path; do not open URLs externally.
      void runTerminalCommand({
        command,
        vfs,
        signal: abortController.signal,
        workspaceId,
        onEvent: (event: TerminalStreamEvent) => {
          if (event.type === 'status' || event.type === 'output' || event.type === 'error') {
            this.options.onStatusChange?.(event.text);
          }

          // Only trust WebContainer server-ready event status line.
          if (event.type === 'status' && event.text.startsWith('Server ready on port')) {
            const urlMatch = event.text.match(/Open:\s*(https?:\/\/[^\s]+)/);
            const portMatch = event.text.match(/port\s+(\d+)/);

            if (urlMatch && portMatch && !resolved) {
              const url = urlMatch[1];
              const port = parseInt(portMatch[1], 10);
              console.info('[Preview] server-ready fired', { projectType, workspaceId, port, url });
              this.options.onStatusChange?.(`[Preview] URL received: ${url}`);

              serverInfo.url = url;
              serverInfo.port = port;
              serverInfo.isRunning = true;

              clearTimeoutSafe();
              resolved = true;
              this.options.onServerReady?.(serverInfo);
              resolve(url);
            }
          }

          if (event.type === 'error') {
            this.options.onServerError?.(event.text);
            if (
              !resolved &&
              (event.text.includes('failed') ||
                event.text.includes('Error:') ||
                event.text.includes('error:'))
            ) {
              clearTimeoutSafe();
              resolved = true;
              serverInfo.isRunning = false;
              reject(new Error(event.text));
            }
          }
        },
        onExit: (event) => {
          handleExit(event);
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
   * Stop all running servers for a workspace
   */
  async stopWorkspaceServers(workspaceId?: string): Promise<void> {
    const suffix = `:${workspaceId || 'default'}`;
    const keys = Array.from(this.activeServers.keys()).filter((key) => key.endsWith(suffix));

    await Promise.all(
      keys.map((key) => {
        const [projectType, workspaceIdFromKey] = key.split(':');
        return this.stopDevServer(projectType as 'vite' | 'nextjs', workspaceIdFromKey || undefined);
      })
    );
  }

  /**
   * Stop all dev servers
   */
  async stopAllServers(): Promise<void> {
    const keys = Array.from(this.activeServers.keys());
    await Promise.all(
      keys.map((key) => {
        const [projectType, workspaceIdFromKey] = key.split(':');
        return this.stopDevServer(projectType as 'vite' | 'nextjs', workspaceIdFromKey || undefined);
      })
    );
  }

  /**
   * Get the dev command for a project type
   */
  private getDevCommand(vfs: VFSStructure, projectType: 'vite' | 'nextjs'): string | null {
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
      if (scripts.dev) {
        return 'npm run dev';
      }
      if (scripts.start) {
        return 'npm start';
      }
      if (scripts['start:dev']) {
        return 'npm run start:dev';
      }

      if (projectType === 'vite' || projectType === 'nextjs') {
        return 'npm run dev';
      }

      return null;
    } catch {
      return null;
    }
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
    void this.stopAllServers();
    this.activeServers.clear();
    this.abortControllers.clear();
  }
}
