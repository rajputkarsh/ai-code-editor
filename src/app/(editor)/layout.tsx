'use client';

import { WorkspaceProvider } from './stores/workspace-provider';
import { FileSystemProvider } from './stores/file-system';
import { EditorStateProvider } from './stores/editor-state';

export default function EditorRouteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <WorkspaceProvider>
            <FileSystemProvider>
                <EditorStateProvider>
                    {children}
                </EditorStateProvider>
            </FileSystemProvider>
        </WorkspaceProvider>
    );
}
