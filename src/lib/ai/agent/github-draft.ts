import { z } from 'zod';
import { extractJsonFromText } from './parse';
import type { AgentAppliedChange } from './types';

const githubDraftSchema = z.object({
  commitMessage: z.string().min(1),
  prTitle: z.string().min(1),
  summary: z.string().min(1),
  risks: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});

export interface AgentGitHubDraft {
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

function formatChanges(changes: AgentAppliedChange[]): string {
  return changes
    .map((change) => `${change.changeType.toUpperCase()}: ${change.filePath}`)
    .join('\n');
}

function buildPrBody(summary: string, files: string[], risks: string[], assumptions: string[]): string {
  const filesSection = files.length > 0 ? files.map((file) => `- ${file}`).join('\n') : '- None';
  const risksSection =
    risks.length > 0 ? risks.map((risk) => `- ${risk}`).join('\n') : '- None';
  const assumptionsSection =
    assumptions.length > 0 ? assumptions.map((assumption) => `- ${assumption}`).join('\n') : '- None';

  return [
    '## Summary',
    summary.trim(),
    '',
    '## Files Modified',
    filesSection,
    '',
    '## Risks & Assumptions',
    risksSection,
    assumptionsSection,
  ].join('\n');
}

export async function generateGitHubDraft(options: {
  task: string;
  repoFullName: string;
  baseBranch: string;
  changes: AgentAppliedChange[];
  workspaceId?: string;
  model?: string;
}): Promise<AgentGitHubDraft> {
  const { task, repoFullName, baseBranch, changes, workspaceId, model } = options;
  const fileList = Array.from(new Set(changes.map((change) => change.filePath)));
  const changeSummary = formatChanges(changes);

  const systemPrompt = [
    'You write GitHub commit messages and pull request metadata for an AI agent.',
    'Return ONLY valid JSON matching the schema:',
    '{ "commitMessage": string, "prTitle": string, "summary": string, "risks": string[], "assumptions": string[] }',
    'Rules:',
    '- commitMessage must follow conventional commits (e.g., "feat: ...")',
    '- commitMessage must explain WHY the change was made, not just what.',
    '- prTitle should be concise and human-readable.',
    '- summary should be 1-3 sentences.',
    '- risks/assumptions can be empty arrays.',
    '- No markdown outside JSON.',
  ].join('\n');

  const userPrompt = [
    `Task: ${task}`,
    `Repository: ${repoFullName}`,
    `Base branch: ${baseBranch}`,
    'Changes:',
    changeSummary || '(no changes listed)',
  ].join('\n');

  const response = await fetch('/api/ai-chat/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      workspaceId,
      model,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || 'Failed to generate GitHub draft');
  }

  const data = await response.json();
  const rawText: string = data.response;
  const jsonText = extractJsonFromText(rawText);
  const parsed = githubDraftSchema.safeParse(JSON.parse(jsonText));

  if (!parsed.success) {
    throw new Error('Invalid GitHub draft response from AI');
  }

  const { commitMessage, prTitle, summary, risks, assumptions } = parsed.data;

  return {
    commitMessage: commitMessage.trim(),
    prTitle: prTitle.trim(),
    prBody: buildPrBody(summary, fileList, risks, assumptions),
  };
}

