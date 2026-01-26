/**
 * GitHub OAuth and Repository API Routes
 * 
 * Phase 2: GitHub integration for:
 * - OAuth authentication
 * - Repository listing and import
 * - Git-aware operations
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { githubAuth } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AppVariables } from '../middleware';
import {
    getGitHubAuthorizationUrl,
    exchangeGitHubCode,
    getGitHubUser,
    verifyGitHubToken,
    revokeGitHubToken,
} from '@/lib/github/auth';

export const githubApp = new Hono<{ Variables: AppVariables }>();

/**
 * GET /auth/url
 * 
 * Get GitHub OAuth authorization URL
 */
githubApp.get(
    '/auth/url',
    zValidator(
        'query',
        z.object({
            scope: z.enum(['read', 'write']).default('read'),
        })
    ),
    async (c) => {
        const { scope } = c.req.valid('query');
        
        try {
            const authUrl = getGitHubAuthorizationUrl(scope);
            
            return c.json({ authUrl });
        } catch (error) {
            console.error('Failed to generate GitHub auth URL:', error);
            return c.json(
                { error: 'GitHub OAuth is not configured' },
                500
            );
        }
    }
);

/**
 * POST /auth/callback
 * 
 * Handle GitHub OAuth callback
 * Exchange code for access token and store in database
 */
githubApp.post(
    '/auth/callback',
    zValidator(
        'json',
        z.object({
            code: z.string(),
        })
    ),
    async (c) => {
        const { code } = c.req.valid('json');
        const userId = c.get('userId');
        
        const db = getDb();
        if (!db) {
            return c.json(
                { error: 'Database not configured' },
                503
            );
        }
        
        try {
            // Exchange code for access token
            const tokenData = await exchangeGitHubCode(code);
            
            // Get GitHub user info
            const githubUser = await getGitHubUser(tokenData.access_token);
            
            // Store or update GitHub auth in database
            const existingAuth = await db.query.githubAuth.findFirst({
                where: eq(githubAuth.userId, userId),
            });
            
            if (existingAuth) {
                // Update existing
                await db.update(githubAuth)
                    .set({
                        githubUserId: githubUser.id.toString(),
                        githubUsername: githubUser.login,
                        accessToken: tokenData.access_token,
                        scope: tokenData.scope,
                        tokenType: tokenData.token_type,
                        lastUsedAt: new Date(),
                    })
                    .where(eq(githubAuth.userId, userId));
            } else {
                // Insert new
                await db.insert(githubAuth).values({
                    userId,
                    githubUserId: githubUser.id.toString(),
                    githubUsername: githubUser.login,
                    accessToken: tokenData.access_token,
                    scope: tokenData.scope,
                    tokenType: tokenData.token_type,
                });
            }
            
            return c.json({
                success: true,
                githubUser: {
                    id: githubUser.id,
                    login: githubUser.login,
                    name: githubUser.name,
                    avatar_url: githubUser.avatar_url,
                },
            });
            
        } catch (error) {
            console.error('GitHub OAuth callback error:', error);
            return c.json(
                { error: 'Failed to authenticate with GitHub' },
                500
            );
        }
    }
);

/**
 * GET /auth/status
 * 
 * Check if user has connected GitHub account
 */
githubApp.get('/auth/status', async (c) => {
    const userId = c.get('userId');
    
    const db = getDb();
    if (!db) {
        return c.json({ connected: false });
    }
    
    try {
        const auth = await db.query.githubAuth.findFirst({
            where: eq(githubAuth.userId, userId),
        });
        
        if (!auth) {
            return c.json({ connected: false });
        }
        
        // Verify token is still valid
        const isValid = await verifyGitHubToken(auth.accessToken);
        
        if (!isValid) {
            // Token is invalid, remove from database
            await db.delete(githubAuth).where(eq(githubAuth.userId, userId));
            return c.json({ connected: false });
        }
        
        return c.json({
            connected: true,
            githubUser: {
                username: auth.githubUsername,
                userId: auth.githubUserId,
            },
            scope: auth.scope,
        });
        
    } catch (error) {
        console.error('Failed to check GitHub auth status:', error);
        return c.json({ connected: false });
    }
});

/**
 * DELETE /auth/disconnect
 * 
 * Disconnect GitHub account
 */
githubApp.delete('/auth/disconnect', async (c) => {
    const userId = c.get('userId');
    
    const db = getDb();
    if (!db) {
        return c.json(
            { error: 'Database not configured' },
            503
        );
    }
    
    try {
        const auth = await db.query.githubAuth.findFirst({
            where: eq(githubAuth.userId, userId),
        });
        
        if (auth) {
            // Revoke token on GitHub
            try {
                await revokeGitHubToken(auth.accessToken);
            } catch (error) {
                console.error('Failed to revoke GitHub token:', error);
                // Continue anyway to remove from our database
            }
            
            // Remove from database
            await db.delete(githubAuth).where(eq(githubAuth.userId, userId));
        }
        
        return c.json({ success: true });
        
    } catch (error) {
        console.error('Failed to disconnect GitHub:', error);
        return c.json(
            { error: 'Failed to disconnect GitHub' },
            500
        );
    }
});

/**
 * GET /repositories
 * 
 * List user's GitHub repositories
 */
githubApp.get(
    '/repositories',
    zValidator(
        'query',
        z.object({
            page: z.coerce.number().positive().default(1),
            perPage: z.coerce.number().positive().max(100).default(30),
            sort: z.enum(['created', 'updated', 'pushed', 'full_name']).default('updated'),
        })
    ),
    async (c) => {
        const { page, perPage, sort } = c.req.valid('query');
        const userId = c.get('userId');
        
        const db = getDb();
        if (!db) {
            return c.json(
                { error: 'Database not configured' },
                503
            );
        }
        
        try {
            const auth = await db.query.githubAuth.findFirst({
                where: eq(githubAuth.userId, userId),
            });
            
            if (!auth) {
                return c.json(
                    { error: 'GitHub account not connected' },
                    401
                );
            }
            
            const response = await fetch(
                `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&direction=desc`,
                {
                    headers: {
                        'Authorization': `Bearer ${auth.accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                    },
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch repositories');
            }
            
            const repos = await response.json();
            
            // Update last used timestamp
            await db.update(githubAuth)
                .set({ lastUsedAt: new Date() })
                .where(eq(githubAuth.userId, userId));
            
            return c.json({ repositories: repos });
            
        } catch (error) {
            console.error('Failed to fetch repositories:', error);
            return c.json(
                { error: 'Failed to fetch repositories' },
                500
            );
        }
    }
);

/**
 * GET /repository/:owner/:repo
 * 
 * Get specific repository details
 */
githubApp.get('/repository/:owner/:repo', async (c) => {
    const owner = c.req.param('owner');
    const repo = c.req.param('repo');
    const userId = c.get('userId');
    
    const db = getDb();
    if (!db) {
        return c.json(
            { error: 'Database not configured' },
            503
        );
    }
    
    try {
        const auth = await db.query.githubAuth.findFirst({
            where: eq(githubAuth.userId, userId),
        });
        
        if (!auth) {
            return c.json(
                { error: 'GitHub account not connected' },
                401
            );
        }
        
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            {
                headers: {
                    'Authorization': `Bearer ${auth.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch repository');
        }
        
        const repository = await response.json();
        
        return c.json({ repository });
        
    } catch (error) {
        console.error('Failed to fetch repository:', error);
        return c.json(
            { error: 'Failed to fetch repository' },
            500
        );
    }
});

/**
 * GET /repository/:owner/:repo/branches
 * 
 * Get repository branches
 */
githubApp.get('/repository/:owner/:repo/branches', async (c) => {
    const owner = c.req.param('owner');
    const repo = c.req.param('repo');
    const userId = c.get('userId');
    
    const db = getDb();
    if (!db) {
        return c.json(
            { error: 'Database not configured' },
            503
        );
    }
    
    try {
        const auth = await db.query.githubAuth.findFirst({
            where: eq(githubAuth.userId, userId),
        });
        
        if (!auth) {
            return c.json(
                { error: 'GitHub account not connected' },
                401
            );
        }
        
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/branches`,
            {
                headers: {
                    'Authorization': `Bearer ${auth.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch branches');
        }
        
        const branches = await response.json();
        
        return c.json({ branches });
        
    } catch (error) {
        console.error('Failed to fetch branches:', error);
        return c.json(
            { error: 'Failed to fetch branches' },
            500
        );
    }
});

/**
 * POST /import
 * 
 * Import GitHub repository as workspace
 */
githubApp.post(
    '/import',
    zValidator(
        'json',
        z.object({
            repoUrl: z.string().url(),
            branch: z.string().optional(),
        })
    ),
    async (c) => {
        const { repoUrl, branch } = c.req.valid('json');
        const userId = c.get('userId');
        
        const db = getDb();
        if (!db) {
            return c.json(
                { error: 'Database not configured' },
                503
            );
        }
        
        try {
            const auth = await db.query.githubAuth.findFirst({
                where: eq(githubAuth.userId, userId),
            });
            
            if (!auth) {
                return c.json(
                    { error: 'GitHub account not connected' },
                    401
                );
            }
            
            // Parse repository URL
            const { parseGitHubUrl } = await import('@/lib/github/repository');
            const parsed = parseGitHubUrl(repoUrl);
            
            if (!parsed) {
                return c.json(
                    { error: 'Invalid GitHub repository URL' },
                    400
                );
            }
            
            // Import will be handled client-side by fetching files
            // This endpoint just validates the request
            return c.json({
                success: true,
                owner: parsed.owner,
                repo: parsed.repo,
                branch: branch || 'main',
            });
            
        } catch (error) {
            console.error('Failed to import repository:', error);
            return c.json(
                { error: 'Failed to import repository' },
                500
            );
        }
    }
);

