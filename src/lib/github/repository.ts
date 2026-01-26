/**
 * GitHub Repository Operations
 * 
 * Phase 2: Functions for working with GitHub repositories:
 * - Fetch repository contents
 * - Clone repository to workspace
 * - Get file trees
 */

export interface GitHubFile {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string | null;
    type: 'file' | 'dir';
    content?: string; // Base64 encoded
    encoding?: string;
}

/**
 * Fetch repository contents at a specific path
 */
export async function fetchRepositoryContents(
    accessToken: string,
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
): Promise<GitHubFile[]> {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
    if (ref) {
        url.searchParams.append('ref', ref);
    }
    
    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        },
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch repository contents: ${response.statusText}`);
    }
    
    return response.json();
}

/**
 * Fetch file content from GitHub
 */
export async function fetchFileContent(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref?: string
): Promise<string> {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
    if (ref) {
        url.searchParams.append('ref', ref);
    }
    
    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
        },
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Decode base64 content
    if (data.content && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    
    return data.content || '';
}

/**
 * Recursively fetch all files in a repository
 * (Shallow clone - no git history)
 */
export async function cloneRepository(
    accessToken: string,
    owner: string,
    repo: string,
    branch?: string,
    maxFiles: number = 1000
): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    let fileCount = 0;
    
    async function fetchRecursive(path: string = '') {
        if (fileCount >= maxFiles) {
            return; // Limit to prevent excessive API calls
        }
        
        const contents = await fetchRepositoryContents(accessToken, owner, repo, path, branch);
        
        for (const item of contents) {
            if (fileCount >= maxFiles) break;
            
            if (item.type === 'file') {
                // Fetch file content
                try {
                    const content = await fetchFileContent(accessToken, owner, repo, item.path, branch);
                    files.set(item.path, content);
                    fileCount++;
                } catch (error) {
                    console.error(`Failed to fetch ${item.path}:`, error);
                    // Skip files that fail to fetch
                }
            } else if (item.type === 'dir') {
                // Recursively fetch directory contents
                await fetchRecursive(item.path);
            }
        }
    }
    
    await fetchRecursive();
    return files;
}

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    // Support formats:
    // - https://github.com/owner/repo
    // - https://github.com/owner/repo.git
    // - git@github.com:owner/repo.git
    
    const httpsMatch = url.match(/github\.com[\/:]([^\/]+)\/([^\/\.]+)/);
    if (httpsMatch) {
        return {
            owner: httpsMatch[1],
            repo: httpsMatch[2],
        };
    }
    
    return null;
}

