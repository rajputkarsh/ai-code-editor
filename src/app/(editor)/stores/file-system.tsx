'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { FileNode, generateId, INITIAL_FILE_SYSTEM } from '@/lib/file-utils';

interface FileSystemContextType {
    files: Record<string, FileNode>;
    createFile: (parentId: string, name: string, content?: string) => string;
    createFolder: (parentId: string, name: string) => string;
    deleteNode: (id: string) => void;
    renameNode: (id: string, newName: string) => void;
    updateFileContent: (id: string, content: string) => void;
    rootId: string;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
    const [files, setFiles] = useState<Record<string, FileNode>>(() => {
        // Initialize with a root folder and a sample file
        const rootId = 'root';
        const sampleFileId = generateId();

        return {
            [rootId]: {
                id: rootId,
                name: 'Project',
                type: 'folder',
                parentId: null,
                children: [sampleFileId],
                depth: 0,
            },
            [sampleFileId]: {
                id: sampleFileId,
                name: 'hello.js',
                type: 'file',
                parentId: rootId,
                content: "console.log('Hello, World!');",
                depth: 1,
            },
        };
    });

    const rootId = 'root';

    const createFile = useCallback((parentId: string, name: string, content: string = '') => {
        const id = generateId();
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
        return id;
    }, []);

    const createFolder = useCallback((parentId: string, name: string) => {
        const id = generateId();
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
        return id;
    }, []);

    const deleteNode = useCallback((id: string) => {
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
    }, []);

    const renameNode = useCallback((id: string, newName: string) => {
        setFiles((prev) => {
            if (!prev[id]) return prev;
            return {
                ...prev,
                [id]: { ...prev[id], name: newName },
            };
        });
    }, []);

    const updateFileContent = useCallback((id: string, content: string) => {
        setFiles((prev) => ({
            ...prev,
            [id]: { ...prev[id], content },
        }));
    }, []);

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
