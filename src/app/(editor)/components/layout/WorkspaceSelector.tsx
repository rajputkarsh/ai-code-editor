'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Folder, Github } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace-provider';
import { Modal } from '@/components/ui/Modal';

function formatWorkspaceType(type: 'cloud' | 'github') {
  return type === 'github' ? 'GitHub' : 'Cloud';
}

export function WorkspaceSelector() {
  const {
    workspace,
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    createNewWorkspace,
    renameWorkspace,
    deleteWorkspace,
  } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
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

  const handleCreate = () => {
    setWorkspaceName('New Project');
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
              New
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
        title="Create workspace"
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
              onClick={async () => {
                if (!workspaceName.trim()) return;
                await createNewWorkspace(workspaceName.trim());
                setIsCreateOpen(false);
                setIsOpen(false);
              }}
            >
              Create
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
    </div>
  );
}

