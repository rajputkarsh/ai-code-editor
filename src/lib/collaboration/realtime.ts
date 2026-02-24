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

/**
 * In-memory collaboration coordinator.
 * Conflict strategy: last-write-wins by monotonically increasing version.
 */
class CollaborationRealtimeStore {
  private presence = new Map<string, PresenceState>();
  private files = new Map<string, FileState>();

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
}

export const collaborationRealtimeStore = new CollaborationRealtimeStore();
