export type TeamRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface TeamSummary {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface TeamMemberSummary {
  userId: string;
  role: TeamRole;
  joinedAt: Date;
}

export interface PresenceState {
  userId: string;
  workspaceId: string;
  fileId: string | null;
  cursorLine: number | null;
  cursorColumn: number | null;
  updatedAt: number;
}
