'use client';

import { FileSystemProvider } from './stores/file-system';
import { EditorStateProvider } from './stores/editor-state';

export default function EditorRouteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <FileSystemProvider>
            <EditorStateProvider>
                {children}
            </EditorStateProvider>
        </FileSystemProvider>
    );
}
