'use client';

import React, { useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useFileSystem } from '@/app/(editor)/stores/file-system';
import { useSelectionState } from '@/app/(editor)/stores/selection-state';
import { useWorkspace } from '@/app/(editor)/stores/workspace-provider';
import { useInlineAI } from '@/app/(editor)/stores/inline-ai-state';
import { detectLanguage } from '@/lib/file-utils';
import type { editor as MonacoEditor, languages } from 'monaco-editor';

interface CodeEditorProps {
    fileId: string;
}

export const CodeEditor = ({ fileId }: CodeEditorProps) => {
    const { files, updateFileContent } = useFileSystem();
    const { setSelection, clearSelection } = useSelectionState();
    const { markDirty } = useWorkspace();
    const { isLoadingCompletion, setLoadingCompletion, setCurrentCompletion, addPromptToHistory } = useInlineAI();
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const [inlineCompletionText, setInlineCompletionText] = useState<string | null>(null);
    const [completionPosition, setCompletionPosition] = useState<{ lineNumber: number; column: number } | null>(null);
    const file = files[fileId];

    if (!file) return <div className="p-10 text-neutral-500">File not found</div>;

    const language = detectLanguage(file.name);

    const handleEditorChange = (value: string | undefined) => {
        if (value !== undefined) {
            updateFileContent(fileId, value);
            // Trigger autosave when file content changes (pass fileId to track dirty state)
            markDirty('FILE_CONTENT_CHANGED', fileId);
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
            
            // Clear inline completion when cursor moves
            if (inlineCompletionText) {
                setInlineCompletionText(null);
                setCompletionPosition(null);
            }
        });

        // Register keyboard shortcut for inline AI completion (Cmd/Ctrl + Enter)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, async () => {
            await requestInlineCompletion(editor, monaco);
        });
        
        // Register keyboard shortcut to accept inline completion (Tab)
        editor.addCommand(monaco.KeyCode.Tab, () => {
            if (inlineCompletionText && completionPosition) {
                acceptInlineCompletion(editor);
                return true; // Prevent default tab behavior
            }
            // If no completion, allow default tab behavior
            return false;
        });
        
        // Register keyboard shortcut to reject inline completion (Escape)
        editor.addCommand(monaco.KeyCode.Escape, () => {
            if (inlineCompletionText) {
                rejectInlineCompletion();
                return true;
            }
            return false;
        });
    };
    
    /**
     * Request inline AI completion at cursor position
     */
    const requestInlineCompletion = async (
        editor: MonacoEditor.IStandaloneCodeEditor,
        monaco: typeof import('monaco-editor')
    ) => {
        const model = editor.getModel();
        const position = editor.getPosition();
        
        if (!model || !position) return;
        
        setLoadingCompletion(true);
        
        try {
            const language = detectLanguage(file.name);
            const lineNumber = position.lineNumber;
            const column = position.column;
            
            // Get code before and after cursor
            const codeBeforeCursor = model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: lineNumber,
                endColumn: column,
            });
            
            const totalLines = model.getLineCount();
            const codeAfterCursor = model.getValueInRange({
                startLineNumber: lineNumber,
                startColumn: column,
                endLineNumber: totalLines,
                endColumn: model.getLineMaxColumn(totalLines),
            });
            
            // Request completion from API
            const response = await fetch('/api/inline-ai/inline-completion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    language,
                    codeBeforeCursor,
                    codeAfterCursor,
                    lineNumber,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to get inline completion');
            }
            
            const data = await response.json();
            
            if (data.completion && data.completion.trim()) {
                setInlineCompletionText(data.completion);
                setCompletionPosition({ lineNumber, column });
                
                // Add to prompt history
                addPromptToHistory({
                    type: 'inline-completion',
                    prompt: `Inline completion at line ${lineNumber}`,
                    response: data.completion,
                    metadata: { fileName: file.name, lineNumber },
                });
            }
            
        } catch (error) {
            console.error('Inline completion error:', error);
        } finally {
            setLoadingCompletion(false);
        }
    };
    
    /**
     * Accept inline completion (insert into editor)
     */
    const acceptInlineCompletion = (editor: MonacoEditor.IStandaloneCodeEditor) => {
        if (!inlineCompletionText || !completionPosition) return;
        
        const model = editor.getModel();
        if (!model) return;
        
        // Insert completion at cursor position
        editor.executeEdits('inline-ai', [{
            range: {
                startLineNumber: completionPosition.lineNumber,
                startColumn: completionPosition.column,
                endLineNumber: completionPosition.lineNumber,
                endColumn: completionPosition.column,
            },
            text: inlineCompletionText,
        }]);
        
        // Clear completion state
        setInlineCompletionText(null);
        setCompletionPosition(null);
    };
    
    /**
     * Reject inline completion (dismiss)
     */
    const rejectInlineCompletion = () => {
        setInlineCompletionText(null);
        setCompletionPosition(null);
    };

    return (
        <div className="h-full w-full relative">
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
                    suggest: {
                        preview: true,
                        showInlineDetails: true,
                    },
                }}
            />
            
            {/* Inline completion hint */}
            {inlineCompletionText && (
                <div className="absolute bottom-4 right-4 bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-xs text-neutral-300 shadow-lg max-w-md">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-400 font-medium">AI Suggestion</span>
                    </div>
                    <div className="mb-2 font-mono text-neutral-400 max-h-20 overflow-auto">
                        {inlineCompletionText.split('\n')[0]}
                        {inlineCompletionText.split('\n').length > 1 && '...'}
                    </div>
                    <div className="flex gap-2 text-[10px]">
                        <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded">Tab</kbd>
                        <span>to accept</span>
                        <kbd className="px-1.5 py-0.5 bg-neutral-700 rounded">Esc</kbd>
                        <span>to reject</span>
                    </div>
                </div>
            )}
            
            {/* Loading indicator for inline completion */}
            {isLoadingCompletion && (
                <div className="absolute bottom-4 right-4 bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-xs text-neutral-400">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Generating suggestion...</span>
                    </div>
                </div>
            )}
        </div>
    );
};
