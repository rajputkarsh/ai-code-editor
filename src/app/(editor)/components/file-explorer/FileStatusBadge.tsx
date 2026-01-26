'use client';

/**
 * File Status Badge Component
 * 
 * Phase 2: Shows Git-aware file status indicators
 * - M: Modified
 * - A: Added
 * - D: Deleted
 * - U: Untracked
 */

import React from 'react';
import type { GitFileStatus } from '@/lib/workspace/git-status';

interface FileStatusBadgeProps {
    status: GitFileStatus;
}

export const FileStatusBadge: React.FC<FileStatusBadgeProps> = ({ status }) => {
    if (status === 'unmodified') {
        return null; // Don't show badge for unmodified files
    }
    
    const badgeConfig = {
        modified: {
            label: 'M',
            className: 'bg-yellow-600 text-white',
            title: 'Modified',
        },
        added: {
            label: 'A',
            className: 'bg-green-600 text-white',
            title: 'Added',
        },
        deleted: {
            label: 'D',
            className: 'bg-red-600 text-white',
            title: 'Deleted',
        },
        untracked: {
            label: 'U',
            className: 'bg-blue-600 text-white',
            title: 'Untracked',
        },
    };
    
    const config = badgeConfig[status];
    
    return (
        <span
            className={`px-1 py-0.5 text-[10px] font-bold rounded ${config.className}`}
            title={config.title}
        >
            {config.label}
        </span>
    );
};

