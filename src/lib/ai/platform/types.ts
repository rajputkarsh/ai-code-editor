export const AI_TASK_TYPES = ['chat', 'inline_completion', 'agent_mode'] as const;
export type AITaskType = (typeof AI_TASK_TYPES)[number];

export const AI_ANALYTICS_EVENTS = [
  'AI_REQUEST',
  'AI_APPLY',
  'AGENT_PLAN_CREATED',
  'AGENT_PLAN_APPROVED',
  'PR_CREATED',
] as const;
export type AIAnalyticsEventType = (typeof AI_ANALYTICS_EVENTS)[number];

export const AGENT_ALLOWED_TOOLS = [
  'FileSystemTool',
  'GitTool',
  'SearchTool',
  'TerminalTool',
  'AICompletionTool',
] as const;
export type AgentAllowedTool = (typeof AGENT_ALLOWED_TOOLS)[number];

export interface AgentPermissionScope {
  readFiles: boolean;
  writeFiles: boolean;
  commit: boolean;
  createBranch: boolean;
  openPR: boolean;
}

export interface AgentDefinition {
  agentId: string;
  name: string;
  description: string;
  persona: string;
  allowedTools: AgentAllowedTool[];
  permissionScope: AgentPermissionScope;
  createdBy: string;
  teamScope?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MODEL_IDS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export interface ModelPreference {
  userId: string;
  workspaceId?: string | null;
  taskType: AITaskType;
  model: ModelId;
}

export interface UsageSnapshot {
  usedTokens: number;
  softLimitTokens: number;
  hardLimitTokens: number;
  warningThresholdPercent: number;
  warningReached: boolean;
  hardLimitReached: boolean;
  aiDisabled: boolean;
}
