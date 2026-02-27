export type TeamRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export interface TeamListItem {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  role: TeamRole;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  createdAt: string;
}

export interface CollaborationNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
}

const BASE = '/api/collaboration';

export async function listTeamsAPI(): Promise<TeamListItem[]> {
  const response = await fetch(`${BASE}/teams`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.teams ?? [];
}

export async function createTeamAPI(name: string): Promise<string | null> {
  const response = await fetch(`${BASE}/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.id ?? null;
}

export async function listTeamMembersAPI(teamId: string): Promise<TeamMember[]> {
  const response = await fetch(`${BASE}/teams/${teamId}/members`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.members ?? [];
}

export async function inviteTeamMemberAPI(
  teamId: string,
  email: string,
  role: TeamRole
): Promise<boolean> {
  const response = await fetch(`${BASE}/teams/${teamId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
  return response.ok;
}

export async function listCollaborationNotificationsAPI(
  options?: { unread?: boolean; limit?: number }
): Promise<CollaborationNotification[]> {
  const unread = options?.unread ? 'true' : 'false';
  const limit = options?.limit ?? 50;
  const response = await fetch(`${BASE}/notifications?unread=${unread}&limit=${limit}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.notifications ?? [];
}

export async function markCollaborationNotificationReadAPI(notificationId: string): Promise<boolean> {
  const response = await fetch(`${BASE}/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
  return response.ok;
}

export async function assignWorkspaceTeamAPI(
  workspaceId: string,
  teamId: string | null
): Promise<boolean> {
  const response = await fetch(`${BASE}/workspaces/${workspaceId}/team`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId }),
  });
  return response.ok;
}
