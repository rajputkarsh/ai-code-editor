import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createAgentDefinition,
  deleteAgentDefinition,
  getAgentDefinition,
  listAgentDefinitions,
  updateAgentDefinition,
} from '@/lib/ai/platform/agent-registry';
import { AGENT_ALLOWED_TOOLS, AI_ANALYTICS_EVENTS, AI_TASK_TYPES, MODEL_IDS } from '@/lib/ai/platform/types';
import { listToolDescriptors } from '@/lib/ai/platform/tools';
import { getUsageGuard, resolveModelForTask, saveModelPreference } from '@/lib/ai/platform/model-governance';
import { getUsageDashboard, setUsageLimit } from '@/lib/ai/platform/usage-tracker';
import { isValidAnalyticsEvent, logAnalyticsEvent } from '@/lib/ai/platform/analytics';
import { builtInExtensions } from '@/lib/extensions/builtin';
import { extensionRegistry, persistExtensionMetadata } from '@/lib/extensions/registry';

const permissionScopeSchema = z.object({
  readFiles: z.boolean(),
  writeFiles: z.boolean(),
  commit: z.boolean(),
  createBranch: z.boolean(),
  openPR: z.boolean(),
});

const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  persona: z.string().min(1),
  allowedTools: z.array(z.enum(AGENT_ALLOWED_TOOLS)).min(1),
  permissionScope: permissionScopeSchema,
  teamScope: z.string().uuid().optional(),
});

const updateAgentSchema = createAgentSchema;

const modelPreferenceSchema = z.object({
  taskType: z.enum(AI_TASK_TYPES),
  model: z.enum(MODEL_IDS),
  workspaceId: z.string().uuid().optional(),
});

const resolveModelSchema = z.object({
  taskType: z.enum(AI_TASK_TYPES),
  workspaceId: z.string().uuid().optional(),
  requestedModel: z.string().optional(),
});

const usageLimitSchema = z.object({
  scopeType: z.enum(['USER', 'TEAM']),
  userId: z.string().optional(),
  teamId: z.string().uuid().optional(),
  billingPeriodStart: z.string().datetime(),
  billingPeriodEnd: z.string().datetime(),
  softLimitTokens: z.number().int().positive(),
  hardLimitTokens: z.number().int().positive(),
  warningThresholdPercent: z.number().int().min(1).max(99),
  aiDisabled: z.boolean(),
});

const extensionActivationSchema = z.object({
  extensionId: z.string().min(1),
  workspaceId: z.string().uuid().nullable().optional(),
});

const extensionCommandSchema = z.object({
  commandId: z.string().min(1),
});

const extensionWorkspaceHookSchema = z.object({
  workspaceId: z.string().uuid().nullable(),
});

const extensionFileSaveHookSchema = z.object({
  workspaceId: z.string().uuid().nullable(),
  filePath: z.string().min(1),
});

const analyticsEventSchema = z.object({
  eventType: z.enum(AI_ANALYTICS_EVENTS),
  workspaceId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function getUserId(c: Context): string {
  const userId = c.get('userId');
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

let extensionsBootstrapped = false;
async function bootstrapBuiltInExtensions(userId: string): Promise<void> {
  if (extensionsBootstrapped) return;
  for (const extension of builtInExtensions) {
    extensionRegistry.register(extension);
    await persistExtensionMetadata({
      id: extension.id,
      name: extension.name,
      version: extension.version,
      commands: extension.commands.map((cmd) => cmd.id),
      permissionScope: extension.permissionScope,
      createdBy: userId,
    });
  }
  extensionsBootstrapped = true;
}

export const aiPlatformApp = new Hono();

aiPlatformApp.get('/tools', async (c) => {
  return c.json({ tools: listToolDescriptors() });
});

aiPlatformApp.post('/agents', zValidator('json', createAgentSchema), async (c) => {
  const userId = getUserId(c);
  const body = c.req.valid('json');
  const agent = await createAgentDefinition({
    userId,
    name: body.name,
    description: body.description,
    persona: body.persona,
    allowedTools: body.allowedTools,
    permissionScope: body.permissionScope,
    teamScope: body.teamScope,
  });
  return c.json({ agent }, 201);
});

aiPlatformApp.get('/agents', async (c) => {
  const userId = getUserId(c);
  const agents = await listAgentDefinitions(userId);
  return c.json({ agents });
});

aiPlatformApp.get('/agents/:agentId', async (c) => {
  const userId = getUserId(c);
  const agent = await getAgentDefinition(userId, c.req.param('agentId'));
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  return c.json({ agent });
});

aiPlatformApp.put('/agents/:agentId', zValidator('json', updateAgentSchema), async (c) => {
  const userId = getUserId(c);
  const body = c.req.valid('json');
  const agent = await updateAgentDefinition({
    userId,
    agentId: c.req.param('agentId'),
    name: body.name,
    description: body.description,
    persona: body.persona,
    allowedTools: body.allowedTools,
    permissionScope: body.permissionScope,
  });
  return c.json({ agent });
});

aiPlatformApp.delete('/agents/:agentId', async (c) => {
  const userId = getUserId(c);
  await deleteAgentDefinition(userId, c.req.param('agentId'));
  return c.json({ success: true });
});

aiPlatformApp.post('/models/preference', zValidator('json', modelPreferenceSchema), async (c) => {
  const userId = getUserId(c);
  const body = c.req.valid('json');
  await saveModelPreference({
    userId,
    workspaceId: body.workspaceId,
    taskType: body.taskType,
    model: body.model,
  });
  return c.json({ success: true });
});

aiPlatformApp.post('/models/resolve', zValidator('json', resolveModelSchema), async (c) => {
  const userId = getUserId(c);
  const body = c.req.valid('json');
  const model = await resolveModelForTask({
    userId,
    taskType: body.taskType,
    workspaceId: body.workspaceId,
    requestedModel: body.requestedModel,
  });
  return c.json({ model });
});

aiPlatformApp.get('/usage/guard', async (c) => {
  const userId = getUserId(c);
  const usage = await getUsageGuard(userId);
  return c.json(usage);
});

aiPlatformApp.get('/usage/dashboard', async (c) => {
  const userId = getUserId(c);
  const dashboard = await getUsageDashboard(userId);
  return c.json({ dashboard });
});

aiPlatformApp.post('/usage/limits', zValidator('json', usageLimitSchema), async (c) => {
  const userId = getUserId(c);
  const body = c.req.valid('json');
  await setUsageLimit({
    actorUserId: userId,
    scopeType: body.scopeType,
    userId: body.userId,
    teamId: body.teamId,
    billingPeriodStart: new Date(body.billingPeriodStart),
    billingPeriodEnd: new Date(body.billingPeriodEnd),
    softLimitTokens: body.softLimitTokens,
    hardLimitTokens: body.hardLimitTokens,
    warningThresholdPercent: body.warningThresholdPercent,
    aiDisabled: body.aiDisabled,
  });
  return c.json({ success: true });
});

aiPlatformApp.get('/extensions', async (c) => {
  const userId = getUserId(c);
  await bootstrapBuiltInExtensions(userId);
  return c.json({
    apiVersion: '1.0.0',
    extensions: extensionRegistry.list().map((extension) => ({
      id: extension.id,
      name: extension.name,
      version: extension.version,
      commands: extension.commands,
      permissionScope: extension.permissionScope,
    })),
  });
});

aiPlatformApp.post('/extensions/activate', zValidator('json', extensionActivationSchema), async (c) => {
  const userId = getUserId(c);
  await bootstrapBuiltInExtensions(userId);
  const body = c.req.valid('json');
  await extensionRegistry.activate(body.extensionId, {
    userId,
    workspaceId: body.workspaceId ?? null,
  });
  return c.json({ success: true });
});

aiPlatformApp.post('/extensions/command', zValidator('json', extensionCommandSchema), async (c) => {
  getUserId(c);
  const body = c.req.valid('json');
  await extensionRegistry.runCommand(body.commandId);
  return c.json({ success: true });
});

aiPlatformApp.post('/extensions/hooks/workspace-change', zValidator('json', extensionWorkspaceHookSchema), async (c) => {
  getUserId(c);
  const body = c.req.valid('json');
  await extensionRegistry.notifyWorkspaceChange(body.workspaceId);
  return c.json({ success: true });
});

aiPlatformApp.post('/extensions/hooks/file-save', zValidator('json', extensionFileSaveHookSchema), async (c) => {
  getUserId(c);
  const body = c.req.valid('json');
  await extensionRegistry.notifyFileSave(body.workspaceId, body.filePath);
  return c.json({ success: true });
});

aiPlatformApp.post('/analytics/events', zValidator('json', analyticsEventSchema), async (c) => {
  const userId = getUserId(c);
  const body = c.req.valid('json');
  if (!isValidAnalyticsEvent(body.eventType)) {
    return c.json({ error: 'Invalid analytics event type' }, 400);
  }
  await logAnalyticsEvent({
    eventType: body.eventType,
    userId,
    workspaceId: body.workspaceId,
    teamId: body.teamId,
    metadata: body.metadata,
  });
  return c.json({ success: true });
});
