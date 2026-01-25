'use client';

import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useFileSystem } from '@/app/(editor)/stores/file-system';
import { useSelectionState } from '@/app/(editor)/stores/selection-state';
import { detectLanguage } from '@/lib/file-utils';
import type { editor as MonacoEditor } from 'monaco-editor';

interface CodeEditorProps {
    fileId: string;
}

export const CodeEditor = ({ fileId }: CodeEditorProps) => {
    const { files, updateFileContent } = useFileSystem();
    const { setSelection, clearSelection } = useSelectionState();
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const file = files[fileId];

    if (!file) return <div className="p-10 text-neutral-500">File not found</div>;

    const language = detectLanguage(file.name);

    const handleEditorChange = (value: string | undefined) => {
        if (value !== undefined) {
            updateFileContent(fileId, value);
        }
    };

    const handleEditorMount: OnMount = (editor, monaco) => {
        // Configure editor if needed
        monaco.editor.setTheme('vs-dark');
        editorRef.current = editor;

        // Track selection changes
        editor.onDidChangeCursorSelection((e) => {
            const selection = editor.getSelection();
            const model = editor.getModel();

            if (selection && model && !selection.isEmpty()) {
                const selectedText = model.getValueInRange(selection);
                
                if (selectedText.trim().length > 0) {
                    setSelection({
                        fileId,
                        text: selectedText,
                        startLine: selection.startLineNumber,
                        endLine: selection.endLineNumber,
                        startColumn: selection.startColumn,
                        endColumn: selection.endColumn,
                    });
                } else {
                    clearSelection();
                }
            } else {
                clearSelection();
            }
        });
    };

    return (
        <div className="h-full w-full">
            <Editor
                height="100%"
                theme="vs-dark"
                path={file.id} // Essential for model caching & multi-file handling by Monaco
                defaultLanguage={language}
                language={language}
                value={file.content || ''}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    padding: { top: 10 },
                }}
            />
        </div>
    );
};
