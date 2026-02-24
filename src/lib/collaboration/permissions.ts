import type { TeamRole } from './types';

export const ROLE_PRECEDENCE: Record<TeamRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export function hasRoleAtLeast(role: TeamRole, minimumRole: TeamRole): boolean {
  return ROLE_PRECEDENCE[role] >= ROLE_PRECEDENCE[minimumRole];
}

export function canDeleteWorkspace(role: TeamRole): boolean {
  return hasRoleAtLeast(role, 'ADMIN');
}

export function canModifyWorkspace(role: TeamRole): boolean {
  return hasRoleAtLeast(role, 'EDITOR');
}

export function canManageMembers(role: TeamRole): boolean {
  return hasRoleAtLeast(role, 'ADMIN');
}

export function canManageTeamPrompts(role: TeamRole): boolean {
  return hasRoleAtLeast(role, 'EDITOR');
}
