'use client';

/**
 * GitHub OAuth Callback Page
 * 
 * Phase 2: Handles GitHub OAuth callback and exchanges code for access token.
 * This page is opened in a popup window during GitHub authentication.
 */

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Github, Check, X, Loader2 } from 'lucide-react';

function GitHubCallbackContent() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            setStatus('error');
            setError(errorParam);
            return;
        }

        if (!code) {
            setStatus('error');
            setError('No authorization code received');
            return;
        }

        // Exchange code for access token
        exchangeCode(code);
    }, [searchParams]);

    const exchangeCode = async (code: string) => {
        try {
            const response = await fetch('/api/github/auth/callback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setStatus('success');
                // Close window after 2 seconds
                setTimeout(() => {
                    window.close();
                }, 2000);
            } else {
                setStatus('error');
                setError(data.error || 'Failed to authenticate');
            }
        } catch (err) {
            setStatus('error');
            setError('Failed to connect to server');
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
            <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8 max-w-md w-full text-center">
                {status === 'loading' && (
                    <>
                        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                        <h1 className="text-xl font-semibold text-neutral-100 mb-2">
                            Connecting to GitHub...
                        </h1>
                        <p className="text-neutral-400">
                            Please wait while we complete the authentication.
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-10 h-10 text-green-500" />
                        </div>
                        <h1 className="text-xl font-semibold text-neutral-100 mb-2">
                            Successfully Connected!
                        </h1>
                        <p className="text-neutral-400 mb-4">
                            Your GitHub account has been connected.
                        </p>
                        <p className="text-sm text-neutral-500">
                            This window will close automatically...
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <X className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-xl font-semibold text-neutral-100 mb-2">
                            Connection Failed
                        </h1>
                        <p className="text-neutral-400 mb-4">
                            {error || 'Failed to connect GitHub account'}
                        </p>
                        <button
                            onClick={() => window.close()}
                            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </>
                )}

                <div className="mt-6 flex items-center justify-center gap-2 text-neutral-500">
                    <Github className="w-4 h-4" />
                    <span className="text-xs">GitHub OAuth</span>
                </div>
            </div>
        </div>
    );
}

export default function GitHubCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
                <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-8 max-w-md w-full text-center">
                    <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-neutral-100 mb-2">
                        Loading...
                    </h1>
                </div>
            </div>
        }>
            <GitHubCallbackContent />
        </Suspense>
    );
}

