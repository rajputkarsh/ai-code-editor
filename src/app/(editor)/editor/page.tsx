'use client';

import React, { useState } from 'react';
import { EditorLayout } from '../components/layout/EditorLayout';
import { EditorToolbar } from '../components/layout/EditorToolbar';
import { EditorBottomBar } from '../components/layout/EditorBottomBar';
import { FileExplorer } from '../components/file-explorer/FileExplorer';
import { EditorTabs } from '../components/editor/EditorTabs';
import { LazyCodeEditor } from '../components/editor/LazyCodeEditor';
import { LazyAIChatPanel } from '../components/ai-chat/LazyAIChatPanel';
import { CodeActionMenu } from '../components/editor/CodeActionMenu';
import { DiffPreviewModal } from '../components/editor/DiffPreviewModal';
import { CodeExplanationPanel } from '../components/editor/CodeExplanationPanel';
import { PromptHistory } from '../components/ai-chat/PromptHistory';
import { GitHubImport } from '../components/file-explorer/GitHubImport';
import { useToast } from '@/components/ui/Toast';
import { useEditorState } from '../stores/editor-state';
import { useFileSystem } from '../stores/file-system';
import { useWorkspace } from '../stores/workspace-provider';
import { useAIChatState } from '../stores/ai-chat-state';
import { useSelectionState } from '../stores/selection-state';
import { useInlineAI } from '../stores/inline-ai-state';
import { PromptTemplate } from '@/lib/ai/prompt-templates';
import { ChatContext } from '@/lib/ai/types';
import { detectLanguage } from '@/lib/file-utils';
import { useEditorStatePersistence } from '../stores/editor-persistence';

const EditorArea = () => {
    const { activeTabId, activeSecondaryTabId, isSplit, tabs, activePaneForFileOpen, setActivePaneForFileOpen } = useEditorState();
    const { files } = useFileSystem();

    const activeTab1 = tabs.find(t => t.id === activeTabId);
    const activeFile1 = activeTab1 ? files[activeTab1.fileId] : null;

    const activeTab2 = tabs.find(t => t.id === activeSecondaryTabId);
    const activeFile2 = activeTab2 ? files[activeTab2.fileId] : null;

    const renderEmptyState = (msg: string, pane: 'primary' | 'secondary') => (
        <div 
            className="h-full w-full flex items-center justify-center text-neutral-600 select-none bg-[#1e1e1e]"
        >
            <div className="text-center">
                <p className="mb-2 text-lg font-medium">{msg}</p>
                <p className="text-sm">Select a file to start editing</p>
                {isSplit && (
                    <button
                        onClick={() => setActivePaneForFileOpen(pane)}
                        className={`
                            mt-3 px-3 py-1.5 rounded text-xs transition-colors
                            ${activePaneForFileOpen === pane 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            }
                        `}
                    >
                        {activePaneForFileOpen === pane ? '● Active Pane' : 'Click to Activate'}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e]">
            <EditorTabs />
            {/* Editor panes - side by side on desktop, stacked on mobile/tablet */}
            <div className="flex-1 relative flex flex-col md:flex-row">
                {/* Pane 1 - Primary (Left) */}
                <div 
                    className={`
                        ${isSplit ? 'md:w-1/2 w-full md:border-r border-b md:border-b-0 border-neutral-800' : 'w-full'} 
                        ${isSplit ? 'h-1/2 md:h-full' : 'h-full'}
                        relative
                    `}
                >
                    {/* Active pane indicator - click to activate */}
                    {isSplit && (
                        <button
                            onClick={() => setActivePaneForFileOpen('primary')}
                            className={`
                                absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded shadow-lg transition-all
                                ${activePaneForFileOpen === 'primary'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                                }
                            `}
                        >
                            {activePaneForFileOpen === 'primary' ? '● Left Active' : 'Left'}
                        </button>
                    )}
                    {activeTab1 && activeFile1 ? (
                        <LazyCodeEditor key={activeTab1.id} fileId={activeFile1.id} />
                    ) : (isSplit ? renderEmptyState("Left Pane", 'primary') : (
                        <div className="h-full w-full flex items-center justify-center text-neutral-600 select-none">
                            <div className="text-center px-4">
                                <p className="mb-2 text-lg font-medium">Welcome to AI Code Editor</p>
                                <p className="text-sm">Select a file to start editing</p>
                                <p className="text-xs mt-4 opacity-50">Click the split view button to work on multiple files</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pane 2 - Secondary (Right) - Stacks below Pane 1 on mobile, side-by-side on desktop */}
                {isSplit && (
                    <div 
                        className="md:w-1/2 w-full h-1/2 md:h-full relative"
                    >
                        {/* Active pane indicator - click to activate */}
                        <button
                            onClick={() => setActivePaneForFileOpen('secondary')}
                            className={`
                                absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded shadow-lg transition-all
                                ${activePaneForFileOpen === 'secondary'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                                }
                            `}
                        >
                            {activePaneForFileOpen === 'secondary' ? '● Right Active' : 'Right'}
                        </button>
                        {activeTab2 && activeFile2 ? (
                            <LazyCodeEditor key={activeTab2.id} fileId={activeFile2.id} />
                        ) : renderEmptyState("Right Pane", 'secondary')}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function EditorPage() {
    // Phase 1.5: Initialize editor state persistence (restores tabs, layout, etc.)
    useEditorStatePersistence();

    // Panel visibility state (single source of truth)
    const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);
    const [isAIChatOpen, setIsAIChatOpen] = useState(false);
    const [isPromptHistoryOpen, setIsPromptHistoryOpen] = useState(false);
    const [isGitHubImportOpen, setIsGitHubImportOpen] = useState(false);
    const [isImportingRepo, setIsImportingRepo] = useState(false);
    
    // Phase 2: AI code actions and explanations
    const [isCodeActionMenuOpen, setIsCodeActionMenuOpen] = useState(false);
    const [codeActionMenuPosition, setCodeActionMenuPosition] = useState({ x: 0, y: 0 });
    const [diffPreview, setDiffPreview] = useState<{
        action: string;
        originalCode: string;
        modifiedCode: string;
        isSelection: boolean;
    } | null>(null);
    const [explanationData, setExplanationData] = useState<{
        code: string;
        explanation: string;
        fileName: string;
        scope: 'file' | 'function' | 'selection';
    } | null>(null);

    const { addMessage, setContextInfo } = useAIChatState();
    const { activeTabId, tabs } = useEditorState();
    const { files, updateFileContent, createFile, createFolder, rootId } = useFileSystem();
    const { createNewWorkspace, saveWorkspace, isLoading } = useWorkspace();
    const { selection, hasSelection } = useSelectionState();
    const { setLoadingAction, setLoadingExplanation, addPromptToHistory } = useInlineAI();
    const toast = useToast();

    /**
     * Handle template selection from AI chat panel
     * This creates a chat context and sends the prompt
     * Uses selection if available, otherwise uses full file
     */
    const handleTemplateSelect = (template: PromptTemplate) => {
        // Get active file
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) {
            toast.warning('Please open a file first');
            return;
        }

        const activeFile = files[activeTab.fileId];
        if (!activeFile) {
            toast.error('No active file found');
            return;
        }

        // Create context - use selection if available, otherwise full file
        const context: ChatContext = {
            fileId: activeFile.id,
            fileName: activeFile.name,
            content: activeFile.content || '',
            language: detectLanguage(activeFile.name),
        };

        // Add selection info if available
        if (hasSelection && selection && selection.fileId === activeFile.id) {
            context.selection = {
                text: selection.text,
                startLine: selection.startLine,
                endLine: selection.endLine,
            };
        }

        // Generate prompt from template
        const prompt = template.generatePrompt(context);

        // Set context info with selection details
        const contextInfoText = context.selection
            ? `${activeFile.name}, lines ${context.selection.startLine}-${context.selection.endLine}`
            : `${activeFile.name} (full file)`;
        setContextInfo(contextInfoText);

        // Add user message with metadata
        addMessage({
            role: 'user',
            content: prompt,
            contextMetadata: {
                fileName: activeFile.name,
                language: context.language,
                isSelection: !!context.selection,
                lineRange: context.selection
                    ? {
                          start: context.selection.startLine,
                          end: context.selection.endLine,
                      }
                    : undefined,
            },
        });

        // Open panel if not already open
        setIsAIChatOpen(true);
    };
    
    /**
     * Handle code action request (Phase 2)
     */
    const handleCodeAction = async (actionId: string) => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) {
            toast.warning('Please open a file first');
            return;
        }
        
        const activeFile = files[activeTab.fileId];
        if (!activeFile) return;
        
        setLoadingAction(true);
        
        try {
            const targetCode = selection?.text || activeFile.content || '';
            const isSelection = !!selection?.text;
            const language = detectLanguage(activeFile.name);
            
            const response = await fetch('/api/inline-ai/code-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: actionId,
                    fileName: activeFile.name,
                    language,
                    code: activeFile.content || '',
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
                metadata: { fileName: activeFile.name, action: actionId },
            });
            
        } catch (error) {
            console.error('Code action error:', error);
            toast.error('Failed to perform code action. Please try again.');
        } finally {
            setLoadingAction(false);
        }
    };
    
    /**
     * Handle code explanation request (Phase 2)
     */
    const handleExplainCode = async () => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) {
            toast.warning('Please open a file first');
            return;
        }
        
        const activeFile = files[activeTab.fileId];
        if (!activeFile) return;
        
        setLoadingExplanation(true);
        
        try {
            const targetCode = selection?.text || activeFile.content || '';
            const scope = selection?.text ? 'selection' : 'file';
            const language = detectLanguage(activeFile.name);
            
            const response = await fetch('/api/inline-ai/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: activeFile.name,
                    language,
                    code: targetCode,
                    scope,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to get explanation');
            }
            
            const data = await response.json();
            
            // Show explanation panel
            setExplanationData({
                code: targetCode,
                explanation: data.explanation,
                fileName: activeFile.name,
                scope,
            });
            
            // Add to history
            addPromptToHistory({
                type: 'explain',
                prompt: `Explain ${scope}: ${activeFile.name}`,
                response: data.explanation,
                metadata: { fileName: activeFile.name, scope },
            });
            
        } catch (error) {
            console.error('Explanation error:', error);
            toast.error('Failed to generate explanation. Please try again.');
        } finally {
            setLoadingExplanation(false);
        }
    };
    
    /**
     * Apply diff (replace code in editor)
     */
    const handleApplyDiff = () => {
        if (!diffPreview) return;
        
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (!activeTab) return;
        
        const activeFile = files[activeTab.fileId];
        if (!activeFile) return;
        
        if (diffPreview.isSelection && selection) {
            // Replace selected text with modified code
            const content = activeFile.content || '';
            const lines = content.split('\n');
            
            // Replace the selected lines
            const before = lines.slice(0, selection.startLine - 1).join('\n');
            const after = lines.slice(selection.endLine).join('\n');
            const newContent = before + (before ? '\n' : '') + diffPreview.modifiedCode + (after ? '\n' : '') + after;
            
            updateFileContent(activeTab.fileId, newContent);
        } else {
            // Replace entire file content
            updateFileContent(activeTab.fileId, diffPreview.modifiedCode);
        }
        
        setDiffPreview(null);
    };
    
    /**
     * Handle GitHub repository import (Phase 2)
     * Creates a new clean workspace and imports the repository into it
     */
    const handleGitHubImport = async (repoUrl: string, branch: string) => {
        setIsImportingRepo(true);
        setIsGitHubImportOpen(false); // Close modal to show full page loader
        
        try {
            // Parse GitHub URL to extract owner and repo
            const urlMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
            if (!urlMatch) {
                toast.error('Invalid GitHub repository URL');
                return;
            }
            
            const [, owner, repoName] = urlMatch;
            const cleanRepoName = repoName.replace(/\.git$/, '');
            
            toast.info(`🔄 Creating new workspace for ${owner}/${cleanRepoName}...`, 3000);
            
            // Create a new clean workspace (this clears all existing files)
            const { vfs: freshVfs } = await createNewWorkspace(cleanRepoName, {
                save: false,
                type: 'github',
                githubMetadata: {
                    repositoryUrl: repoUrl,
                    branch,
                },
            });
            const freshRootId = freshVfs.getRootId();
            
            toast.info(`📥 Importing ${owner}/${cleanRepoName} from branch ${branch}...`, 3000);
            
            // Counter for progress
            let fileCount = 0;
            let folderCount = 0;
            
            // Map to store folder paths to their IDs for parallel processing
            const folderMap = new Map<string, string>();
            folderMap.set('', freshRootId); // Root path maps to fresh rootId
            
            // Recursively fetch directory structure and collect all files
            const fetchContents = async (path: string, parentId: string): Promise<Array<{path: string, parentId: string, name: string}>> => {
                const response = await fetch(
                    `/api/github/repository/${owner}/${cleanRepoName}/contents?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(branch)}`
                );
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Failed to fetch contents for path: ${path}`);
                }
                
                const data = await response.json();
                const filePromises: Array<{path: string, parentId: string, name: string}> = [];
                
                // Handle directory listing
                if (data.type === 'dir' && data.contents) {
                    // First, create all folders in this directory
                    const subDirPromises = [];
                    
                    for (const item of data.contents) {
                        if (item.type === 'dir') {
                            // Create folder immediately
                            const folderId = createFolder(parentId, item.name, { skipAutosave: true });
                            folderCount++;
                            folderMap.set(item.path, folderId);
                            
                            // Queue up subdirectory fetch
                            subDirPromises.push(fetchContents(item.path, folderId));
                        } else if (item.type === 'file') {
                            // Add file to the list to be fetched in parallel
                            filePromises.push({
                                path: item.path,
                                parentId: parentId,
                                name: item.name
                            });
                        }
                    }
                    
                    // Recursively fetch subdirectories in parallel
                    const subDirResults = await Promise.all(subDirPromises);
                    
                    // Flatten and combine file lists from subdirectories
                    for (const subFiles of subDirResults) {
                        filePromises.push(...subFiles);
                    }
                }
                
                return filePromises;
            };
            
            // Fetch all directory structure and get list of all files
            const allFiles = await fetchContents('', freshRootId);
            
            toast.info(`📦 Downloading ${allFiles.length} files...`, 2000);
            
            // Helper function to check if file should be imported (text or image)
            const isImportableFile = (filename: string): boolean => {
                const importableExtensions = [
                    // Code files
                    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
                    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php',
                    '.swift', '.kt', '.scala', '.r', '.m', '.sh', '.bash', '.zsh', '.fish',
                    // Web files
                    '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
                    '.xml', '.svg', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
                    // Text files
                    '.txt', '.md', '.markdown', '.rst', '.adoc', '.tex',
                    // Config files
                    '.env', '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc', '.prettierrc',
                    '.babelrc', '.npmrc', '.yarnrc', '.dockerignore',
                    // Data files
                    '.csv', '.tsv', '.log', '.sql',
                    // Images (will be converted to base64 data URLs)
                    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
                ];
                
                const lowerFilename = filename.toLowerCase();
                
                // Check if it matches common importable file extensions
                if (importableExtensions.some(ext => lowerFilename.endsWith(ext))) {
                    return true;
                }
                
                // Special files without extensions (common in repos)
                const textFilenames = ['readme', 'license', 'makefile', 'dockerfile', 'gemfile', 'rakefile', 'procfile'];
                if (textFilenames.some(name => lowerFilename === name || lowerFilename.startsWith(name + '.'))) {
                    return true;
                }
                
                return false;
            };
            
            // Helper to get MIME type for images
            const getImageMimeType = (filename: string): string => {
                const ext = filename.toLowerCase().split('.').pop();
                const mimeTypes: Record<string, string> = {
                    'png': 'image/png',
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'gif': 'image/gif',
                    'webp': 'image/webp',
                    'ico': 'image/x-icon',
                    'bmp': 'image/bmp',
                    'svg': 'image/svg+xml',
                };
                return mimeTypes[ext || ''] || 'image/png';
            };
            
            // Helper function to sanitize content (remove null bytes)
            const sanitizeContent = (content: string): string => {
                // Remove null bytes which PostgreSQL can't handle
                return content.replace(/\0/g, '');
            };
            
            // Filter importable files (text and images)
            const importableFiles = allFiles.filter(file => isImportableFile(file.name));
            const skippedFiles = allFiles.length - importableFiles.length;
            
            if (skippedFiles > 0) {
                toast.info(`⚠️ Skipping ${skippedFiles} binary file(s). Importing ${importableFiles.length} files...`, 3000);
            }
            
            // Fetch and create files in parallel batches (10 at a time to avoid overwhelming the API)
            const BATCH_SIZE = 10;
            for (let i = 0; i < importableFiles.length; i += BATCH_SIZE) {
                const batch = importableFiles.slice(i, i + BATCH_SIZE);
                
                await Promise.all(
                    batch.map(async (fileInfo) => {
                        try {
                            const fileResponse = await fetch(
                                `/api/github/repository/${owner}/${cleanRepoName}/contents?path=${encodeURIComponent(fileInfo.path)}&ref=${encodeURIComponent(branch)}`
                            );
                            
                            if (fileResponse.ok) {
                                const fileData = await fileResponse.json();
                                
                                if (fileData.type === 'file' && fileData.content && !fileData.isBinary) {
                                    let finalContent: string;
                                    
                                    if (fileData.isImage) {
                                        // Convert base64 image to data URL
                                        const mimeType = getImageMimeType(fileInfo.name);
                                        finalContent = `data:${mimeType};base64,${fileData.content}`;
                                    } else {
                                        // Sanitize text content to remove any remaining null bytes
                                        finalContent = sanitizeContent(fileData.content);
                                    }
                                    
                                    createFile(fileInfo.parentId, fileInfo.name, finalContent, { skipAutosave: true });
                                    fileCount++;
                                } else if (fileData.isBinary) {
                                    console.log(`Skipping binary file: ${fileInfo.name}`);
                                }
                            }
                        } catch (err) {
                            console.error(`Failed to fetch file ${fileInfo.path}:`, err);
                        }
                    })
                );
                
                // Update progress
                if (importableFiles.length > 20) {
                    toast.info(`📥 Downloaded ${Math.min(i + BATCH_SIZE, importableFiles.length)}/${importableFiles.length} files...`, 1000);
                }
            }
            
            // Manually save the workspace to ensure all files are persisted
            toast.info('💾 Saving workspace...', 2000);
            await saveWorkspace();
            
            const skippedCount = allFiles.length - fileCount;
            const successMessage = skippedCount > 0
                ? `✅ Repository imported successfully!\n\n${folderCount} folders and ${fileCount} files imported (includes images).\n${skippedCount} non-text binary file(s) skipped.`
                : `✅ Repository imported successfully!\n\n${folderCount} folders and ${fileCount} files imported from ${owner}/${cleanRepoName} (${branch})`;
            
            toast.success(successMessage, 5000);
            
        } catch (error) {
            console.error('Failed to import repository:', error);
            toast.error(
                `❌ Failed to import repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
                5000
            );
        } finally {
            setIsImportingRepo(false);
        }
    };

    return (
        <>
            <EditorLayout
                sidebar={<FileExplorer />}
                editor={
                    <div className="flex flex-col h-full">
                        {/* VS Code-style Toolbar */}
                        <EditorToolbar
                            isFileExplorerOpen={isFileExplorerOpen}
                            isAIChatOpen={isAIChatOpen}
                            onFileExplorerToggle={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
                            onAIChatToggle={() => setIsAIChatOpen(!isAIChatOpen)}
                            onCodeActionsClick={() => setIsCodeActionMenuOpen(true)}
                            onPromptHistoryClick={() => setIsPromptHistoryOpen(true)}
                            onExplainClick={handleExplainCode}
                            onGitHubClick={() => setIsGitHubImportOpen(true)}
                        />
                        <EditorArea />
                        {/* VS Code-style Bottom Bar */}
                        <EditorBottomBar />
                    </div>
                }
                aiChat={isAIChatOpen && (
                    <LazyAIChatPanel 
                        onTemplateSelect={handleTemplateSelect}
                        onClose={() => setIsAIChatOpen(false)}
                    />
                )}
                isSidebarOpen={isFileExplorerOpen}
                onSidebarToggle={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
            />
            
            {/* Phase 2: AI Code Actions Menu */}
            <CodeActionMenu
                isOpen={isCodeActionMenuOpen}
                position={codeActionMenuPosition}
                onClose={() => setIsCodeActionMenuOpen(false)}
                onActionSelect={handleCodeAction}
            />
            
            {/* Phase 2: Diff Preview Modal */}
            {diffPreview && (
                <DiffPreviewModal
                    isOpen={true}
                    onClose={() => setDiffPreview(null)}
                    onApprove={handleApplyDiff}
                    onReject={() => setDiffPreview(null)}
                    action={diffPreview.action}
                    originalCode={diffPreview.originalCode}
                    modifiedCode={diffPreview.modifiedCode}
                    fileName={tabs.find(t => t.id === activeTabId) ? files[tabs.find(t => t.id === activeTabId)!.fileId]?.name || '' : ''}
                />
            )}
            
            {/* Phase 2: Code Explanation Panel */}
            {explanationData && (
                <CodeExplanationPanel
                    isOpen={true}
                    onClose={() => setExplanationData(null)}
                    explanation={explanationData.explanation}
                    code={explanationData.code}
                    fileName={explanationData.fileName}
                    scope={explanationData.scope}
                />
            )}
            
            {/* Phase 2: Prompt History Panel */}
            <PromptHistory
                isOpen={isPromptHistoryOpen}
                onClose={() => setIsPromptHistoryOpen(false)}
            />
            
            {/* Phase 2: GitHub Repository Import */}
            <GitHubImport
                isOpen={isGitHubImportOpen}
                onClose={() => {
                    // Don't allow closing while import is in progress
                    if (!isImportingRepo) {
                        setIsGitHubImportOpen(false);
                    }
                }}
                onImport={handleGitHubImport}
                isImporting={isImportingRepo}
            />
            
            {/* Full Page Loading Overlay - Workspace Restore */}
            {isLoading && !isImportingRepo && (
                <div className="fixed inset-0 bg-[#1e1e1e]/98 z-9999 flex flex-col items-center justify-center backdrop-blur-md">
                    <div className="flex flex-col items-center space-y-6">
                        {/* Spinner */}
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-neutral-700 border-t-blue-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-blue-400 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
                        </div>
                        
                        {/* Text Content */}
                        <div className="text-center space-y-3">
                            <h2 className="text-2xl font-semibold text-neutral-100">
                                Loading Workspace
                            </h2>
                            <p className="text-base text-neutral-400 max-w-md">
                                Restoring your latest workspace...
                            </p>
                        </div>
                        
                        {/* Progress Indicator */}
                        <div className="flex items-center space-x-2 text-neutral-500">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Page Loading Overlay - Repository Import */}
            {isImportingRepo && (
                <div className="fixed inset-0 bg-[#1e1e1e]/98 z-9999 flex flex-col items-center justify-center backdrop-blur-md">
                    <div className="flex flex-col items-center space-y-6">
                        {/* Spinner */}
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-neutral-700 border-t-blue-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-blue-400 rounded-full animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
                        </div>
                        
                        {/* Text Content */}
                        <div className="text-center space-y-3">
                            <h2 className="text-2xl font-semibold text-neutral-100">
                                Importing Repository
                            </h2>
                            <p className="text-base text-neutral-400 max-w-md">
                                Creating workspace and downloading files...
                            </p>
                            <p className="text-sm text-neutral-500">
                                This may take a few moments. Please don't close this window.
                            </p>
                        </div>
                        
                        {/* Progress Indicator */}
                        <div className="flex items-center space-x-2 text-neutral-500">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
