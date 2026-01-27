export type AgentMode = 'chat' | 'agent';

export type AgentStage =
    | 'idle'
    | 'awaiting_permissions'
    | 'planning'
    | 'awaiting_plan_approval'
    | 'executing'
    | 'awaiting_step_approval'
    | 'completed'
    | 'error';

export interface AgentPermissionState {
    read: boolean;
    modify: boolean;
    create: boolean;
    delete: boolean;
    createBranch: boolean;
    commit: boolean;
    push: boolean;
    openPullRequest: boolean;
}

export interface AgentPlanStep {
    id: string;
    title: string;
    description: string;
    filesToRead: string[];
    filesToModify: string[];
    filesToCreate: string[];
}

export interface AgentPlan {
    summary: string;
    steps: AgentPlanStep[];
}

export type AgentChangeType = 'modify' | 'create' | 'delete';

export interface AgentStepChange {
    filePath: string;
    changeType: AgentChangeType;
    updatedContent?: string;
}

export interface AgentAppliedChange extends AgentStepChange {
    originalContent?: string;
}

export interface AgentStepResult {
    stepId: string;
    summary: string;
    changes: AgentStepChange[];
}

