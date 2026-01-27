/**
 * GitHub API Routes (using Clerk OAuth)
 * 
 * These routes use Clerk's GitHub OAuth tokens instead of managing
 * our own OAuth flow. Much simpler!
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppVariables } from '../middleware';
import {
  getGitHubTokenFromClerk,
  getGitHubUserFromClerk,
  hasGitHubConnected,
  githubApiRequest,
} from '@/lib/github/clerk-auth';
import { computeAgentBranchName, publishAgentChanges, type AgentGitHubChange } from '@/lib/github/agent-operations';

const app = new Hono<{ Variables: AppVariables }>();

/**
 * GET /api/github/auth/status
 * 
 * Check if user has GitHub connected via Clerk
 */
app.get('/auth/status', async (c) => {
  try {
    const connected = await hasGitHubConnected();
    
    if (!connected) {
      return c.json({ connected: false });
    }
    
    const githubUser = await getGitHubUserFromClerk();
    
    return c.json({
      connected: true,
      githubUser,
      provider: 'clerk',
    });
  } catch (error) {
    console.error('Error checking GitHub status:', error);
    return c.json({ error: 'Failed to check GitHub status' }, 500);
  }
});

/**
 * GET /api/github/repositories
 * 
 * List user's GitHub repositories
 */
app.get('/repositories', async (c) => {
  try {
    const repos = await githubApiRequest('/user/repos?sort=updated&per_page=100');
    
    return c.json({
      repositories: repos.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: repo.owner.login,
        description: repo.description,
        private: repo.private,
        default_branch: repo.default_branch,
        html_url: repo.html_url,
        updated_at: repo.updated_at,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching repositories:', error);
    return c.json({ error: error.message || 'Failed to fetch repositories' }, 500);
  }
});

/**
 * GET /api/github/repository/:owner/:repo
 * 
 * Get specific repository details
 */
app.get('/repository/:owner/:repo', async (c) => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  
  try {
    const repository = await githubApiRequest(`/repos/${owner}/${repo}`);
    
    return c.json({
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      owner: repository.owner.login,
      description: repository.description,
      isPrivate: repository.private,
      defaultBranch: repository.default_branch,
      url: repository.html_url,
      cloneUrl: repository.clone_url,
      updatedAt: repository.updated_at,
      language: repository.language,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
    });
  } catch (error: any) {
    console.error('Error fetching repository:', error);
    return c.json({ error: error.message || 'Failed to fetch repository' }, 500);
  }
});

/**
 * GET /api/github/repository/:owner/:repo/branches
 * 
 * List branches for a repository
 */
app.get('/repository/:owner/:repo/branches', async (c) => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  
  try {
    const branches = await githubApiRequest(`/repos/${owner}/${repo}/branches`);
    
    return c.json({
      branches: branches.map((branch: any) => ({
        name: branch.name,
        sha: branch.commit.sha,
        protected: branch.protected,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    return c.json({ error: error.message || 'Failed to fetch branches' }, 500);
  }
});

/**
 * GET /api/github/repository/:owner/:repo/tree/:branch
 * 
 * Get file tree for a branch
 */
app.get('/repository/:owner/:repo/tree/:branch', async (c) => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const branch = c.req.param('branch');
  
  try {
    // Get the latest commit for the branch
    const branchData = await githubApiRequest(`/repos/${owner}/${repo}/branches/${branch}`);
    const treeSha = branchData.commit.commit.tree.sha;
    
    // Get the file tree (recursive)
    const tree = await githubApiRequest(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);
    
    return c.json({
      tree: tree.tree.map((item: any) => ({
        path: item.path,
        type: item.type,
        sha: item.sha,
        size: item.size,
        mode: item.mode,
      })),
      truncated: tree.truncated,
    });
  } catch (error: any) {
    console.error('Error fetching tree:', error);
    return c.json({ error: error.message || 'Failed to fetch tree' }, 500);
  }
});

/**
 * GET /api/github/repository/:owner/:repo/contents
 * 
 * Get file contents from a repository
 */
app.get('/repository/:owner/:repo/contents', async (c) => {
  const owner = c.req.param('owner');
  const repo = c.req.param('repo');
  const path = c.req.query('path') || '';
  const ref = c.req.query('ref'); // branch name
  
  try {
    const url = `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ''}`;
    const contents = await githubApiRequest(url);
    
    // If it's a file, decode the content
    if (contents.type === 'file' && contents.content) {
      // GitHub API provides encoding info - usually 'base64' for all files
      const encoding = contents.encoding || 'base64';
      const fileName = contents.name.toLowerCase();
      
      // Check if it's an image file
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp'];
      const isImage = imageExtensions.some(ext => fileName.endsWith(ext));
      
      // Check if it's SVG (text-based image)
      const isSvg = fileName.endsWith('.svg');
      
      try {
        if (isImage && !isSvg) {
          // For binary images, keep as base64 and mark as image
          // This will be converted to data URL on the frontend
          return c.json({
            type: 'file',
            name: contents.name,
            path: contents.path,
            sha: contents.sha,
            size: contents.size,
            content: contents.content, // Keep base64
            isImage: true,
            isBinary: false, // We can store base64
            encoding: encoding,
          });
        }
        
        // Try to decode as UTF-8 text
        const decodedContent = Buffer.from(contents.content, encoding as BufferEncoding).toString('utf-8');
        
        // Check if content has null bytes (binary file indicator)
        const isBinary = decodedContent.includes('\0');
        
        return c.json({
          type: 'file',
          name: contents.name,
          path: contents.path,
          sha: contents.sha,
          size: contents.size,
          content: isBinary ? null : decodedContent,
          isImage: false,
          isBinary: isBinary,
          encoding: encoding,
        });
      } catch (error) {
        // If decoding fails, it's likely a binary file
        return c.json({
          type: 'file',
          name: contents.name,
          path: contents.path,
          sha: contents.sha,
          size: contents.size,
          content: null,
          isImage: false,
          isBinary: true,
          encoding: encoding,
        });
      }
    }
    
    // If it's a directory, return the list
    if (Array.isArray(contents)) {
      return c.json({
        type: 'dir',
        contents: contents.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          sha: item.sha,
          size: item.size,
        })),
      });
    }
    
    return c.json(contents);
  } catch (error: any) {
    console.error('Error fetching contents:', error);
    return c.json({ error: error.message || 'Failed to fetch contents' }, 500);
  }
});

/**
 * GET /api/github/user
 * 
 * Get authenticated GitHub user info
 */
app.get('/user', async (c) => {
  try {
    const githubUser = await getGitHubUserFromClerk();
    
    if (!githubUser) {
      return c.json({ error: 'GitHub account not connected' }, 401);
    }
    
    return c.json(githubUser);
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return c.json({ error: error.message || 'Failed to fetch user' }, 500);
  }
});

const agentPublishSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  baseBranch: z.string().min(1),
  task: z.string().min(1),
  branchName: z.string().min(1),
  commitMessage: z.string().min(1),
  prTitle: z.string().min(1),
  prBody: z.string().min(1),
  changes: z.array(
    z.object({
      filePath: z.string().min(1),
      changeType: z.enum(['modify', 'create', 'delete']),
      updatedContent: z.string().optional(),
    })
  ),
});

/**
 * POST /api/github/agent/publish
 *
 * Executes approved agent GitHub operations:
 * - Create branch (if needed)
 * - Commit changes
 * - Push to remote
 * - Open Pull Request
 *
 * Permission boundary: caller must only invoke after explicit user approval.
 */
app.post(
  '/agent/publish',
  zValidator('json', agentPublishSchema),
  async (c) => {
    const payload = c.req.valid('json');

    const expectedBranchName = computeAgentBranchName(payload.task, payload.baseBranch);
    if (payload.branchName !== expectedBranchName) {
      return c.json({ error: 'Branch name mismatch for this task.' }, 400);
    }

    const changes: AgentGitHubChange[] = payload.changes.map((change) => ({
      filePath: change.filePath,
      changeType: change.changeType,
      updatedContent: change.updatedContent,
    }));

    for (const change of changes) {
      if (change.changeType !== 'delete' && change.updatedContent === undefined) {
        return c.json(
          { error: `Missing updatedContent for ${change.changeType}: ${change.filePath}` },
          400
        );
      }
    }

    try {
      const result = await publishAgentChanges({
        owner: payload.owner,
        repo: payload.repo,
        baseBranch: payload.baseBranch,
        branchName: payload.branchName,
        commitMessage: payload.commitMessage,
        prTitle: payload.prTitle,
        prBody: payload.prBody,
        changes,
      });

      return c.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to publish GitHub changes';
      return c.json({ error: message }, 500);
    }
  }
);

export default app;

