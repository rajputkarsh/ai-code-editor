'use client';

/**
 * LivePreviewPanel Component
 * 
 * Phase 4.5: Renders live preview in an isolated iframe.
 * 
 * Features:
 * - Isolated iframe for security
 * - Error display
 * - Loading states
 * - Manual refresh
 * - Layout controls (code-only / split view)
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, Maximize2, Minimize2, AlertCircle } from 'lucide-react';

export interface LivePreviewPanelProps {
  previewUrl: string | null;
  error: string | null;
  isLoading: boolean;
  projectType: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function LivePreviewPanel({
  previewUrl,
  error,
  isLoading,
  projectType,
  onClose,
  onRefresh,
}: LivePreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle iframe load errors
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleError = () => {
      setIframeError('Failed to load preview. Check console for details.');
    };

    const handleLoad = () => {
      setIframeError(null);
    };

    iframe.addEventListener('error', handleError);
    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('error', handleError);
      iframe.removeEventListener('load', handleLoad);
    };
  }, [previewUrl]);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Lifecycle logging: confirm iframe URL binding.
  useEffect(() => {
    if (!previewUrl) return;
    console.info('[Preview] iframe src set', { previewUrl });
  }, [previewUrl]);

  const displayError = error || iframeError;

  return (
    <div
      className={`
        flex flex-col h-full bg-neutral-900 border-l border-neutral-800
        w-full md:w-96
        shrink-0
        fixed md:relative
        top-0 right-0
        z-40
        ${isFullscreen ? 'fixed inset-0 z-50 w-full' : ''}
      `}
    >
      {/* Preview Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-300">Live Preview</span>
          {projectType && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">
              {projectType}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={isLoading || !previewUrl}
            className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh preview"
            aria-label="Refresh preview"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
            title="Close preview"
            aria-label="Close preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative overflow-hidden bg-white">
        {isLoading && !displayError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
            <div className="text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-neutral-400 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">Loading preview... This may take upto 5 minutes.</p>
            </div>
          </div>
        )}

        {displayError && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 p-4">
            <div className="text-center max-w-md">
              <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-neutral-200 mb-2">Preview Error</h3>
              <p className="text-xs text-neutral-400 mb-4 whitespace-pre-wrap">{displayError}</p>
              <button
                onClick={onRefresh}
                className="px-3 py-1.5 text-xs rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {!displayError && previewUrl && (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Live Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            // Security: Restrict iframe capabilities
            // Note: allow-same-origin is needed for some apps, but limits isolation
            // In production, we'd want stricter sandboxing for untrusted code
          />
        )}

        {!displayError && !previewUrl && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
            <div className="text-center">
              <p className="text-sm text-neutral-400">No preview available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
