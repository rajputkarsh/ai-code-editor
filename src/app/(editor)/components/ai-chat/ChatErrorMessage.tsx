/**
 * ChatErrorMessage Component
 * Displays error messages with helpful context
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ChatErrorMessageProps {
    error: string;
}

export function ChatErrorMessage({ error }: ChatErrorMessageProps) {
    // Check for common error patterns
    const isApiKeyError = error.toLowerCase().includes('api key') || 
                          error.toLowerCase().includes('unauthorized') ||
                          error.toLowerCase().includes('authentication');
    
    const isModelError = error.toLowerCase().includes('model') || 
                         error.toLowerCase().includes('not found') ||
                         error.toLowerCase().includes('404');
    
    const isRateLimitError = error.toLowerCase().includes('rate limit') ||
                              error.toLowerCase().includes('quota') ||
                              error.toLowerCase().includes('429');
    
    const isTokenLimitError = error.toLowerCase().includes('token limit') ||
                               error.toLowerCase().includes('token') && error.toLowerCase().includes('exceeded');

    return (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded m-3">
            <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-400 mb-1">
                        AI Error
                    </h4>
                    <p className="text-sm text-red-200 mb-3">
                        {error}
                    </p>
                    
                    {/* Helpful suggestions based on error type */}
                    {isApiKeyError && (
                        <div className="text-xs text-red-300 space-y-1">
                            <p className="font-medium">💡 To fix this:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                                <li>Get an API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></li>
                                <li>Add it to <code className="bg-red-950 px-1 py-0.5 rounded">.env.local</code> as <code className="bg-red-950 px-1 py-0.5 rounded">GEMINI_API_KEY=your_key</code></li>
                                <li>Restart the dev server</li>
                            </ol>
                        </div>
                    )}
                    
                    {isModelError && (
                        <div className="text-xs text-red-300 space-y-1">
                            <p className="font-medium">💡 This is a model configuration issue:</p>
                            <p className="ml-2">The server will automatically retry with the correct model. If this persists, restart the dev server.</p>
                        </div>
                    )}
                    
                    {isRateLimitError && (
                        <div className="text-xs text-red-300 space-y-1">
                            <p className="font-medium">💡 Rate limit reached:</p>
                            <p className="ml-2">Please wait a moment and try again. Free tier: 15 requests/minute.</p>
                        </div>
                    )}
                    
                    {isTokenLimitError && (
                        <div className="text-xs text-red-300 space-y-1">
                            <p className="font-medium">💡 Token limit exceeded:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Your conversation has become too long</li>
                                <li>Clear the chat to start fresh</li>
                                <li>Use shorter code selections</li>
                                <li>Break complex questions into smaller parts</li>
                            </ul>
                        </div>
                    )}
                    
                    {!isApiKeyError && !isModelError && !isRateLimitError && !isTokenLimitError && (
                        <div className="text-xs text-red-300">
                            <p>Check the browser console and server logs for more details.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

