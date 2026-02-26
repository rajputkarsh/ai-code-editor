import { getDb, schema } from '@/lib/db';
import { logAnalyticsEvent } from '@/lib/ai/platform/analytics';
import { ExtensionCommand, ExtensionContext, ExtensionDefinition, EXTENSION_API_VERSION } from './api';

interface RegisteredCommand {
  extensionId: string;
  command: ExtensionCommand;
  handler: () => Promise<void>;
}

const { extensions: extensionsTable } = schema;

class ExtensionRegistry {
  private definitions = new Map<string, ExtensionDefinition>();
  private commands = new Map<string, RegisteredCommand>();

  register(definition: ExtensionDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  list(): ExtensionDefinition[] {
    return Array.from(this.definitions.values());
  }

  get(id: string): ExtensionDefinition | null {
    return this.definitions.get(id) ?? null;
  }

  async activate(id: string, input: { userId: string; workspaceId: string | null }): Promise<void> {
    const extension = this.get(id);
    if (!extension) {
      throw new Error('Extension not found');
    }

    const context = this.buildContext(extension.id, input.workspaceId);
    await extension.activate(context);
    if (extension.onLoad) {
      await extension.onLoad(context);
    }

    await logAnalyticsEvent({
      eventType: 'AI_APPLY',
      userId: input.userId,
      workspaceId: input.workspaceId ?? undefined,
      metadata: { extensionId: id, action: 'activate' },
    });
  }

  async runCommand(commandId: string): Promise<void> {
    const registered = this.commands.get(commandId);
    if (!registered) {
      throw new Error('Extension command not found');
    }
    await registered.handler();
  }

  async notifyWorkspaceChange(workspaceId: string | null): Promise<void> {
    for (const extension of this.definitions.values()) {
      if (!extension.onWorkspaceChange) continue;
      const context = this.buildContext(extension.id, workspaceId);
      await extension.onWorkspaceChange(context, workspaceId);
    }
  }

  async notifyFileSave(workspaceId: string | null, filePath: string): Promise<void> {
    for (const extension of this.definitions.values()) {
      if (!extension.onFileSave) continue;
      const context = this.buildContext(extension.id, workspaceId);
      await extension.onFileSave(context, filePath);
    }
  }

  private buildContext(extensionId: string, workspaceId: string | null): ExtensionContext {
    return {
      apiVersion: EXTENSION_API_VERSION,
      workspaceId,
      registerCommand: (command, handler) => {
        this.commands.set(command.id, {
          extensionId,
          command,
          handler,
        });
      },
      runAIAction: async (_taskType, _prompt) => {
        throw new Error('runAIAction bridge is not wired for direct execution in registry context');
      },
      requestDiffPreview: async (_filePath, _proposedContent) => {
        // Plugin isolation strategy: extensions can only request a diff preview,
        // not mutate workspace directly.
        return;
      },
      log: (message) => {
        console.info(`[extension:${extensionId}] ${message}`);
      },
    };
  }
}

export const extensionRegistry = new ExtensionRegistry();

export async function persistExtensionMetadata(input: {
  id: string;
  name: string;
  version: string;
  commands: string[];
  permissionScope: string[];
  createdBy: string;
  teamId?: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .insert(extensionsTable)
    .values({
      id: input.id,
      name: input.name,
      version: input.version,
      commands: input.commands,
      permissionScope: input.permissionScope,
      createdBy: input.createdBy,
      teamId: input.teamId ?? null,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: extensionsTable.id,
      set: {
        name: input.name,
        version: input.version,
        commands: input.commands,
        permissionScope: input.permissionScope,
        isEnabled: true,
        updatedAt: new Date(),
      },
    });
}
