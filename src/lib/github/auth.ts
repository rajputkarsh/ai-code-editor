/**
 * GitHub OAuth Authentication
 * 
 * Phase 2: GitHub integration for repository import and sync.
 * 
 * Security:
 * - OAuth tokens stored server-side only
 * - Tokens are user-scoped
 * - Explicit permission scopes (read-only or read-write)
 */

import { env } from '@/lib/config/env';

export interface GitHubOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
}

/**
 * OAuth scopes for GitHub
 */
export const GITHUB_SCOPES = {
    READ_ONLY: ['repo:status', 'repo_deployment', 'public_repo', 'read:user'],
    READ_WRITE: ['repo', 'read:user', 'user:email'],
};

/**
 * Get GitHub OAuth configuration
 */
export function getGitHubOAuthConfig(scope: 'read' | 'write' = 'read'): GitHubOAuthConfig {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        throw new Error('GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.');
    }
    
    return {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUri: `${env.NEXT_PUBLIC_APP_URL}/api/github/callback`,
        scopes: scope === 'write' ? GITHUB_SCOPES.READ_WRITE : GITHUB_SCOPES.READ_ONLY,
    };
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthorizationUrl(scope: 'read' | 'write' = 'read', state?: string): string {
    const config = getGitHubOAuthConfig(scope);
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(' '),
        state: state || crypto.randomUUID(),
    });
    
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeGitHubCode(code: string): Promise<{
    access_token: string;
    token_type: string;
    scope: string;
}> {
    const config = getGitHubOAuthConfig();
    
    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.redirectUri,
        }),
    });
    
    if (!response.ok) {
        throw new Error('Failed to exchange GitHub OAuth code');
    }
    
    const data = await response.json();
    
    if (data.error) {
        throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }
    
    return {
        access_token: data.access_token,
        token_type: data.token_type,
        scope: data.scope,
    };
}

/**
 * Get GitHub user info
 */
export async function getGitHubUser(accessToken: string): Promise<{
    id: number;
    login: string;
    name: string;
    email: string;
    avatar_url: string;
}> {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        },
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch GitHub user info');
    }
    
    return response.json();
}

/**
 * Verify GitHub token is still valid
 */
export async function verifyGitHubToken(accessToken: string): Promise<boolean> {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });
        
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Revoke GitHub token
 */
export async function revokeGitHubToken(accessToken: string): Promise<void> {
    const config = getGitHubOAuthConfig();
    
    await fetch(`https://api.github.com/applications/${config.clientId}/token`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
            'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
            access_token: accessToken,
        }),
    });
}

