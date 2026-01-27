'use client';

/**
 * EditorBottomBar Component
 * VS Code-style bottom bar positioned at the bottom of the screen
 * 
 * Features:
 * - User authentication menu (sign out) in bottom right
 * - Clean, minimal design matching editor theme
 * - Similar styling to EditorToolbar but positioned at bottom
 */

import React from 'react';
import { UserButton } from '@/components/auth/UserButton';

export function EditorBottomBar() {
    return (
        <div className="flex items-center justify-between h-8 px-4 bg-[#1e1e1e] border-t border-neutral-800 text-neutral-300">
            {/* Left section - could be used for status info, language mode, etc. */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">
                    {/* Reserved for status info */}
                </span>
            </div>

            {/* Right section - User menu */}
            <div className="flex items-center gap-2">
                <div className="border-l border-neutral-700 pl-2">
                    <UserButton />
                </div>
            </div>
        </div>
    );
}




