'use client';

import { WorkspaceProvider } from './stores/workspace-provider';
import { FileSystemProvider } from './stores/file-system';
import { EditorStateProvider } from './stores/editor-state';
import { AIChatStateProvider } from './stores/ai-chat-state';
import { SelectionStateProvider } from './stores/selection-state';

export default function EditorRouteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <WorkspaceProvider>
            <FileSystemProvider>
                <EditorStateProvider>
                    <SelectionStateProvider>
                        <AIChatStateProvider>
                            {children}
                        </AIChatStateProvider>
                    </SelectionStateProvider>
                </EditorStateProvider>
            </FileSystemProvider>
        </WorkspaceProvider>
    );
}
