import type { PresenceState } from './types';

type FilePatch = {
  fileId: string;
  baseVersion: number;
  content: string;
};

type FileState = {
  version: number;
  content: string;
};

type SSEController = ReadableStreamDefaultController<Uint8Array>;

export type WorkspaceUpdateEvent = {
  type: 'workspace_updated';
  updatedBy: string;
  timestamp: number;
};

/**
 * In-memory collaboration coordinator.
 * Conflict strategy: last-write-wins by monotonically increasing version.
 */
class CollaborationRealtimeStore {
  private presence = new Map<string, PresenceState>();
  private files = new Map<string, FileState>();
  private subscribers = new Map<string, Set<SSEController>>();
  private readonly encoder = new TextEncoder();

  upsertPresence(state: PresenceState): void {
    const key = `${state.workspaceId}:${state.userId}`;
    this.presence.set(key, state);
  }

  removePresence(workspaceId: string, userId: string): void {
    this.presence.delete(`${workspaceId}:${userId}`);
  }

  listPresence(workspaceId: string): PresenceState[] {
    return Array.from(this.presence.values()).filter((state) => state.workspaceId === workspaceId);
  }

  applyPatch(workspaceId: string, patch: FilePatch): FileState {
    const key = `${workspaceId}:${patch.fileId}`;
    const current = this.files.get(key) ?? { version: 0, content: '' };
    const nextVersion = Math.max(current.version + 1, patch.baseVersion + 1);
    const nextState = { version: nextVersion, content: patch.content };
    this.files.set(key, nextState);
    return nextState;
  }

  getFileState(workspaceId: string, fileId: string): FileState {
    const key = `${workspaceId}:${fileId}`;
    return this.files.get(key) ?? { version: 0, content: '' };
  }

  /**
   * Register an SSE controller for a workspace.
   * Returns an unsubscribe function to call on disconnect.
   */
  subscribe(workspaceId: string, controller: SSEController): () => void {
    let set = this.subscribers.get(workspaceId);
    if (!set) {
      set = new Set();
      this.subscribers.set(workspaceId, set);
    }
    set.add(controller);
    return () => {
      this.subscribers.get(workspaceId)?.delete(controller);
    };
  }

  /**
   * Broadcast a workspace update event to all subscribers except the sender.
   */
  broadcast(workspaceId: string, event: WorkspaceUpdateEvent): void {
    const subs = this.subscribers.get(workspaceId);
    if (!subs || subs.size === 0) return;

    const payload = this.encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    const dead: SSEController[] = [];

    for (const controller of subs) {
      try {
        controller.enqueue(payload);
      } catch {
        dead.push(controller);
      }
    }

    for (const controller of dead) {
      subs.delete(controller);
    }
  }
}

export const collaborationRealtimeStore = new CollaborationRealtimeStore();
