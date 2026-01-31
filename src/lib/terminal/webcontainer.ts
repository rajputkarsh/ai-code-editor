/**
 * Browser-side sandbox execution via WebContainer.
 *
 * Sandbox strategy:
 * - Runs inside WebContainer (isolated from host FS and environment).
 * - Workspace VFS is mounted per execution (workspace-scoped).
 * - Command allowlist + no shell operators.
 *
 * Execution limits:
 * - Hard timeout (30s, dev servers 20s).
 * - Kill process on timeout or user abort.
 */

import { WebContainer, type WebContainerProcess } from '@webcontainer/api';
import type { VFSNode, VFSStructure } from '@/lib/workspace/types';
import type { TerminalStreamEvent } from './types';

const MAX_EXECUTION_MS = 30_000;
const MAX_DEV_SERVER_MS = 20_000;
const MAX_INSTALL_MS = 600_000;
const DISALLOWED_SHELL_PATTERN = /[;&|`$<>]/;
const WORKSPACE_DIR = '/workspace';
const CACHE_ROOT = '/tmp/webcontainer-cache';
const NPM_CACHE_DIR = `${CACHE_ROOT}/npm`;
const YARN_CACHE_DIR = `${CACHE_ROOT}/yarn`;
const PNPM_STORE_DIR = `${CACHE_ROOT}/pnpm`;

const ALLOWED_MANAGERS = ['npm', 'yarn', 'pnpm'] as const;
type PackageManager = (typeof ALLOWED_MANAGERS)[number];

type ParsedCommand =
    | { manager: PackageManager; action: 'install'; raw: string }
    | { manager: PackageManager; action: 'run'; scriptName: string; raw: string };

declare global {
    // eslint-disable-next-line no-var
    var __webcontainerState:
        | {
              promise?: Promise<WebContainer>;
              lastSyncedFiles: Set<string>;
          }
        | undefined;
}

const getContainerState = () => {
    if (!globalThis.__webcontainerState) {
        globalThis.__webcontainerState = {
            lastSyncedFiles: new Set<string>(),
        };
    }
    return globalThis.__webcontainerState;
};

function getNodePath(nodes: Record<string, VFSNode>, rootId: string, id: string): string {
    const parts: string[] = [];
    let currentId: string | null = id;

    while (currentId) {
        const node: VFSNode | undefined = nodes[currentId];
        if (!node) break;
        if (currentId !== rootId) {
            parts.unshift(node.name);
        }
        currentId = node.parentId;
    }

    return `/${parts.join('/')}`;
}

function collectWorkspaceEntries(vfs: VFSStructure): {
    files: Map<string, string>;
    directories: Set<string>;
} {
    const files = new Map<string, string>();
    const directories = new Set<string>();
    const nodes = vfs.nodes;
    const rootId = vfs.rootId;

    directories.add(WORKSPACE_DIR);

    for (const node of Object.values(nodes)) {
        const fullPath = getNodePath(nodes, rootId, node.id);
        if (fullPath === '/') continue;

        const targetPath = `${WORKSPACE_DIR}${fullPath}`;
        if (node.type === 'folder') {
            directories.add(targetPath);
            continue;
        }

        const parts = targetPath.split('/').filter(Boolean);
        if (parts.length > 1) {
            const dirPath = `/${parts.slice(0, -1).join('/')}`;
            directories.add(dirPath);
        }

        files.set(targetPath, node.content ?? '');
    }

    return { files, directories };
}

async function ensureDirectory(container: WebContainer, path: string): Promise<void> {
    try {
        await container.fs.mkdir(path, { recursive: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('EEXIST')) {
            throw error;
        }
    }
}

async function syncWorkspace(container: WebContainer, vfs: VFSStructure): Promise<void> {
    const state = getContainerState();
    const { files, directories } = collectWorkspaceEntries(vfs);

    for (const dir of directories) {
        await ensureDirectory(container, dir);
    }

    for (const [filePath, contents] of files) {
        await container.fs.writeFile(filePath, contents);
    }

    for (const previousPath of state.lastSyncedFiles) {
        if (!files.has(previousPath)) {
            await container.fs.rm(previousPath, { force: true });
        }
    }

    state.lastSyncedFiles = new Set(files.keys());
}

async function dependenciesInstalled(container: WebContainer): Promise<boolean> {
    try {
        await container.fs.readdir(`${WORKSPACE_DIR}/node_modules`);
        return true;
    } catch {
        return false;
    }
}

async function runProcessWithStreaming(options: {
    container: WebContainer;
    command: string;
    args: string[];
    cwd: string;
    onEvent: (event: TerminalStreamEvent) => void;
    signal?: AbortSignal;
    timeoutMs: number;
    env?: Record<string, string>;
}): Promise<{ exitCode: number; timedOut: boolean }> {
    const { container, command, args, cwd, onEvent, signal, timeoutMs, env } = options;
    const process = await container.spawn(command, args, { cwd, env });
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;

    const handleAbort = () => {
        process.kill();
        onEvent({ type: 'error', text: 'Execution cancelled by user.' });
    };

    if (signal) {
        signal.addEventListener('abort', handleAbort, { once: true });
    }

    const timeoutPromise = new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
            timedOut = true;
            process.kill();
            onEvent({
                type: 'error',
                text: `Execution timed out after ${timeoutMs / 1000}s.`,
            });
            resolve();
        }, timeoutMs);
    });

    const outputPromise = streamProcessOutput(process, onEvent);
    const exitCode = await Promise.race([process.exit, timeoutPromise.then(() => 124)]);

    if (timeoutId) clearTimeout(timeoutId);
    if (signal) {
        signal.removeEventListener('abort', handleAbort);
    }

    await outputPromise;

    return {
        exitCode: typeof exitCode === 'number' ? exitCode : 1,
        timedOut,
    };
}

async function getWebContainer(): Promise<WebContainer> {
    const state = getContainerState();
    if (!state.promise) {
        state.promise = WebContainer.boot().catch((error) => {
            state.promise = undefined;
            throw error;
        });
    }
    return state.promise;
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

function isDevScript(parsed: ParsedCommand): boolean {
    return parsed.action === 'run' && (parsed.scriptName === 'dev' || parsed.scriptName === 'start');
}

function getInstallArgs(manager: PackageManager): string[] {
    if (manager === 'npm') {
        return ['install', '--prefer-offline', '--no-audit', '--no-fund'];
    }
    return ['install', '--prefer-offline'];
}

function getInstallEnv(manager: PackageManager): Record<string, string> {
    const baseEnv = {
        TERM: 'dumb',
        npm_config_progress: 'false',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
        npm_config_prefer_offline: 'true',
        npm_config_cache: NPM_CACHE_DIR,
    };

    if (manager === 'yarn') {
        return {
            ...baseEnv,
            YARN_CACHE_FOLDER: YARN_CACHE_DIR,
            YARN_ENABLE_PROGRESS_BARS: '0',
        };
    }

    if (manager === 'pnpm') {
        return {
            ...baseEnv,
            PNPM_STORE_DIR: PNPM_STORE_DIR,
            PNPM_DISABLE_PROGRESS: '1',
        };
    }

    return baseEnv;
}

async function streamProcessOutput(
    process: WebContainerProcess,
    onEvent: (event: TerminalStreamEvent) => void
): Promise<void> {
    const decoder = new TextDecoder();
    const sanitize = (value: string) =>
        value
            .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
            .replace(/\r/g, '');
    await process.output.pipeTo(
        new WritableStream({
            write(chunk: Uint8Array | string) {
                const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk);
                const clean = sanitize(text);
                if (clean) {
                    onEvent({ type: 'output', text: clean });
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
    await syncWorkspace(container, vfs);
    onEvent({ type: 'status', text: 'Workspace synced in sandbox.' });

    const managerReady = await ensurePackageManager(parsed.manager, container);
    if (!managerReady.ok) {
        onEvent({
            type: 'error',
            text: `Unable to enable ${parsed.manager}: ${managerReady.error}`,
        });
        onExit({ type: 'exit', exitCode: 1, durationMs: Date.now() - startedAt });
        return;
    }

    const devScript = isDevScript(parsed);
    const timeoutMs = devScript ? MAX_DEV_SERVER_MS : MAX_EXECUTION_MS;

    if (parsed.action === 'run') {
        const hasDependencies = await dependenciesInstalled(container);
        if (!hasDependencies) {
            await ensureDirectory(container, NPM_CACHE_DIR);
            await ensureDirectory(container, YARN_CACHE_DIR);
            await ensureDirectory(container, PNPM_STORE_DIR);
            onEvent({
                type: 'status',
                text: 'Dependencies missing. Installing in sandbox before running the script...',
            });
            const installResult = await runProcessWithStreaming({
                container,
                command: parsed.manager,
                args: getInstallArgs(parsed.manager),
                cwd: WORKSPACE_DIR,
                onEvent,
                signal,
                timeoutMs: MAX_INSTALL_MS,
                env: getInstallEnv(parsed.manager),
            });
            if (installResult.exitCode !== 0) {
                onExit({
                    type: 'exit',
                    exitCode: installResult.exitCode,
                    durationMs: Date.now() - startedAt,
                });
                return;
            }
        }
    }

    const { command: spawnCommand, args } = getSpawnArgs(parsed);
    const result = await runProcessWithStreaming({
        container,
        command: spawnCommand,
        args,
        cwd: WORKSPACE_DIR,
        onEvent: (event) => {
            if (devScript && event.type === 'error' && event.text.startsWith('Execution timed out')) {
                onEvent({
                    type: 'status',
                    text: `Dev server stopped by policy after ${timeoutMs / 1000}s.`,
                });
                return;
            }
            onEvent(event);
        },
        signal,
        timeoutMs,
    });

    const durationMs = Date.now() - startedAt;
    onExit({
        type: 'exit',
        exitCode: result.exitCode,
        durationMs,
    });
}

