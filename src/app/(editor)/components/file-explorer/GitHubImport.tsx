'use client';

/**
 * GitHub Repository Import Component
 * 
 * Phase 2: Allows users to:
 * - Connect GitHub account
 * - Browse repositories
 * - Select branch
 * - Import repository as workspace
 */

import React, { useState, useEffect } from 'react';
import { Github, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface GitHubImportProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (repoUrl: string, branch: string) => void;
}

interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    default_branch: string;
    private: boolean;
    updated_at: string;
}

interface GitHubBranch {
    name: string;
    commit: {
        sha: string;
    };
}

export const GitHubImport: React.FC<GitHubImportProps> = ({ isOpen, onClose, onImport }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [githubUsername, setGithubUsername] = useState<string | null>(null);
    
    // Repository list state
    const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = useState(false);
    
    // Selected repository and branch
    const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
    const [branches, setBranches] = useState<GitHubBranch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const [isLoadingBranches, setIsLoadingBranches] = useState(false);
    
    const [error, setError] = useState<string | null>(null);

    // Check GitHub connection status
    useEffect(() => {
        if (isOpen) {
            checkGitHubStatus();
        }
    }, [isOpen]);

    const checkGitHubStatus = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/github/auth/status');
            const data = await response.json();
            
            if (data.connected) {
                setIsConnected(true);
                setGithubUsername(data.githubUser.username);
                // Load repositories
                loadRepositories();
            } else {
                setIsConnected(false);
            }
        } catch (error) {
            console.error('Failed to check GitHub status:', error);
            setError('Failed to check GitHub connection');
        } finally {
            setIsLoading(false);
        }
    };

    const connectGitHub = async () => {
        try {
            const response = await fetch('/api/github/auth/url?scope=read');
            const data = await response.json();
            
            if (data.authUrl) {
                // Open GitHub OAuth in a popup window
                const width = 600;
                const height = 700;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;
                
                const popup = window.open(
                    data.authUrl,
                    'github-oauth',
                    `width=${width},height=${height},left=${left},top=${top}`
                );
                
                // Poll for popup close or successful auth
                const pollInterval = setInterval(async () => {
                    if (popup?.closed) {
                        clearInterval(pollInterval);
                        // Recheck connection status
                        await checkGitHubStatus();
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to connect GitHub:', error);
            setError('Failed to connect GitHub');
        }
    };

    const loadRepositories = async () => {
        setIsLoadingRepos(true);
        setError(null);
        
        try {
            const response = await fetch('/api/github/repositories');
            const data = await response.json();
            
            if (response.ok) {
                setRepositories(data.repositories);
            } else {
                throw new Error(data.error || 'Failed to load repositories');
            }
        } catch (error) {
            console.error('Failed to load repositories:', error);
            setError('Failed to load repositories');
        } finally {
            setIsLoadingRepos(false);
        }
    };

    const selectRepository = async (repo: GitHubRepo) => {
        setSelectedRepo(repo);
        setSelectedBranch(repo.default_branch);
        setIsLoadingBranches(true);
        
        try {
            const [owner, repoName] = repo.full_name.split('/');
            const response = await fetch(`/api/github/repository/${owner}/${repoName}/branches`);
            const data = await response.json();
            
            if (response.ok) {
                setBranches(data.branches);
            } else {
                throw new Error(data.error || 'Failed to load branches');
            }
        } catch (error) {
            console.error('Failed to load branches:', error);
            setError('Failed to load branches');
        } finally {
            setIsLoadingBranches(false);
        }
    };

    const handleImport = () => {
        if (selectedRepo && selectedBranch) {
            onImport(selectedRepo.html_url, selectedBranch);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="large">
            <div className="flex flex-col h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-700">
                    <div className="flex items-center gap-2">
                        <Github className="w-5 h-5 text-neutral-400" />
                        <h2 className="text-lg font-semibold text-neutral-100">
                            Import from GitHub
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-neutral-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : !isConnected ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Github className="w-16 h-16 text-neutral-600 mb-4" />
                            <h3 className="text-lg font-medium text-neutral-200 mb-2">
                                Connect Your GitHub Account
                            </h3>
                            <p className="text-sm text-neutral-400 mb-6 text-center max-w-md">
                                Connect your GitHub account to import repositories and work with your code.
                            </p>
                            <button
                                onClick={connectGitHub}
                                className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Github className="w-5 h-5" />
                                Connect GitHub
                            </button>
                        </div>
                    ) : selectedRepo ? (
                        /* Repository Selected - Show Branch Selection */
                        <div>
                            <div className="mb-4">
                                <button
                                    onClick={() => {
                                        setSelectedRepo(null);
                                        setSelectedBranch(null);
                                        setBranches([]);
                                    }}
                                    className="text-sm text-blue-400 hover:text-blue-300"
                                >
                                    ← Back to repositories
                                </button>
                            </div>
                            
                            <div className="mb-6">
                                <h3 className="text-lg font-medium text-neutral-200 mb-2">
                                    {selectedRepo.full_name}
                                </h3>
                                {selectedRepo.description && (
                                    <p className="text-sm text-neutral-400">
                                        {selectedRepo.description}
                                    </p>
                                )}
                            </div>
                            
                            <div>
                                <h4 className="text-sm font-medium text-neutral-300 mb-3">
                                    Select Branch
                                </h4>
                                
                                {isLoadingBranches ? (
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Loading branches...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {branches.map((branch) => (
                                            <button
                                                key={branch.name}
                                                onClick={() => setSelectedBranch(branch.name)}
                                                className={`
                                                    w-full p-3 rounded-lg border transition-colors text-left
                                                    ${selectedBranch === branch.name
                                                        ? 'border-blue-500 bg-blue-900/20'
                                                        : 'border-neutral-700 hover:border-neutral-600 bg-neutral-800'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-neutral-200">
                                                        {branch.name}
                                                    </span>
                                                    {selectedBranch === branch.name && (
                                                        <Check className="w-4 h-4 text-blue-400" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Repository List */
                        <div>
                            <div className="mb-4">
                                <h3 className="text-sm font-medium text-neutral-300">
                                    Your Repositories {githubUsername && `(${githubUsername})`}
                                </h3>
                            </div>
                            
                            {isLoadingRepos ? (
                                <div className="flex items-center gap-2 text-neutral-400">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Loading repositories...</span>
                                </div>
                            ) : repositories.length === 0 ? (
                                <div className="text-center text-neutral-500 py-8">
                                    No repositories found
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {repositories.map((repo) => (
                                        <button
                                            key={repo.id}
                                            onClick={() => selectRepository(repo)}
                                            className="w-full p-4 rounded-lg border border-neutral-700 hover:border-neutral-600 bg-neutral-800 hover:bg-neutral-750 transition-colors text-left"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h4 className="text-neutral-200 font-medium mb-1">
                                                        {repo.full_name}
                                                    </h4>
                                                    {repo.description && (
                                                        <p className="text-sm text-neutral-400 mb-2">
                                                            {repo.description}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                                                        <span>Branch: {repo.default_branch}</span>
                                                        {repo.private && (
                                                            <span className="px-2 py-0.5 bg-neutral-700 rounded">
                                                                Private
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {error && (
                        <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-center gap-2 text-red-400">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {isConnected && selectedRepo && selectedBranch && (
                    <div className="p-4 border-t border-neutral-700 bg-neutral-800">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-neutral-400">
                                Import <span className="text-neutral-200 font-medium">{selectedRepo.full_name}</span> ({selectedBranch})
                            </p>
                            <button
                                onClick={handleImport}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                Import Repository
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

