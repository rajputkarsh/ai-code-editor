import { z } from 'zod';
import { extractJsonFromText } from './parse';
import type { AgentPlanStep, AgentPermissionState, AgentStepResult } from './types';

const agentStepSchema = z.object({
    summary: z.string().min(1),
    changes: z.array(
        z.object({
            filePath: z.string().min(1),
            changeType: z.enum(['modify', 'create', 'delete']),
            updatedContent: z.string().optional(),
        })
    ),
});

interface AgentExecutorInput {
    task: string;
    step: AgentPlanStep;
    permissions: AgentPermissionState;
    existingFiles: string[];
    fileContents: Record<string, string>;
}

export async function executeAgentStep({
    task,
    step,
    permissions,
    existingFiles,
    fileContents,
}: AgentExecutorInput): Promise<AgentStepResult> {
    const systemPrompt = [
        'You are an execution assistant that proposes code changes for a step.',
        'Return ONLY valid JSON matching the schema:',
        '{ "summary": string, "changes": [{ "filePath": string, "changeType": "modify"|"create"|"delete", "updatedContent"?: string }] }',
        'Rules:',
        '- For modify/create, include full updatedContent (entire file).',
        '- For delete, omit updatedContent.',
        '- Only touch files in the step plan.',
        '- No markdown, no extra keys.',
    ].join('\n');

    const permissionLine = [
        `Permissions for this task:`,
        `read=${permissions.read}, modify=${permissions.modify}, create=${permissions.create}, delete=${permissions.delete},`,
        `createBranch=${permissions.createBranch}, commit=${permissions.commit}, push=${permissions.push}, openPullRequest=${permissions.openPullRequest}`,
        'Do not propose changes outside these permissions.',
    ].join(' ');

    const fileContext = Object.entries(fileContents)
        .map(([path, content]) => `FILE: ${path}\n${content}`)
        .join('\n\n');

    const userPrompt = [
        `Task: ${task}`,
        `Step: ${step.title} - ${step.description}`,
        permissionLine,
        'Existing workspace files:',
        existingFiles.join('\n'),
        'Current file contents for this step:',
        fileContext || '(no files provided)',
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
        throw new Error(errorData?.error || 'Failed to generate agent step');
    }

    const data = await response.json();
    const rawText: string = data.response;
    const jsonText = extractJsonFromText(rawText);
    const parsed = agentStepSchema.safeParse(JSON.parse(jsonText));

    if (!parsed.success) {
        throw new Error('Agent step response did not match schema.');
    }

    return {
        stepId: step.id,
        summary: parsed.data.summary,
        changes: parsed.data.changes,
    };
}

