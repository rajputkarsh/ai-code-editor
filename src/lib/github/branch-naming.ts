/**
 * Deterministic, human-readable branch naming for agent GitHub operations.
 * Keep this module dependency-free so it can be used on both client and server.
 */

function slugify(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.slice(0, 40);
}

function hashString(input: string): string {
  // Simple deterministic hash (djb2). Avoid crypto to keep client-safe.
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildDeterministicBranchName(task: string, baseBranch: string): string {
  const slug = slugify(task) || 'agent-task';
  const hash = hashString(`${task}:${baseBranch}`).slice(0, 6);
  return `agent/${slug}-${hash}`;
}

