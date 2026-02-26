'use client';

import { WorkspaceProvider } from './stores/workspace-provider';
import { FileSystemProvider } from './stores/file-system';
import { EditorStateProvider } from './stores/editor-state';
import { AIChatStateProvider } from './stores/ai-chat-state';
import { SelectionStateProvider } from './stores/selection-state';
import { InlineAIStateProvider } from './stores/inline-ai-state';

export default function EditorRouteLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Editor remains auth-agnostic by design: route/middleware decides who can
    // enter this tree. If this layout renders, identity has already been validated.
    return (
        <WorkspaceProvider>
            <FileSystemProvider>
                <EditorStateProvider>
                    <SelectionStateProvider>
                        <InlineAIStateProvider>
                            <AIChatStateProvider>
                                {children}
                            </AIChatStateProvider>
                        </InlineAIStateProvider>
                    </SelectionStateProvider>
                </EditorStateProvider>
            </FileSystemProvider>
        </WorkspaceProvider>
    );
}
