'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Folder, Github, Users } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace-provider';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  assignWorkspaceTeamAPI,
  createTeamAPI,
  inviteTeamMemberAPI,
  listTeamMembersAPI,
  listTeamsAPI,
  type TeamListItem,
  type TeamMember,
  type TeamRole,
} from '@/lib/collaboration/api-client';
import type { WorkspaceTemplateType } from '@/lib/workspace/types';

function formatWorkspaceType(type: 'cloud' | 'github') {
  return type === 'github' ? 'GitHub' : 'Cloud';
}

export function WorkspaceSelector() {
  const {
    workspace,
    workspaces,
    activeWorkspaceId,
    refreshWorkspaces,
    switchWorkspace,
    createNewWorkspace,
    renameWorkspace,
    deleteWorkspace,
  } = useWorkspace();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCollaborateOpen, setIsCollaborateOpen] = useState(false);
  const [isCreateProjectLoading, setIsCreateProjectLoading] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [templateType, setTemplateType] = useState<WorkspaceTemplateType>('react-vite');
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamName, setTeamName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('EDITOR');
  const [isCollabLoading, setIsCollabLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleSharedWorkspaceAdded = (event: Event) => {
      const customEvent = event as CustomEvent<{ workspaces?: Array<{ name?: string }> }>;
      const count = customEvent.detail?.workspaces?.length ?? 0;
      if (count <= 0) return;
      if (count === 1) {
        toast.success('A shared workspace is now available');
        return;
      }
      toast.success(`${count} shared workspaces are now available`);
    };

    window.addEventListener('workspace:shared-added', handleSharedWorkspaceAdded);
    return () => {
      window.removeEventListener('workspace:shared-added', handleSharedWorkspaceAdded);
    };
  }, [toast]);

  const handleCreate = () => {
    setWorkspaceName('My React App');
    setTemplateType('react-vite');
    setIsCreateOpen(true);
  };

  const handleRename = () => {
    if (!workspace) return;
    setWorkspaceName(workspace.metadata.name);
    setIsRenameOpen(true);
  };

  const handleDelete = () => {
    if (!workspace) return;
    setIsDeleteOpen(true);
  };

  const loadTeams = async () => {
    const nextTeams = await listTeamsAPI();
    setTeams(nextTeams);
    const preferredTeamId = workspace?.metadata.teamId ?? nextTeams[0]?.id ?? '';
    setSelectedTeamId((prev) => prev || preferredTeamId);
  };

  const loadMembers = async (teamId: string) => {
    if (!teamId) {
      setMembers([]);
      return;
    }
    const nextMembers = await listTeamMembersAPI(teamId);
    setMembers(nextMembers);
  };

  useEffect(() => {
    if (!isCollaborateOpen) return;
    void loadTeams();
  }, [isCollaborateOpen, workspace?.metadata.teamId]);

  useEffect(() => {
    if (!isCollaborateOpen) return;
    void loadMembers(selectedTeamId);
  }, [isCollaborateOpen, selectedTeamId]);

  const activeLabel = workspace?.metadata.name ?? 'Workspace';
  const activeType = workspace?.metadata.type ?? 'cloud';

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2 py-1 rounded-md text-xs text-neutral-200 hover:bg-neutral-800"
        title="Switch workspace"
      >
        <Folder className="w-3 h-3 text-neutral-400" />
        <span className="max-w-[160px] truncate">{activeLabel}</span>
        <span className="text-[10px] text-neutral-500">{formatWorkspaceType(activeType)}</span>
        <ChevronDown className="w-3 h-3 text-neutral-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-7 z-50 w-72 rounded-md border border-neutral-800 bg-neutral-900 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 text-xs text-neutral-400">
            <span>Workspaces</span>
            <button
              onClick={handleCreate}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              New Project
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {workspaces.length === 0 && (
              <div className="px-3 py-3 text-xs text-neutral-500">
                No workspaces yet.
              </div>
            )}
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setIsOpen(false);
                  switchWorkspace(ws.id);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 ${
                  ws.id === activeWorkspaceId ? 'bg-neutral-800 text-white' : 'text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{ws.name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                    {ws.type === 'github' ? <Github className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                    {formatWorkspaceType(ws.type)}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-neutral-500">
                  Last opened: {ws.lastOpenedAt.toLocaleString()}
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-neutral-800 px-3 py-2 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                setIsCollaborateOpen(true);
                setIsOpen(false);
              }}
              className="text-blue-400 hover:text-blue-300"
              disabled={!workspace}
            >
              Collaborate
            </button>
            <button
              onClick={handleRename}
              className="text-neutral-400 hover:text-neutral-200"
              disabled={!workspace}
            >
              Rename
            </button>
            <button
              onClick={handleDelete}
              className="text-red-400 hover:text-red-300"
              disabled={!workspace}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Project"
        footer={
          <>
            <button
              className="px-3 py-1.5 text-xs rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-500"
              disabled={isCreateProjectLoading}
              onClick={async () => {
                if (!workspaceName.trim() || isCreateProjectLoading) return;
                setIsCreateProjectLoading(true);
                try {
                  const result = await createNewWorkspace(workspaceName.trim(), {
                    template: templateType,
                  });
                  if (templateType === 'react-vite') {
                    window.dispatchEvent(
                      new CustomEvent('workspace:template-created', {
                        detail: {
                          workspaceId: result.workspace.metadata.id,
                          projectType: result.workspace.metadata.projectType,
                        },
                      })
                    );
                  }
                  setIsCreateOpen(false);
                  setIsOpen(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to create project');
                } finally {
                  setIsCreateProjectLoading(false);
                }
              }}
            >
              {isCreateProjectLoading ? 'Creating...' : 'Create'}
            </button>
          </>
        }
      >
        <label className="block text-xs text-neutral-400 mb-2">Project name</label>
        <input
          autoFocus
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
        />
        <label className="block text-xs text-neutral-400 mt-4 mb-2">Template</label>
        <select
          value={templateType}
          onChange={(event) => setTemplateType(event.target.value as WorkspaceTemplateType)}
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
        >
          <option value="react-vite">React (Vite)</option>
        </select>
      </Modal>

      <Modal
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        title="Rename workspace"
        footer={
          <>
            <button
              className="px-3 py-1.5 text-xs rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800"
              onClick={() => setIsRenameOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-500"
              onClick={async () => {
                if (!workspace || !workspaceName.trim()) return;
                if (workspaceName.trim() === workspace.metadata.name) {
                  setIsRenameOpen(false);
                  return;
                }
                await renameWorkspace(workspace.metadata.id, workspaceName.trim());
                setIsRenameOpen(false);
                setIsOpen(false);
              }}
            >
              Save
            </button>
          </>
        }
      >
        <label className="block text-xs text-neutral-400 mb-2">Workspace name</label>
        <input
          autoFocus
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
        />
      </Modal>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete workspace"
        footer={
          <>
            <button
              className="px-3 py-1.5 text-xs rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-500"
              onClick={async () => {
                if (!workspace) return;
                await deleteWorkspace(workspace.metadata.id);
                setIsDeleteOpen(false);
                setIsOpen(false);
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-300">
          Delete workspace <span className="text-white">{workspace?.metadata.name}</span>? This cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={isCollaborateOpen}
        onClose={() => setIsCollaborateOpen(false)}
        title="Collaboration"
        footer={
          <button
            className="px-3 py-1.5 text-xs rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800"
            onClick={() => setIsCollaborateOpen(false)}
          >
            Close
          </button>
        }
      >
        <div className="space-y-4 text-sm text-neutral-300">
          <div className="rounded-md border border-neutral-800 p-3 bg-neutral-900/60">
            <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
              <Users className="w-3 h-3" />
              Team
            </div>
            <div className="flex gap-2">
              <select
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
                className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">Personal workspace (no team)</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.role})
                  </option>
                ))}
              </select>
              <button
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                disabled={!workspace || isCollabLoading}
                onClick={async () => {
                  if (!workspace) return;
                  setIsCollabLoading(true);
                  const ok = await assignWorkspaceTeamAPI(
                    workspace.metadata.id,
                    selectedTeamId || null
                  );
                  await refreshWorkspaces();
                  setIsCollabLoading(false);
                  if (ok) {
                    toast.success('Workspace collaboration scope updated');
                  } else {
                    toast.error('Failed to update workspace team');
                  }
                }}
              >
                Apply
              </button>
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">
              Invite members after assigning a team using their account email.
            </p>
          </div>

          <div className="rounded-md border border-neutral-800 p-3 bg-neutral-900/60">
            <div className="text-xs text-neutral-400 mb-2">Create team</div>
            <div className="flex gap-2">
              <input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Team name"
                className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
              />
              <button
                className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                disabled={!teamName.trim() || isCollabLoading}
                onClick={async () => {
                  setIsCollabLoading(true);
                  const teamId = await createTeamAPI(teamName.trim());
                  if (teamId) {
                    setTeamName('');
                    await loadTeams();
                    setSelectedTeamId(teamId);
                    toast.success('Team created');
                  } else {
                    toast.error('Failed to create team');
                  }
                  setIsCollabLoading(false);
                }}
              >
                Create
              </button>
            </div>
          </div>

          <div className="rounded-md border border-neutral-800 p-3 bg-neutral-900/60">
            <div className="text-xs text-neutral-400 mb-2">Invite member</div>
            <div className="flex gap-2">
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Email address"
                className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as TeamRole)}
                className="rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="VIEWER">VIEWER</option>
                <option value="EDITOR">EDITOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button
                className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                disabled={!selectedTeamId || !inviteEmail.trim() || isCollabLoading}
                onClick={async () => {
                  if (!selectedTeamId) return;
                  setIsCollabLoading(true);
                  const ok = await inviteTeamMemberAPI(
                    selectedTeamId,
                    inviteEmail.trim(),
                    inviteRole
                  );
                  if (ok) {
                    setInviteEmail('');
                    await loadMembers(selectedTeamId);
                    toast.success('Member invited');
                  } else {
                    toast.error('Failed to invite member');
                  }
                  setIsCollabLoading(false);
                }}
              >
                Invite
              </button>
            </div>
            <div className="mt-3 max-h-36 overflow-y-auto rounded border border-neutral-800">
              {members.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-neutral-500">No members found for selected team.</div>
              ) : (
                members.map((member) => (
                  <div key={member.userId} className="px-2 py-1.5 text-xs border-b last:border-b-0 border-neutral-800 flex items-center justify-between">
                    <span className="truncate">{member.userId}</span>
                    <span className="text-neutral-400">{member.role}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
