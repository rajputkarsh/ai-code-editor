import { z } from 'zod';
import { extractJsonFromText } from './parse';
import type { AgentPlan, AgentPermissionState } from './types';

const agentPlanSchema = z.object({
    summary: z.string().min(1),
    steps: z
        .array(
            z.object({
                id: z.string().min(1),
                title: z.string().min(1),
                description: z.string().min(1),
                filesToRead: z.array(z.string()),
                filesToModify: z.array(z.string()),
                filesToCreate: z.array(z.string()),
            })
        )
        .min(1),
});

interface AgentPlannerInput {
    task: string;
    workspaceFiles: string[];
    permissions: AgentPermissionState;
}

export async function generateAgentPlan({
    task,
    workspaceFiles,
    permissions,
}: AgentPlannerInput): Promise<AgentPlan> {
    const systemPrompt = [
        'You are an autonomous planning assistant for a code editor.',
        'Return ONLY valid JSON matching the schema:',
        '{ "summary": string, "steps": [{ "id": string, "title": string, "description": string, "filesToRead": string[], "filesToModify": string[], "filesToCreate": string[] }] }',
        'Rules:',
        '- Use only file paths that exist in the workspace list for reads/modifications.',
        '- For new files, include their full path under filesToCreate.',
        '- Keep steps small and sequential.',
        '- No extra keys, no markdown.',
    ].join('\n');

    const permissionLine = [
        `Permissions for this task:`,
        `read=${permissions.read}, modify=${permissions.modify}, create=${permissions.create}, delete=${permissions.delete}`,
        'Plan must respect permissions (no modify/create/delete if not allowed).',
    ].join(' ');

    const userPrompt = [
        `Task: ${task}`,
        permissionLine,
        'Workspace files:',
        workspaceFiles.join('\n'),
    ].join('\n');

    const response = await fetch('/api/ai-chat/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to generate agent plan');
    }

    const data = await response.json();
    const rawText: string = data.response;
    const jsonText = extractJsonFromText(rawText);
    const parsed = agentPlanSchema.safeParse(JSON.parse(jsonText));

    if (!parsed.success) {
        throw new Error('Agent plan response did not match schema.');
    }

    return parsed.data;
}

