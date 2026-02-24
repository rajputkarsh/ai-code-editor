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
  userId: string,
  role: TeamRole
): Promise<boolean> {
  const response = await fetch(`${BASE}/teams/${teamId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
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
