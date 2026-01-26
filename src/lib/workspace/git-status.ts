/**
 * Git-aware Status Tracking
 * 
 * Phase 2: Track file modifications for GitHub-linked workspaces.
 * 
 * Rules:
 * - GitHub repository is source of truth
 * - Local changes tracked separately
 * - No auto-commit or auto-push
 */

export type GitFileStatus = 
    | 'unmodified'   // File matches GitHub version
    | 'modified'     // File has local changes
    | 'added'        // New file (not in GitHub)
    | 'deleted'      // File deleted locally
    | 'untracked';   // File never committed to GitHub

export interface GitStatus {
    fileStatuses: Map<string, GitFileStatus>;
    lastSyncCommit?: string; // SHA of last synced commit
    branch?: string;
}

/**
 * Git status manager for tracking local changes
 */
export class GitStatusManager {
    private fileStatuses: Map<string, GitFileStatus>;
    private originalContents: Map<string, string>; // Original file contents from GitHub
    private lastSyncCommit?: string;
    private branch?: string;
    
    constructor(
        originalContents?: Map<string, string>,
        branch?: string,
        lastSyncCommit?: string
    ) {
        this.fileStatuses = new Map();
        this.originalContents = originalContents || new Map();
        this.branch = branch;
        this.lastSyncCommit = lastSyncCommit;
        
        // Initialize all original files as unmodified
        for (const [path] of this.originalContents) {
            this.fileStatuses.set(path, 'unmodified');
        }
    }
    
    /**
     * Mark file as modified if content changed
     */
    updateFileStatus(path: string, currentContent: string): void {
        const originalContent = this.originalContents.get(path);
        
        if (originalContent === undefined) {
            // New file (not in original repository)
            this.fileStatuses.set(path, 'added');
        } else if (currentContent === originalContent) {
            // Content matches original
            this.fileStatuses.set(path, 'unmodified');
        } else {
            // Content has changed
            this.fileStatuses.set(path, 'modified');
        }
    }
    
    /**
     * Mark file as added (new file)
     */
    addFile(path: string, content: string): void {
        if (!this.originalContents.has(path)) {
            this.fileStatuses.set(path, 'added');
        } else {
            this.updateFileStatus(path, content);
        }
    }
    
    /**
     * Mark file as deleted
     */
    deleteFile(path: string): void {
        if (this.originalContents.has(path)) {
            this.fileStatuses.set(path, 'deleted');
        } else {
            // Was added locally and then deleted
            this.fileStatuses.delete(path);
        }
    }
    
    /**
     * Get status of a specific file
     */
    getFileStatus(path: string): GitFileStatus {
        return this.fileStatuses.get(path) || 'untracked';
    }
    
    /**
     * Get all modified files
     */
    getModifiedFiles(): string[] {
        const modified: string[] = [];
        for (const [path, status] of this.fileStatuses) {
            if (status === 'modified' || status === 'added' || status === 'deleted') {
                modified.push(path);
            }
        }
        return modified;
    }
    
    /**
     * Check if workspace has uncommitted changes
     */
    hasUncommittedChanges(): boolean {
        return this.getModifiedFiles().length > 0;
    }
    
    /**
     * Get diff for a specific file
     */
    getFileDiff(path: string, currentContent: string): {
        originalContent: string;
        currentContent: string;
        status: GitFileStatus;
    } | null {
        const originalContent = this.originalContents.get(path);
        const status = this.getFileStatus(path);
        
        if (status === 'unmodified') {
            return null;
        }
        
        return {
            originalContent: originalContent || '',
            currentContent,
            status,
        };
    }
    
    /**
     * Export status for persistence
     */
    exportStatus(): {
        fileStatuses: [string, GitFileStatus][];
        lastSyncCommit?: string;
        branch?: string;
    } {
        return {
            fileStatuses: Array.from(this.fileStatuses.entries()),
            lastSyncCommit: this.lastSyncCommit,
            branch: this.branch,
        };
    }
    
    /**
     * Import status from persistence
     */
    static importStatus(
        data: {
            fileStatuses: [string, GitFileStatus][];
            lastSyncCommit?: string;
            branch?: string;
        },
        originalContents: Map<string, string>
    ): GitStatusManager {
        const manager = new GitStatusManager(
            originalContents,
            data.branch,
            data.lastSyncCommit
        );
        
        manager.fileStatuses = new Map(data.fileStatuses);
        
        return manager;
    }
}

