/**
 * GitHub OAuth via Clerk
 * 
 * This module fetches GitHub OAuth tokens from Clerk instead of managing
 * our own OAuth flow. Much simpler and more secure!
 */

import { auth } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';

export interface GitHubUserInfo {
  username: string;
  userId: string;
  email?: string;
  avatarUrl?: string;
  name?: string;
}

/**
 * Get GitHub OAuth token from Clerk
 * 
 * This assumes the user signed in with GitHub via Clerk.
 * If they used a different provider, this will return null.
 */
export async function getGitHubTokenFromClerk(): Promise<string | null> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      console.log('No authenticated user');
      return null;
    }
    
    // Fetch user with external accounts
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    
    // Find GitHub OAuth connection
    // Note: Clerk uses 'oauth_github' as the provider identifier, not 'github'
    const githubAccount = user.externalAccounts?.find(
      (account) => account.provider === 'oauth_github'
    );
    
    if (!githubAccount) {
      console.log('User has no GitHub account connected');
      return null;
    }
    
    // Get access token
    const accessToken = (githubAccount as any).accessToken;
    
    if (!accessToken) {
      console.log('GitHub account has no access token');
      return null;
    }
    
    return accessToken;
  } catch (error) {
    console.error('Error fetching GitHub token from Clerk:', error);
    return null;
  }
}

/**
 * Get GitHub user info from Clerk
 */
export async function getGitHubUserFromClerk(): Promise<GitHubUserInfo | null> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return null;
    }
    
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    
    // Note: Clerk uses 'oauth_github' as the provider identifier, not 'github'
    const githubAccount = user.externalAccounts?.find(
      (account) => account.provider === 'oauth_github'
    );
    
    if (!githubAccount) {
      return null;
    }
    
    // Type cast to access properties that exist but aren't in the type definition
    const account = githubAccount as any;
    
    return {
      username: account.username || account.githubUsername || '',
      userId: account.providerUserId || account.id || '',
      email: account.emailAddress || account.email || undefined,
      avatarUrl: account.imageUrl || account.avatarUrl || undefined,
      name: account.firstName && account.lastName
        ? `${account.firstName} ${account.lastName}`
        : account.name || undefined,
    };
  } catch (error) {
    console.error('Error fetching GitHub user from Clerk:', error);
    return null;
  }
}

/**
 * Check if user has GitHub connected via Clerk
 */
export async function hasGitHubConnected(): Promise<boolean> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return false;
    }
    
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    
    // Note: Clerk uses 'oauth_github' as the provider identifier, not 'github'
    const hasGitHub = user.externalAccounts?.some(
      (account) => account.provider === 'oauth_github'
    );
    
    return hasGitHub || false;
  } catch (error) {
    console.error('Error checking GitHub connection:', error);
    return false;
  }
}

/**
 * Make authenticated GitHub API request
 */
export async function githubApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getGitHubTokenFromClerk();
  
  if (!token) {
    throw new Error('GitHub token not available. Please sign in with GitHub.');
  }
  
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.github.com${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Code-Editor',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`GitHub API error: ${error.message || response.statusText}`);
  }
  
  return response.json();
}

