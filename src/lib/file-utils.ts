

export type FileType = 'file' | 'folder';

export interface FileNode {
    id: string;
    name: string;
    type: FileType;
    parentId: string | null;
    content?: string;
    children?: string[]; // IDs of children
    depth: number;
}

export const detectLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'py':
            return 'python';
        case 'html':
            return 'html';
        case 'css':
            return 'css';
        case 'json':
            return 'json';
        case 'md':
            return 'markdown';
        default:
            return 'plaintext';
    }
};

export const generateId = (): string => {
    return crypto.randomUUID();
};

export const INITIAL_FILE_SYSTEM: Record<string, FileNode> = {
    root: {
        id: 'root',
        name: 'root',
        type: 'folder',
        parentId: null,
        children: [], // Populated in store
        depth: 0,
    },
};
