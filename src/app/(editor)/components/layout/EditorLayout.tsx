import { ReactNode } from 'react';

interface EditorLayoutProps {
    sidebar: ReactNode;
    editor: ReactNode;
    aiChat?: ReactNode;
    isSidebarOpen: boolean;
    onSidebarToggle?: () => void;
}

export function EditorLayout({ 
    sidebar, 
    editor, 
    aiChat,
    isSidebarOpen,
    onSidebarToggle
}: EditorLayoutProps) {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-neutral-900 text-white">
            {/* Collapsible Sidebar */}
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

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {editor}
            </main>

            {/* AI Chat Panel */}
            {aiChat}

            {/* Overlay for mobile when sidebar is open */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onSidebarToggle}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}
