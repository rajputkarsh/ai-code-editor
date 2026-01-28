/**
 * Browser-side sandbox execution via WebContainer.
 *
 * Sandbox strategy:
 * - Runs inside WebContainer (isolated from host FS and environment).
 * - Workspace VFS is mounted per execution (workspace-scoped).
 * - Command allowlist + no shell operators.
 *
 * Execution limits:
 * - Hard timeout (10s).
 * - Kill process on timeout or user abort.
 */

import { WebContainer, type FileSystemTree, type WebContainerProcess } from '@webcontainer/api';
import type { VFSNode, VFSStructure } from '@/lib/workspace/types';
import type { TerminalStreamEvent } from './types';

const MAX_EXECUTION_MS = 10_000;
const DISALLOWED_SHELL_PATTERN = /[;&|`$<>]/;

const ALLOWED_MANAGERS = ['npm', 'yarn', 'pnpm'] as const;
type PackageManager = (typeof ALLOWED_MANAGERS)[number];

type ParsedCommand =
    | { manager: PackageManager; action: 'install'; raw: string }
    | { manager: PackageManager; action: 'run'; scriptName: string; raw: string };

let containerPromise: Promise<WebContainer> | null = null;

function getNodePath(nodes: Record<string, VFSNode>, rootId: string, id: string): string {
    const parts: string[] = [];
    let currentId: string | null = id;

    while (currentId) {
        const node = nodes[currentId];
        if (!node) break;
        if (currentId !== rootId) {
            parts.unshift(node.name);
        }
        currentId = node.parentId;
    }

    return `/${parts.join('/')}`;
}

function buildFileSystemTree(vfs: VFSStructure): FileSystemTree {
    const tree: FileSystemTree = {};
    const nodes = vfs.nodes;
    const rootId = vfs.rootId;

    const ensureDirectory = (parts: string[]) => {
        let cursor: FileSystemTree = tree;
        for (const part of parts) {
            const existing = cursor[part];
            if (!existing || !('directory' in existing)) {
                cursor[part] = { directory: {} };
            }
            cursor = (cursor[part] as { directory: FileSystemTree }).directory;
        }
    };

    for (const node of Object.values(nodes)) {
        const fullPath = getNodePath(nodes, rootId, node.id);
        const parts = fullPath.split('/').filter(Boolean);
        if (parts.length === 0) continue;

        if (node.type === 'folder') {
            ensureDirectory(parts);
            continue;
        }

        const fileParts = parts.slice(0, -1);
        if (fileParts.length) {
            ensureDirectory(fileParts);
        }

        let cursor: FileSystemTree = tree;
        for (const part of fileParts) {
            cursor = (cursor[part] as { directory: FileSystemTree }).directory;
        }

        const fileName = parts[parts.length - 1];
        cursor[fileName] = {
            file: {
                contents: node.content ?? '',
            },
        };
    }

    return tree;
}

async function getWebContainer(): Promise<WebContainer> {
    if (!containerPromise) {
        containerPromise = WebContainer.boot();
    }
    return containerPromise;
}

async function ensurePackageManager(
    manager: PackageManager,
    container: WebContainer
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (manager === 'npm') return { ok: true };

    try {
        // Best-effort enablement via corepack (ships with Node).
        const enable = await container.spawn('corepack', ['enable']);
        await enable.exit;
        const prepare = await container.spawn('corepack', ['prepare', `${manager}@latest`, '--activate']);
        await prepare.exit;
        return { ok: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to enable package manager.';
        return { ok: false, error: message };
    }
}

function parseTerminalCommand(command: string): { parsed?: ParsedCommand; error?: string } {
    const trimmed = command.trim();
    if (!trimmed) return { error: 'Command cannot be empty.' };
    if (trimmed.length > 200) {
        return { error: 'Command exceeds 200 characters.' };
    }
    if (DISALLOWED_SHELL_PATTERN.test(trimmed)) {
        return { error: 'Shell operators are not allowed in the sandbox.' };
    }

    const parts = trimmed.split(/\s+/);
    const manager = parts[0] as PackageManager;
    if (!ALLOWED_MANAGERS.includes(manager)) {
        return { error: 'Only npm, yarn, and pnpm are supported in the sandbox.' };
    }

    const action = parts[1];
    if (!action) {
        return { error: 'Missing command action (install, dev, build, test, or script name).' };
    }

    if (action === 'install' || action === 'i') {
        return { parsed: { manager, action: 'install', raw: trimmed } };
    }

    if (action === 'run') {
        const scriptName = parts[2];
        if (!scriptName) {
            return { error: 'Missing script name for "run".' };
        }
        return { parsed: { manager, action: 'run', scriptName, raw: trimmed } };
    }

    return { parsed: { manager, action: 'run', scriptName: action, raw: trimmed } };
}

function loadPackageScripts(vfs: VFSStructure): { scripts?: Record<string, string>; error?: string } {
    const nodes = Object.values(vfs.nodes);
    const packageNode = nodes.find(
        (node) => node.type === 'file' && getNodePath(vfs.nodes, vfs.rootId, node.id) === '/package.json'
    );
    if (!packageNode || !packageNode.content) {
        return { error: 'package.json not found in workspace root.' };
    }

    try {
        const parsed = JSON.parse(packageNode.content) as { scripts?: Record<string, string> };
        return { scripts: parsed.scripts ?? {} };
    } catch {
        return { error: 'package.json is not valid JSON.' };
    }
}

function getSpawnArgs(parsed: ParsedCommand): { command: string; args: string[] } {
    if (parsed.action === 'install') {
        return { command: parsed.manager, args: ['install'] };
    }

    if (parsed.manager === 'npm') {
        return { command: 'npm', args: ['run', parsed.scriptName] };
    }

    return { command: parsed.manager, args: ['run', parsed.scriptName] };
}

async function streamProcessOutput(
    process: WebContainerProcess,
    onEvent: (event: TerminalStreamEvent) => void
): Promise<void> {
    const decoder = new TextDecoder();
    await process.output.pipeTo(
        new WritableStream({
            write(chunk) {
                const text = decoder.decode(chunk);
                if (text) {
                    onEvent({ type: 'output', text });
                }
            },
        })
    );
}

export async function runTerminalCommand(options: {
    command: string;
    vfs: VFSStructure;
    onEvent: (event: TerminalStreamEvent) => void;
    onExit: (event: TerminalStreamEvent & { type: 'exit' }) => void;
    signal?: AbortSignal;
}): Promise<void> {
    const { command, vfs, onEvent, onExit, signal } = options;
    const startedAt = Date.now();
    const { parsed, error } = parseTerminalCommand(command);

    if (error || !parsed) {
        onEvent({ type: 'error', text: error ?? 'Invalid command.' });
        onExit({ type: 'exit', exitCode: 1, durationMs: Date.now() - startedAt });
        return;
    }

    const { scripts, error: scriptError } = loadPackageScripts(vfs);
    if (scriptError) {
        onEvent({ type: 'error', text: scriptError });
        onExit({ type: 'exit', exitCode: 1, durationMs: Date.now() - startedAt });
        return;
    }

    if (parsed.action === 'run' && (!scripts || !scripts[parsed.scriptName])) {
        onEvent({ type: 'error', text: `Script "${parsed.scriptName}" not found in package.json.` });
        onExit({ type: 'exit', exitCode: 1, durationMs: Date.now() - startedAt });
        return;
    }

    const container = await getWebContainer();

    onEvent({ type: 'status', text: 'Booting sandboxed environment...' });
    await container.mount(buildFileSystemTree(vfs));
    onEvent({ type: 'status', text: 'Workspace mounted in sandbox.' });

    const managerReady = await ensurePackageManager(parsed.manager, container);
    if (!managerReady.ok) {
        onEvent({
            type: 'error',
            text: `Unable to enable ${parsed.manager}: ${managerReady.error}`,
        });
        onExit({ type: 'exit', exitCode: 1, durationMs: Date.now() - startedAt });
        return;
    }

    const { command: spawnCommand, args } = getSpawnArgs(parsed);
    const process = await container.spawn(spawnCommand, args, { cwd: '/' });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleAbort = () => {
        process.kill();
        onEvent({ type: 'error', text: 'Execution cancelled by user.' });
    };

    if (signal) {
        signal.addEventListener('abort', handleAbort, { once: true });
    }

    const timeoutPromise = new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
            process.kill();
            onEvent({
                type: 'error',
                text: `Execution timed out after ${MAX_EXECUTION_MS / 1000}s.`,
            });
            resolve();
        }, MAX_EXECUTION_MS);
    });

    const outputPromise = streamProcessOutput(process, onEvent);
    const exitCode = await Promise.race([
        process.exit,
        timeoutPromise.then(() => 124),
    ]);

    if (timeoutId) clearTimeout(timeoutId);
    if (signal) {
        signal.removeEventListener('abort', handleAbort);
    }

    await outputPromise;

    const durationMs = Date.now() - startedAt;
    onExit({
        type: 'exit',
        exitCode: typeof exitCode === 'number' ? exitCode : 1,
        durationMs,
    });
}

