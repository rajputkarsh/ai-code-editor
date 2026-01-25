'use client';

/**
 * Lazy-loaded AI Chat Panel wrapper
 * 
 * Loads the AI Chat Panel only when the user opens it, improving initial page load.
 * The panel and all its dependencies are code-split for better performance.
 */

import React, { Suspense, lazy } from 'react';
import { PromptTemplate } from '@/lib/ai/prompt-templates';

const AIChatPanel = lazy(() => 
    import('./AIChatPanel').then(module => ({ default: module.AIChatPanel }))
);

interface LazyAIChatPanelProps {
    onTemplateSelect?: (template: PromptTemplate) => void;
}

/**
 * Loading fallback - minimal since panel loads in background
 */
const ChatLoadingFallback = () => (
    <div className="
        flex flex-col h-full bg-neutral-900 border-l border-neutral-800 
        w-full md:w-96 
        flex-shrink-0
        fixed md:relative
        top-0 right-0
        z-40
    ">
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <div className="inline-block w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-neutral-400">Loading AI chat...</p>
            </div>
        </div>
    </div>
);

/**
 * Lazy-loaded AI Chat Panel
 * Only loads when the panel is actually opened
 */
export const LazyAIChatPanel: React.FC<LazyAIChatPanelProps> = ({ onTemplateSelect }) => {
    return (
        <Suspense fallback={<ChatLoadingFallback />}>
            <AIChatPanel onTemplateSelect={onTemplateSelect} />
        </Suspense>
    );
};

