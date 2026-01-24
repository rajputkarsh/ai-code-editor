'use client';

import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useFileSystem } from '@/app/(editor)/stores/file-system';
import { detectLanguage } from '@/lib/file-utils';

interface CodeEditorProps {
    fileId: string;
}

export const CodeEditor = ({ fileId }: CodeEditorProps) => {
    const { files, updateFileContent } = useFileSystem();
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
