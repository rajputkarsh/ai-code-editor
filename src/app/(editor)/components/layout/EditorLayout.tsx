'use client';

import { ReactNode, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface EditorLayoutProps {
    sidebar: ReactNode;
    editor: ReactNode;
    aiChat?: ReactNode;
}

export function EditorLayout({ sidebar, editor, aiChat }: EditorLayoutProps) {
    // State for collapsible sidebar
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="flex h-screen w-full overflow-hidden bg-neutral-900 text-white">
            {/* Collapsible Sidebar - Hidden on mobile by default */}
            <aside
                className={`
                    ${isSidebarOpen ? 'w-64' : 'w-0'}
                    transition-all duration-300 ease-in-out
                    flex-shrink-0 border-r border-neutral-800 bg-neutral-900
                    overflow-hidden
                    md:relative absolute md:z-0 z-50
                    h-full
                `}
            >
                {sidebar}
            </aside>

            {/* Sidebar Toggle Button */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="
                    fixed top-4 left-4 z-50
                    p-2 rounded-md
                    bg-neutral-800 hover:bg-neutral-700
                    text-neutral-300 hover:text-white
                    transition-colors
                    shadow-lg
                "
                title={isSidebarOpen ? 'Hide file explorer' : 'Show file explorer'}
                aria-label={isSidebarOpen ? 'Hide file explorer' : 'Show file explorer'}
            >
                {isSidebarOpen ? (
                    <PanelLeftClose className="w-5 h-5" />
                ) : (
                    <PanelLeftOpen className="w-5 h-5" />
                )}
            </button>

            {/* Main Content - Always maintains minimum usable width */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {editor}
            </main>

            {/* AI Chat Panel - Responsive behavior handled in AIChatPanel component */}
            {aiChat}

            {/* Overlay for mobile when sidebar is open */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}
