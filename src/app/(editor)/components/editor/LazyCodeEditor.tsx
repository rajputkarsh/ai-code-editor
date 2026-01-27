'use client';

/**
 * Lazy-loaded Monaco Editor wrapper
 * 
 * This component uses dynamic imports to load Monaco Editor only when needed,
 * improving initial page load performance.
 * 
 * Performance optimizations:
 * - Monaco Editor is code-split and loaded on demand
 * - Loading state provides immediate feedback
 * - Reduces initial bundle size significantly
 */

import React, { Suspense, lazy } from 'react';

// Lazy load the CodeEditor component
// This delays loading of Monaco and its dependencies until the editor is actually needed
const CodeEditor = lazy(() => 
    import('./CodeEditor').then(module => ({ default: module.CodeEditor }))
);

interface LazyCodeEditorProps {
    fileId: string;
}

/**
 * Loading fallback component
 * Shows while Monaco Editor is being loaded
 */
const EditorLoadingFallback = () => (
    <div className="h-full w-full flex items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-neutral-400">Loading editor...</p>
        </div>
    </div>
);

/**
 * Lazy-loaded Code Editor
 * Wraps the actual CodeEditor in Suspense for code splitting
 */
export const LazyCodeEditor: React.FC<LazyCodeEditorProps> = ({ fileId }) => {
    return (
        <Suspense fallback={<EditorLoadingFallback />}>
            <CodeEditor fileId={fileId} />
        </Suspense>
    );
};





