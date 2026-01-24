'use client';

import React, { useState } from 'react';
import { useFileSystem } from '@/app/(editor)/stores/file-system';
import { useEditorState } from '@/app/(editor)/stores/editor-state';
import { ChevronRight, ChevronDown, File, Folder, Trash2, Edit2, FilePlus, FolderPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface FileTreeNodeProps {
    nodeId: string;
    onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
}

const FileTreeNode = ({ nodeId, onContextMenu }: FileTreeNodeProps) => {
    const { files } = useFileSystem();
    const { openFile, activeTabId } = useEditorState();
    const node = files[nodeId];
    const [isOpen, setIsOpen] = useState(false);

    if (!node) return null;

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.type === 'folder') {
            setIsOpen(!isOpen);
        } else {
            openFile(node.id);
        }
    };

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-neutral-800 text-sm`}
                style={{ paddingLeft: `${node.depth * 12 + 8}px` }}
                onClick={handleToggle}
                onContextMenu={(e) => onContextMenu(e, node.id)}
            >
                <span className="text-neutral-500">
                    {node.type === 'folder' ? (
                        isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    ) : <span className="w-[14px]" />}
                </span>

                {node.type === 'folder' ? (
                    <Folder size={14} className="text-blue-400" />
                ) : (
                    <File size={14} className="text-neutral-400" />
                )}

                <span className="truncate text-neutral-300">{node.name}</span>
            </div>

            {node.type === 'folder' && isOpen && node.children && (
                <div>
                    {node.children.map((childId) => (
                        <FileTreeNode key={childId} nodeId={childId} onContextMenu={onContextMenu} />
                    ))}
                </div>
            )}
        </div>
    );
};

export const FileExplorer = () => {
    const { rootId, createFile, createFolder, deleteNode, renameNode, files } = useFileSystem();

    // Modal State
    const [modalType, setModalType] = useState<'create_file' | 'create_folder' | 'rename' | 'delete' | null>(null);
    const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
    const [inputVal, setInputVal] = useState('');

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleAction = (action: 'new_file' | 'new_folder' | 'rename' | 'delete') => {
        if (!contextMenu) return;
        const nodeId = contextMenu.nodeId;
        closeContextMenu();

        setTargetNodeId(nodeId);

        if (action === 'delete') {
            setModalType('delete');
        } else if (action === 'rename') {
            setModalType('rename');
            setInputVal(files[nodeId]?.name || '');
        } else if (action === 'new_file') {
            setModalType('create_file');
            setInputVal('');
        } else if (action === 'new_folder') {
            setModalType('create_folder');
            setInputVal('');
        }
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!targetNodeId) return;

        if (modalType === 'create_file' && inputVal.trim()) {
            createFile(targetNodeId, inputVal);
        } else if (modalType === 'create_folder' && inputVal.trim()) {
            createFolder(targetNodeId, inputVal);
        } else if (modalType === 'rename' && inputVal.trim()) {
            renameNode(targetNodeId, inputVal);
        } else if (modalType === 'delete') {
            deleteNode(targetNodeId);
        }

        setModalType(null);
        setInputVal('');
        setTargetNodeId(null);
    };

    // Global Create Buttons handlers (root)
    const handleRootAction = (type: 'file' | 'folder') => {
        setTargetNodeId(rootId);
        setModalType(type === 'file' ? 'create_file' : 'create_folder');
        setInputVal('');
    };

    return (
        <div className="flex flex-col h-full bg-neutral-900 text-sm relative" onClick={closeContextMenu}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                <span>Files</span>
                <div className="flex gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRootAction('file'); }}
                        className="hover:text-white p-1"
                        title="New File"
                    >
                        <FilePlus size={14} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleRootAction('folder'); }}
                        className="hover:text-white p-1"
                        title="New Folder"
                    >
                        <FolderPlus size={14} />
                    </button>
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-2">
                <FileTreeNode nodeId={rootId} onContextMenu={handleContextMenu} />
            </div>

            {/* Context Menu Overlay (Backdrop + Menu) */}
            {contextMenu && (
                <div className="fixed inset-0 z-50">
                    {/* Invisible backdrop to close on click outside */}
                    <div className="absolute inset-0" onClick={closeContextMenu} />

                    {/* Menu */}
                    <div
                        className="absolute bg-[#1e1e1e] border border-neutral-700 shadow-xl rounded-md py-1 min-w-[140px]"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => handleAction('rename')}
                            className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 flex items-center gap-2"
                        >
                            <Edit2 size={14} /> Rename
                        </button>
                        <button
                            onClick={() => handleAction('delete')}
                            className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-neutral-800 flex items-center gap-2"
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                        <div className="h-px bg-neutral-700 my-1" />
                        <button
                            onClick={() => handleAction('new_file')}
                            className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 flex items-center gap-2"
                        >
                            <FilePlus size={14} /> New File
                        </button>
                        <button
                            onClick={() => handleAction('new_folder')}
                            className="w-full text-left px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 flex items-center gap-2"
                        >
                            <FolderPlus size={14} /> New Folder
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <Modal
                isOpen={modalType === 'delete'}
                onClose={() => setModalType(null)}
                title="Delete Item"
                footer={(
                    <>
                        <button onClick={() => setModalType(null)} className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white">Cancel</button>
                        <button onClick={handleSubmit} className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded">Delete</button>
                    </>
                )}
            >
                <p className="text-neutral-300 mb-4">Are you sure you want to delete this item? This action cannot be undone.</p>
            </Modal>

            <Modal
                isOpen={['create_file', 'create_folder', 'rename'].includes(modalType || '')}
                onClose={() => setModalType(null)}
                title={
                    modalType === 'create_file' ? 'New File' :
                        modalType === 'create_folder' ? 'New Folder' :
                            'Rename'
                }
                footer={(
                    <>
                        <button onClick={() => setModalType(null)} className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white">Cancel</button>
                        <button onClick={handleSubmit} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">
                            {modalType === 'rename' ? 'Rename' : 'Create'}
                        </button>
                    </>
                )}
            >
                <form onSubmit={handleSubmit}>
                    <input
                        autoFocus
                        className="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                        placeholder="Enter name..."
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                    />
                </form>
            </Modal>

        </div>
    );
};
