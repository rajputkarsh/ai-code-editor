import { VirtualFileSystem } from '@/lib/workspace';

export interface WorkspaceFileEntry {
    id: string;
    path: string;
    name: string;
    type: 'file' | 'folder';
}

export interface WorkspaceSnapshot {
    files: Array<{
        path: string;
        type: 'file' | 'folder';
    }>;
}

export interface WorkspaceIndex {
    entries: WorkspaceFileEntry[];
    pathToId: Map<string, string>;
    idToPath: Map<string, string>;
}

export function buildWorkspaceIndex(vfs: VirtualFileSystem): WorkspaceIndex {
    const structure = vfs.getStructure();
    const entries: WorkspaceFileEntry[] = [];
    const pathToId = new Map<string, string>();
    const idToPath = new Map<string, string>();

    Object.values(structure.nodes).forEach((node) => {
        if (node.id === structure.rootId) {
            return;
        }
        const path = vfs.getNodePath(node.id);
        const entry: WorkspaceFileEntry = {
            id: node.id,
            path,
            name: node.name,
            type: node.type,
        };
        entries.push(entry);
        pathToId.set(path, node.id);
        idToPath.set(node.id, path);
    });

    return { entries, pathToId, idToPath };
}

export function buildWorkspaceSnapshot(vfs: VirtualFileSystem): WorkspaceSnapshot {
    const { entries } = buildWorkspaceIndex(vfs);
    return {
        files: entries.map((entry) => ({
            path: entry.path,
            type: entry.type,
        })),
    };
}

export function getFileContentsByPath(
    vfs: VirtualFileSystem,
    filePaths: string[]
): Record<string, string> {
    const { pathToId } = buildWorkspaceIndex(vfs);
    const contents: Record<string, string> = {};

    filePaths.forEach((path) => {
        const id = pathToId.get(path);
        if (!id) return;
        const content = vfs.readFile(id);
        if (content !== undefined) {
            contents[path] = content;
        }
    });

    return contents;
}

