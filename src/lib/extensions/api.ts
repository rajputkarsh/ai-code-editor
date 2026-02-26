import { AITaskType } from '@/lib/ai/platform/types';

export const EXTENSION_API_VERSION = '1.0.0';

export type ExtensionPermission = 'read_workspace' | 'propose_write' | 'run_ai_action' | 'register_commands';

export interface ExtensionCommand {
  id: string;
  title: string;
  when?: 'command_palette' | 'context_menu' | 'both';
}

export interface ExtensionContext {
  apiVersion: string;
  workspaceId: string | null;
  registerCommand: (command: ExtensionCommand, handler: () => Promise<void>) => void;
  runAIAction: (taskType: AITaskType, prompt: string) => Promise<string>;
  requestDiffPreview: (filePath: string, proposedContent: string) => Promise<void>;
  log: (message: string) => void;
}

export interface ExtensionLifecycle {
  onLoad?: (context: ExtensionContext) => Promise<void>;
  onWorkspaceChange?: (context: ExtensionContext, workspaceId: string | null) => Promise<void>;
  onFileSave?: (context: ExtensionContext, filePath: string) => Promise<void>;
}

export interface ExtensionDefinition extends ExtensionLifecycle {
  id: string;
  name: string;
  version: string;
  commands: ExtensionCommand[];
  permissionScope: ExtensionPermission[];
  activate: (context: ExtensionContext) => Promise<void>;
}
