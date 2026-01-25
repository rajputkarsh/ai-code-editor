import { ReactNode } from 'react';

interface EditorLayoutProps {
    sidebar: ReactNode;
    editor: ReactNode;
    aiChat?: ReactNode;
}

export function EditorLayout({ sidebar, editor, aiChat }: EditorLayoutProps) {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-neutral-900 text-white">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-neutral-800 bg-neutral-900">
                {sidebar}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0">
                {editor}
            </main>

            {/* AI Chat Panel */}
            {aiChat}
        </div>
    );
}
