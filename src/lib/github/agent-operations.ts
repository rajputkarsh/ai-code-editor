/**
 * Agent GitHub Operations
 *
 * This module centralizes all GitHub write operations for Agent Mode.
 * Permission boundary: callers must ensure user approval before invoking these functions.
 * Failure modes: any GitHub API error throws and must be surfaced to the user.
 */

import { githubApiRequest } from '@/lib/github/clerk-auth';
import { buildDeterministicBranchName } from '@/lib/github/branch-naming';

export type AgentGitHubChangeType = 'modify' | 'create' | 'delete';

export interface AgentGitHubChange {
  filePath: string;
  changeType: AgentGitHubChangeType;
  updatedContent?: string;
}

interface GitHubRefResponse {
  object: {
    sha: string;
  };
}

interface GitHubCommitResponse {
  sha: string;
  tree: {
    sha: string;
  };
}

interface GitHubTreeResponse {
  sha: string;
}

interface GitHubPullRequestResponse {
  html_url: string;
  number: number;
}

function normalizeGitHubPath(path: string): string {
  return path.replace(/^\/+/, '');
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && /not found/i.test(error.message);
}

export async function ensureRepoAccess(owner: string, repo: string): Promise<void> {
  // Access check ensures the token can read the repository before writes.
  await githubApiRequest(`/repos/${owner}/${repo}`);
}

async function getRefSha(owner: string, repo: string, ref: string): Promise<string> {
  const data = await githubApiRequest<GitHubRefResponse>(`/repos/${owner}/${repo}/git/ref/${ref}`);
  return data.object.sha;
}

async function getCommit(owner: string, repo: string, sha: string): Promise<GitHubCommitResponse> {
  return githubApiRequest<GitHubCommitResponse>(`/repos/${owner}/${repo}/git/commits/${sha}`);
}

async function createBranch(owner: string, repo: string, branchName: string, baseSha: string): Promise<void> {
  await githubApiRequest(`/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
  });
}

async function getOrCreateBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseBranch: string
): Promise<{ headSha: string; created: boolean }> {
  try {
    const existingSha = await getRefSha(owner, repo, `heads/${branchName}`);
    return { headSha: existingSha, created: false };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const baseSha = await getRefSha(owner, repo, `heads/${baseBranch}`);
  await createBranch(owner, repo, branchName, baseSha);
  return { headSha: baseSha, created: true };
}

async function createTree(
  owner: string,
  repo: string,
  baseTreeSha: string,
  changes: AgentGitHubChange[]
): Promise<string> {
  const tree = changes.map((change) => {
    const path = normalizeGitHubPath(change.filePath);

    if (change.changeType === 'delete') {
      return { path, sha: null };
    }

    if (change.updatedContent === undefined) {
      throw new Error(`Missing updatedContent for ${change.changeType}: ${path}`);
    }

    return {
      path,
      mode: '100644',
      type: 'blob',
      content: change.updatedContent,
    };
  });

  const response = await githubApiRequest<GitHubTreeResponse>(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree,
    }),
  });

  return response.sha;
}

async function createCommit(
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const response = await githubApiRequest<GitHubCommitResponse>(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [parentSha],
    }),
  });

  return response.sha;
}

async function updateBranchRef(
  owner: string,
  repo: string,
  branchName: string,
  commitSha: string
): Promise<void> {
  await githubApiRequest(`/repos/${owner}/${repo}/git/refs/heads/${branchName}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sha: commitSha,
      force: false,
    }),
  });
}

async function openPullRequest(
  owner: string,
  repo: string,
  baseBranch: string,
  headBranch: string,
  title: string,
  body: string
): Promise<GitHubPullRequestResponse> {
  return githubApiRequest<GitHubPullRequestResponse>(`/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      head: headBranch,
      base: baseBranch,
      body,
    }),
  });
}

export async function publishAgentChanges(options: {
  owner: string;
  repo: string;
  baseBranch: string;
  branchName: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  changes: AgentGitHubChange[];
}): Promise<{ branchName: string; commitSha: string; prUrl: string; prNumber: number }> {
  const {
    owner,
    repo,
    baseBranch,
    branchName,
    commitMessage,
    prTitle,
    prBody,
    changes,
  } = options;

  if (changes.length === 0) {
    throw new Error('No changes to publish.');
  }

  // Permission boundary reminder: the caller must only invoke this after explicit approval.
  await ensureRepoAccess(owner, repo);

  if (branchName === baseBranch) {
    throw new Error('Branch name cannot match the base branch.');
  }

  const { headSha } = await getOrCreateBranch(owner, repo, branchName, baseBranch);
  const parentCommit = await getCommit(owner, repo, headSha);
  const treeSha = await createTree(owner, repo, parentCommit.tree.sha, changes);
  const commitSha = await createCommit(owner, repo, commitMessage, treeSha, headSha);
  await updateBranchRef(owner, repo, branchName, commitSha);

  const pr = await openPullRequest(owner, repo, baseBranch, branchName, prTitle, prBody);

  return {
    branchName,
    commitSha,
    prUrl: pr.html_url,
    prNumber: pr.number,
  };
}

export function computeAgentBranchName(task: string, baseBranch: string): string {
  return buildDeterministicBranchName(task, baseBranch);
}

