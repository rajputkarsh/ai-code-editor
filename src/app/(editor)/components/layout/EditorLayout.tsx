import { ReactNode, useEffect, useRef } from 'react';

interface EditorLayoutProps {
    sidebar: ReactNode;
    editor: ReactNode;
    aiChat?: ReactNode;
    preview?: ReactNode;
    isPreviewOpen?: boolean;
    previewWidth?: number;
    onPreviewWidthChange?: (width: number) => void;
    isSidebarOpen: boolean;
    onSidebarToggle?: () => void;
}

export function EditorLayout({ 
    sidebar, 
    editor, 
    aiChat,
    preview,
    isPreviewOpen = false,
    previewWidth = 384,
    onPreviewWidthChange,
    isSidebarOpen,
    onSidebarToggle
}: EditorLayoutProps) {
    const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            if (!resizeStateRef.current || !onPreviewWidthChange) return;
            const delta = resizeStateRef.current.startX - event.clientX;
            const proposed = resizeStateRef.current.startWidth + delta;
            const minWidth = 300;
            const maxWidth = Math.floor(window.innerWidth * 0.8);
            const nextWidth = Math.max(minWidth, Math.min(maxWidth, proposed));
            onPreviewWidthChange(nextWidth);
        };

        const handleMouseUp = () => {
            if (!resizeStateRef.current) return;
            resizeStateRef.current = null;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [onPreviewWidthChange]);

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

            {/* Preview Panel */}
            {isPreviewOpen && preview && (
                <>
                    <div
                        className="hidden md:block w-1 cursor-col-resize bg-neutral-800 hover:bg-neutral-700"
                        onMouseDown={(event) => {
                            resizeStateRef.current = {
                                startX: event.clientX,
                                startWidth: previewWidth,
                            };
                            document.body.style.userSelect = 'none';
                            document.body.style.cursor = 'col-resize';
                        }}
                        title="Drag to resize preview"
                    />
                    <div
                        className="hidden md:block shrink-0 min-w-0"
                        style={{ width: `${previewWidth}px` }}
                    >
                        {preview}
                    </div>
                    <div className="md:hidden">{preview}</div>
                </>
            )}

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
