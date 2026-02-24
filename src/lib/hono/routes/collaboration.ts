import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
  addWorkspaceComment,
  assertCanModifyWorkspace,
  assertCanReadWorkspace,
  createAIAuditLog,
  createTeam,
  createTeamPrompt,
  deleteTeamPrompt,
  inviteMember,
  assignWorkspaceToTeam,
  listAIAuditLogs,
  listMembers,
  listTeamPrompts,
  listTeamsForUser,
  listWorkspaceComments,
  removeMember,
  resolveWorkspaceAccess,
  updateMemberRole,
  updateTeamPrompt,
} from '@/lib/collaboration/operations';
import { collaborationRealtimeStore } from '@/lib/collaboration/realtime';

const teamRoleSchema = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
});

const inviteMemberSchema = z.object({
  userId: z.string().min(1),
  role: teamRoleSchema,
});

const updateRoleSchema = z.object({
  role: teamRoleSchema,
});

const createCommentSchema = z.object({
  fileId: z.string().min(1),
  content: z.string().min(1),
});

const assignWorkspaceTeamSchema = z.object({
  teamId: z.string().uuid().nullable(),
});

const teamPromptSchema = z.object({
  title: z.string().min(1).max(255),
  prompt: z.string().min(1),
});

const auditLogSchema = z.object({
  action: z.string().min(1),
  filesModified: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
});

const presenceSchema = z.object({
  workspaceId: z.string().uuid(),
  fileId: z.string().nullable(),
  cursorLine: z.number().int().nullable(),
  cursorColumn: z.number().int().nullable(),
});

const patchSchema = z.object({
  baseVersion: z.number().int().min(0),
  content: z.string(),
});

function getUserId(c: Context): string {
  const userId = c.get('userId');
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

export const collaborationApp = new Hono();

collaborationApp.post('/teams', zValidator('json', createTeamSchema), async (c) => {
  const userId = getUserId(c);
  const { name } = c.req.valid('json');
  const teamId = await createTeam(userId, name);
  return c.json({ id: teamId }, 201);
});

collaborationApp.get('/teams', async (c) => {
  const userId = getUserId(c);
  const teams = await listTeamsForUser(userId);
  return c.json({ teams });
});

collaborationApp.get('/teams/:teamId/members', async (c) => {
  const userId = getUserId(c);
  const teamId = c.req.param('teamId');
  const members = await listMembers(userId, teamId);
  return c.json({ members });
});

collaborationApp.post(
  '/teams/:teamId/members',
  zValidator('json', inviteMemberSchema),
  async (c) => {
    const userId = getUserId(c);
    const teamId = c.req.param('teamId');
    const data = c.req.valid('json');
    await inviteMember(userId, teamId, data.userId, data.role);
    return c.json({ success: true });
  }
);

collaborationApp.patch(
  '/teams/:teamId/members/:memberUserId',
  zValidator('json', updateRoleSchema),
  async (c) => {
    const userId = getUserId(c);
    const teamId = c.req.param('teamId');
    const memberUserId = c.req.param('memberUserId');
    const { role } = c.req.valid('json');
    await updateMemberRole(userId, teamId, memberUserId, role);
    return c.json({ success: true });
  }
);

collaborationApp.delete('/teams/:teamId/members/:memberUserId', async (c) => {
  const userId = getUserId(c);
  const teamId = c.req.param('teamId');
  const memberUserId = c.req.param('memberUserId');
  await removeMember(userId, teamId, memberUserId);
  return c.json({ success: true });
});

collaborationApp.patch(
  '/workspaces/:workspaceId/team',
  zValidator('json', assignWorkspaceTeamSchema),
  async (c) => {
    const userId = getUserId(c);
    const workspaceId = c.req.param('workspaceId');
    const { teamId } = c.req.valid('json');
    await assignWorkspaceToTeam(userId, workspaceId, teamId);
    return c.json({ success: true });
  }
);

collaborationApp.get('/workspaces/:workspaceId/comments', async (c) => {
  const userId = getUserId(c);
  const workspaceId = c.req.param('workspaceId');
  const comments = await listWorkspaceComments(userId, workspaceId);
  return c.json({ comments });
});

collaborationApp.post(
  '/workspaces/:workspaceId/comments',
  zValidator('json', createCommentSchema),
  async (c) => {
    const userId = getUserId(c);
    const workspaceId = c.req.param('workspaceId');
    const data = c.req.valid('json');
    const id = await addWorkspaceComment(userId, workspaceId, data.fileId, data.content);
    return c.json({ id }, 201);
  }
);

collaborationApp.get('/teams/:teamId/prompts', async (c) => {
  const userId = getUserId(c);
  const teamId = c.req.param('teamId');
  const prompts = await listTeamPrompts(userId, teamId);
  return c.json({ prompts });
});

collaborationApp.post('/teams/:teamId/prompts', zValidator('json', teamPromptSchema), async (c) => {
  const userId = getUserId(c);
  const teamId = c.req.param('teamId');
  const data = c.req.valid('json');
  const id = await createTeamPrompt(userId, teamId, data.title, data.prompt);
  return c.json({ id }, 201);
});

collaborationApp.patch('/teams/:teamId/prompts/:promptId', zValidator('json', teamPromptSchema), async (c) => {
  const userId = getUserId(c);
  const teamId = c.req.param('teamId');
  const promptId = c.req.param('promptId');
  const data = c.req.valid('json');
  await updateTeamPrompt(userId, teamId, promptId, data.title, data.prompt);
  return c.json({ success: true });
});

collaborationApp.delete('/teams/:teamId/prompts/:promptId', async (c) => {
  const userId = getUserId(c);
  const teamId = c.req.param('teamId');
  const promptId = c.req.param('promptId');
  await deleteTeamPrompt(userId, teamId, promptId);
  return c.json({ success: true });
});

collaborationApp.get('/workspaces/:workspaceId/audit-logs', async (c) => {
  const userId = getUserId(c);
  const workspaceId = c.req.param('workspaceId');
  const logs = await listAIAuditLogs(userId, workspaceId);
  return c.json({ logs });
});

collaborationApp.post('/workspaces/:workspaceId/audit-logs', zValidator('json', auditLogSchema), async (c) => {
  const userId = getUserId(c);
  const workspaceId = c.req.param('workspaceId');
  const data = c.req.valid('json');
  const id = await createAIAuditLog({
    userId,
    workspaceId,
    action: data.action,
    filesModified: data.filesModified,
    metadata: data.metadata,
  });
  return c.json({ id }, 201);
});

collaborationApp.post('/presence/upsert', zValidator('json', presenceSchema), async (c) => {
  const userId = getUserId(c);
  const data = c.req.valid('json');
  const access = await resolveWorkspaceAccess(userId, data.workspaceId);
  assertCanReadWorkspace(access);
  collaborationRealtimeStore.upsertPresence({
    userId,
    workspaceId: data.workspaceId,
    fileId: data.fileId,
    cursorLine: data.cursorLine,
    cursorColumn: data.cursorColumn,
    updatedAt: Date.now(),
  });
  return c.json({ success: true });
});

collaborationApp.delete('/presence/:workspaceId', async (c) => {
  const userId = getUserId(c);
  const workspaceId = c.req.param('workspaceId');
  collaborationRealtimeStore.removePresence(workspaceId, userId);
  return c.json({ success: true });
});

collaborationApp.get('/presence/:workspaceId', async (c) => {
  const userId = getUserId(c);
  const workspaceId = c.req.param('workspaceId');
  const access = await resolveWorkspaceAccess(userId, workspaceId);
  assertCanReadWorkspace(access);
  const users = collaborationRealtimeStore.listPresence(workspaceId);
  return c.json({ users });
});

collaborationApp.post(
  '/sync/files/:workspaceId/:fileId/patch',
  zValidator('json', patchSchema),
  async (c) => {
    const userId = getUserId(c);
    const workspaceId = c.req.param('workspaceId');
    const fileId = c.req.param('fileId');
    const access = await resolveWorkspaceAccess(userId, workspaceId);
    assertCanModifyWorkspace(access);
    const patch = c.req.valid('json');
    const next = collaborationRealtimeStore.applyPatch(workspaceId, {
      fileId,
      baseVersion: patch.baseVersion,
      content: patch.content,
    });
    return c.json(next);
  }
);

collaborationApp.get('/sync/files/:workspaceId/:fileId/state', async (c) => {
  const userId = getUserId(c);
  const workspaceId = c.req.param('workspaceId');
  const fileId = c.req.param('fileId');
  const access = await resolveWorkspaceAccess(userId, workspaceId);
  assertCanReadWorkspace(access);
  const state = collaborationRealtimeStore.getFileState(workspaceId, fileId);
  return c.json(state);
});
