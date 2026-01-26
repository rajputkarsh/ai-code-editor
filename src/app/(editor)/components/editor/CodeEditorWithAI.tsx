'use client';

/**
 * Code Editor with AI Integration
 * 
 * Wraps CodeEditor with AI capabilities:
 * - Code action context menu
 * - Diff preview modal
 * - Code explanation panel
 */

import React, { useState, useCallback } from 'react';
import { CodeEditor } from './CodeEditor';
import { CodeActionMenu } from './CodeActionMenu';
import { DiffPreviewModal } from './DiffPreviewModal';
import { useFileSystem } from '@/app/(editor)/stores/file-system';
import { useInlineAI } from '@/app/(editor)/stores/inline-ai-state';
import { useSelectionState } from '@/app/(editor)/stores/selection-state';
import { detectLanguage } from '@/lib/file-utils';
import { useToast } from '@/components/ui/Toast';

interface CodeEditorWithAIProps {
    fileId: string;
}

export const CodeEditorWithAI: React.FC<CodeEditorWithAIProps> = ({ fileId }) => {
    const toast = useToast();
    const { files, updateFileContent } = useFileSystem();
    const { selection } = useSelectionState();
    const { setLoadingAction, addPromptToHistory } = useInlineAI();
    
    // Code action menu state
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [actionMenuPosition, setActionMenuPosition] = useState({ x: 0, y: 0 });
    
    // Diff preview state
    const [diffPreview, setDiffPreview] = useState<{
        action: string;
        originalCode: string;
        modifiedCode: string;
        isSelection: boolean;
    } | null>(null);
    
    const file = files[fileId];
    const language = file ? detectLanguage(file.name) : 'plaintext';
    
    /**
     * Handle code action selection from menu
     */
    const handleCodeAction = useCallback(async (actionId: string) => {
        if (!file) return;
        
        setLoadingAction(true);
        
        try {
            const targetCode = selection?.text || file.content || '';
            const isSelection = !!selection?.text;
            
            const response = await fetch('/api/inline-ai/code-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: actionId,
                    fileName: file.name,
                    language,
                    code: file.content || '',
                    selectedCode: selection?.text,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to perform code action');
            }
            
            const data = await response.json();
            
            // Show diff preview
            setDiffPreview({
                action: actionId,
                originalCode: data.originalCode,
                modifiedCode: data.modifiedCode,
                isSelection,
            });
            
            // Add to history
            addPromptToHistory({
                type: 'code-action',
                prompt: `Code action: ${actionId}`,
                response: data.modifiedCode,
                metadata: { fileName: file.name, action: actionId },
            });
            
        } catch (error) {
            console.error('Code action error:', error);
            toast.error('Failed to perform code action. Please try again.');
        } finally {
            setLoadingAction(false);
        }
    }, [file, selection, language, setLoadingAction, addPromptToHistory, toast]);
    
    /**
     * Apply diff (replace code in editor)
     */
    const handleApplyDiff = useCallback(() => {
        if (!diffPreview || !file) return;
        
        if (diffPreview.isSelection && selection) {
            // Replace selected text with modified code
            const content = file.content || '';
            const lines = content.split('\n');
            
            // Replace the selected lines
            const before = lines.slice(0, selection.startLine - 1).join('\n');
            const after = lines.slice(selection.endLine).join('\n');
            const newContent = before + (before ? '\n' : '') + diffPreview.modifiedCode + (after ? '\n' : '') + after;
            
            updateFileContent(fileId, newContent);
        } else {
            // Replace entire file content
            updateFileContent(fileId, diffPreview.modifiedCode);
        }
        
        setDiffPreview(null);
    }, [diffPreview, file, fileId, selection, updateFileContent]);
    
    /**
     * Reject diff (close modal)
     */
    const handleRejectDiff = useCallback(() => {
        setDiffPreview(null);
    }, []);
    
    return (
        <>
            <CodeEditor fileId={fileId} />
            
            {/* Code Action Menu */}
            <CodeActionMenu
                isOpen={isActionMenuOpen}
                position={actionMenuPosition}
                onClose={() => setIsActionMenuOpen(false)}
                onActionSelect={handleCodeAction}
            />
            
            {/* Diff Preview Modal */}
            {diffPreview && (
                <DiffPreviewModal
                    isOpen={true}
                    onClose={() => setDiffPreview(null)}
                    onApprove={handleApplyDiff}
                    onReject={handleRejectDiff}
                    action={diffPreview.action}
                    originalCode={diffPreview.originalCode}
                    modifiedCode={diffPreview.modifiedCode}
                    fileName={file?.name || ''}
                />
            )}
        </>
    );
};

