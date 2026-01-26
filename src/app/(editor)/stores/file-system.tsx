'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FileNode, generateId, INITIAL_FILE_SYSTEM } from '@/lib/file-utils';
import { useWorkspace } from './workspace-provider';
import { VFSNode } from '@/lib/workspace';

interface FileSystemContextType {
    files: Record<string, FileNode>;
    createFile: (parentId: string, name: string, content?: string, options?: { skipAutosave?: boolean }) => string;
    createFolder: (parentId: string, name: string, options?: { skipAutosave?: boolean }) => string;
    deleteNode: (id: string) => void;
    renameNode: (id: string, newName: string) => void;
    updateFileContent: (id: string, content: string) => void;
    rootId: string;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

/**
 * Convert VFSNode to FileNode
 */
function vfsNodeToFileNode(node: VFSNode): FileNode {
    return {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId: node.parentId,
        children: node.children,
        content: node.content,
        depth: node.depth,
    };
}

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
    const { vfs, markDirty } = useWorkspace();
    const vfsRef = useRef(vfs);
    
    const [files, setFiles] = useState<Record<string, FileNode>>(() => {
        // Initialize with a root folder and a sample file
        const rootId = 'root';

        return {
            [rootId]: {
                id: rootId,
                name: 'Project',
                type: 'folder',
                parentId: null,
                children: [],
                depth: 0,
            },
        };
    });

    // Get rootId from VFS if available, otherwise default to 'root'
    const rootId = vfs ? vfs.getRootId() : 'root';
    
    const syncFromVfs = useCallback((vfsInstance: typeof vfs | null) => {
        if (!vfsInstance) return;
        const structure = vfsInstance.getStructure();
        const fileNodes: Record<string, FileNode> = {};

        Object.entries(structure.nodes).forEach(([id, node]) => {
            fileNodes[id] = vfsNodeToFileNode(node);
        });

        setFiles(fileNodes);
    }, []);

    // Sync files from workspace VFS when available
    useEffect(() => {
        vfsRef.current = vfs;
        syncFromVfs(vfs);
    }, [vfs, syncFromVfs]);

    const createFile = useCallback((parentId: string, name: string, content: string = '', options?: { skipAutosave?: boolean }) => {
        let newId = '';
        
        // Update VFS if available
        const vfsInstance = vfsRef.current;
        if (vfsInstance) {
            newId = vfsInstance.createFile(parentId, name, content);
            syncFromVfs(vfsInstance);
            
            // Trigger autosave after creating file
            if (!options?.skipAutosave) {
                markDirty('FILE_CREATED', newId);
            }
        } else {
            // Fallback to old behavior
            const id = generateId();
            newId = id;
            setFiles((prev) => {
                const parent = prev[parentId];
                if (!parent || parent.type !== 'folder') return prev;

                return {
                    ...prev,
                    [parentId]: {
                        ...parent,
                        children: [...(parent.children || []), id],
                    },
                    [id]: {
                        id,
                        name,
                        type: 'file',
                        parentId,
                        content,
                        depth: parent.depth + 1,
                    },
                };
            });
        }
        
        return newId;
    }, [markDirty, syncFromVfs]);

    const createFolder = useCallback((parentId: string, name: string, options?: { skipAutosave?: boolean }) => {
        let newId = '';
        
        // Update VFS if available
        const vfsInstance = vfsRef.current;
        if (vfsInstance) {
            newId = vfsInstance.createFolder(parentId, name);
            syncFromVfs(vfsInstance);
            
            // Trigger autosave after creating folder (folders don't need dirty tracking)
            if (!options?.skipAutosave) {
                markDirty('FILE_CREATED');
            }
        } else {
            // Fallback to old behavior
            const id = generateId();
            newId = id;
            setFiles((prev) => {
                const parent = prev[parentId];
                if (!parent || parent.type !== 'folder') return prev;

                return {
                    ...prev,
                    [parentId]: {
                        ...parent,
                        children: [...(parent.children || []), id],
                    },
                    [id]: {
                        id,
                        name,
                        type: 'folder',
                        parentId,
                        children: [],
                        depth: parent.depth + 1,
                    },
                };
            });
        }
        
        return newId;
    }, [markDirty, syncFromVfs]);

    const deleteNode = useCallback((id: string) => {
        // Update VFS if available
        const vfsInstance = vfsRef.current;
        if (vfsInstance) {
            vfsInstance.deleteNode(id);
            syncFromVfs(vfsInstance);
            
            // Trigger autosave after deleting node
            markDirty('FILE_DELETED');
        } else {
            // Fallback to old behavior
            setFiles((prev) => {
                const node = prev[id];
                if (!node || node.id === 'root') return prev; // Cannot delete root

                const parentId = node.parentId;
                if (!parentId) return prev;

                const next = { ...prev };

                // Remove from parent's children
                if (next[parentId]) {
                    next[parentId] = {
                        ...next[parentId],
                        children: (next[parentId].children || []).filter((childId: string) => childId !== id),
                    };
                }

                // Helper to recursively delete children
                const deleteRecursive = (nodeId: string) => {
                    const n = next[nodeId];
                    if (n && n.children) {
                        n.children.forEach(deleteRecursive);
                    }
                    delete next[nodeId];
                };

                deleteRecursive(id);
                return next;
            });
        }
    }, [markDirty, syncFromVfs]);

    const renameNode = useCallback((id: string, newName: string) => {
        // Update VFS if available
        const vfsInstance = vfsRef.current;
        if (vfsInstance) {
            vfsInstance.renameNode(id, newName);
            syncFromVfs(vfsInstance);
            
            // Trigger autosave after renaming node
            markDirty('FILE_RENAMED', id);
        } else {
            // Fallback to old behavior
            setFiles((prev) => {
                if (!prev[id]) return prev;
                return {
                    ...prev,
                    [id]: { ...prev[id], name: newName },
                };
            });
        }
    }, [markDirty, syncFromVfs]);

    const updateFileContent = useCallback((id: string, content: string) => {
        // Update VFS if available
        const vfsInstance = vfsRef.current;
        if (vfsInstance) {
            vfsInstance.writeFile(id, content);
            syncFromVfs(vfsInstance);
            
            // Note: markDirty() is also called in CodeEditor, but we call it here
            // to ensure all file content updates trigger autosave
            markDirty('FILE_CONTENT_CHANGED', id);
        } else {
            // Fallback to old behavior
            setFiles((prev) => ({
                ...prev,
                [id]: { ...prev[id], content },
            }));
        }
    }, [markDirty, syncFromVfs]);

    const value = useMemo(
        () => ({
            files,
            createFile,
            createFolder,
            deleteNode,
            renameNode,
            updateFileContent,
            rootId,
        }),
        [files, createFile, createFolder, deleteNode, renameNode, updateFileContent]
    );

    return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>;
}

export function useFileSystem() {
    const context = useContext(FileSystemContext);
    if (!context) {
        throw new Error('useFileSystem must be used within a FileSystemProvider');
    }
    return context;
}
