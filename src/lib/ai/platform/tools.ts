import { AGENT_ALLOWED_TOOLS, AgentAllowedTool } from './types';

export interface ToolDescriptor {
  id: AgentAllowedTool;
  description: string;
  supportsWriteActions: boolean;
}

const TOOL_REGISTRY: Record<AgentAllowedTool, ToolDescriptor> = {
  FileSystemTool: {
    id: 'FileSystemTool',
    description: 'Read and stage file diffs for explicit apply.',
    supportsWriteActions: true,
  },
  GitTool: {
    id: 'GitTool',
    description: 'Create branches, commits, and pull requests when permitted.',
    supportsWriteActions: true,
  },
  SearchTool: {
    id: 'SearchTool',
    description: 'Search across repository context.',
    supportsWriteActions: false,
  },
  TerminalTool: {
    id: 'TerminalTool',
    description: 'Run sandboxed terminal commands when allowed.',
    supportsWriteActions: true,
  },
  AICompletionTool: {
    id: 'AICompletionTool',
    description: 'Invoke model completions for planning and edits.',
    supportsWriteActions: false,
  },
};

export function listToolDescriptors(): ToolDescriptor[] {
  return AGENT_ALLOWED_TOOLS.map((toolId) => TOOL_REGISTRY[toolId]);
}

export function sanitizeAllowedTools(tools: string[]): AgentAllowedTool[] {
  const set = new Set<AgentAllowedTool>();
  tools.forEach((tool) => {
    if ((AGENT_ALLOWED_TOOLS as readonly string[]).includes(tool)) {
      set.add(tool as AgentAllowedTool);
    }
  });
  return Array.from(set);
}

export function toolSupportsWriteAction(tool: AgentAllowedTool): boolean {
  return TOOL_REGISTRY[tool].supportsWriteActions;
}
