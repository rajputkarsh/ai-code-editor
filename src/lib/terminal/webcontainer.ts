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

import { WebContainer, type FileSystemTree, type WebContainerProcess } from '@webcontainer/api';
import type { VFSNode, VFSStructure } from '@/lib/workspace/types';
import type { TerminalStreamEvent } from './types';

const MAX_EXECUTION_MS = 1200_000;
const MAX_DEV_SERVER_MS = 1200_000;
const MAX_INSTALL_MS = 1200_000;
const DISALLOWED_SHELL_PATTERN = /[;&|`$<>]/;
const WORKSPACE_DIR = '/workspace';
const CACHE_ROOT = '/tmp/webcontainer-cache';
const INITIAL_MOUNT_STAGING_DIR = '/tmp/workspace-initial-mount';
const NPM_CACHE_DIR = `${CACHE_ROOT}/npm`;
const YARN_CACHE_DIR = `${CACHE_ROOT}/yarn`;
const PNPM_STORE_DIR = `${CACHE_ROOT}/pnpm`;
const SNAPSHOT_DB_NAME = 'ai-code-editor-webcontainer';
const SNAPSHOT_STORE_NAME = 'workspace-snapshots';

const ALLOWED_MANAGERS = ['npm', 'yarn', 'pnpm'] as const;
type PackageManager = (typeof ALLOWED_MANAGERS)[number];

type ParsedCommand =
    | { manager: PackageManager; action: 'install'; raw: string }
    | { manager: PackageManager; action: 'run'; scriptName: string; raw: string };

type WebContainerEntry = {
    promise?: Promise<WebContainer>;
    lastSyncedFiles: Set<string>;
    serverListenerAttached?: boolean;
    installPromise?: Promise<number>;
    dependencyState?: {
        manifestHash: string;
        manager: PackageManager;
    };
    snapshotRestoreAttempted?: boolean;
    snapshotRestored?: boolean;
    initialWorkspaceMounted?: boolean;
};

type WorkspaceSnapshotRecord = {
    workspaceId: string;
    snapshot: FileSystemTree;
    dependencyHash: string;
    manager: PackageManager;
    updatedAt: number;
};

declare global {
    // eslint-disable-next-line no-var
    var __webcontainerState:
        | {
              containers: Map<string, WebContainerEntry>;
          }
        | undefined;
}

const getContainerState = (workspaceId: string) => {
    if (!globalThis.__webcontainerState) {
        globalThis.__webcontainerState = {
            containers: new Map(),
        };
    }
    const state = globalThis.__webcontainerState;
    const existing = state.containers.get(workspaceId);
    if (existing) return existing;
    const fresh: WebContainerEntry = { lastSyncedFiles: new Set<string>() };
    state.containers.set(workspaceId, fresh);
    return fresh;
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

        // Keep dependency manifests as normal workspace files so npm ci can run deterministically.
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

async function syncWorkspace(
    container: WebContainer,
    vfs: VFSStructure,
    workspaceId: string
): Promise<void> {
    const state = getContainerState(workspaceId);
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

function findWorkspaceFile(vfs: VFSStructure, targetPath: string): string | null {
    const normalized = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
    const nodes = Object.values(vfs.nodes);
    const target = normalized.replace(/\\/g, '/');
    const fileNode = nodes.find(
        (node) =>
            node.type === 'file' &&
            getNodePath(vfs.nodes, vfs.rootId, node.id).replace(/\\/g, '/') === target
    );
    return fileNode?.content ?? null;
}

function hashString(value: string): string {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

function computeDependencyManifestHash(vfs: VFSStructure): string | null {
    const packageJson = findWorkspaceFile(vfs, '/package.json');
    if (packageJson === null) return null;
    const packageLock = findWorkspaceFile(vfs, '/package-lock.json') ?? '';
    return hashString(`${packageJson}\n---lock---\n${packageLock}`);
}

function workspaceHasPackageLock(vfs: VFSStructure): boolean {
    return findWorkspaceFile(vfs, '/package-lock.json') !== null;
}

async function openSnapshotDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return null;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(SNAPSHOT_DB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
                db.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: 'workspaceId' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open snapshot database.'));
    });
}

async function loadWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshotRecord | null> {
    const db = await openSnapshotDb();
    if (!db) return null;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(SNAPSHOT_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SNAPSHOT_STORE_NAME);
        const request = store.get(workspaceId);

        request.onsuccess = () => {
            const result = request.result as WorkspaceSnapshotRecord | undefined;
            resolve(result ?? null);
        };
        request.onerror = () => reject(request.error ?? new Error('Failed to read workspace snapshot.'));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
        transaction.onabort = () => db.close();
    });
}

async function saveWorkspaceSnapshot(record: WorkspaceSnapshotRecord): Promise<void> {
    const db = await openSnapshotDb();
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(SNAPSHOT_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SNAPSHOT_STORE_NAME);
        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('Failed to save workspace snapshot.'));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
        transaction.onabort = () => db.close();
    });
}

async function restoreWorkspaceSnapshot(
    container: WebContainer,
    state: WebContainerEntry,
    workspaceId: string,
    onEvent?: (event: TerminalStreamEvent) => void
): Promise<boolean> {
    if (state.snapshotRestoreAttempted) {
        return state.snapshotRestored ?? false;
    }
    state.snapshotRestoreAttempted = true;

    try {
        const record = await loadWorkspaceSnapshot(workspaceId);
        if (!record) {
            state.snapshotRestored = false;
            onEvent?.({
                type: 'status',
                text: 'No cached WebContainer snapshot found for this workspace.',
            });
            return false;
        }

        onEvent?.({
            type: 'status',
            text: 'Cached WebContainer snapshot found. Restoring filesystem state...',
        });
        await ensureDirectory(container, WORKSPACE_DIR);
        await container.mount(record.snapshot, { mountPoint: WORKSPACE_DIR });
        state.dependencyState = {
            manifestHash: record.dependencyHash,
            manager: record.manager,
        };
        state.snapshotRestored = true;
        onEvent?.({
            type: 'status',
            text: 'Restored cached WebContainer snapshot for this workspace.',
        });
        return true;
    } catch (error) {
        state.snapshotRestored = false;
        const message = error instanceof Error ? error.message : 'Failed to restore sandbox snapshot.';
        onEvent?.({ type: 'error', text: message });
        return false;
    }
}

async function persistWorkspaceSnapshot(
    container: WebContainer,
    state: WebContainerEntry,
    workspaceId: string,
    onEvent: (event: TerminalStreamEvent) => void
): Promise<void> {
    if (!state.dependencyState) return;

    try {
        const snapshot = await container.export(WORKSPACE_DIR, { format: 'json' });
        await saveWorkspaceSnapshot({
            workspaceId,
            snapshot,
            dependencyHash: state.dependencyState.manifestHash,
            manager: state.dependencyState.manager,
            updatedAt: Date.now(),
        });
        onEvent({
            type: 'status',
            text: 'Updated sandbox snapshot cache after dependency install.',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to persist sandbox snapshot.';
        onEvent({ type: 'error', text: message });
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

async function getWebContainer(
    workspaceId: string,
    onEvent?: (event: TerminalStreamEvent) => void
): Promise<WebContainer> {
    const state = getContainerState(workspaceId);
    if (!state.promise) {
        state.promise = (async () => {
            // Lifecycle decision: one WebContainer instance per workspace for the full browser session.
            const container = await WebContainer.boot();
            await ensureDirectory(container, WORKSPACE_DIR);
            // Boot order is intentional: restore snapshot before any workspace file synchronization.
            await restoreWorkspaceSnapshot(container, state, workspaceId, onEvent);
            const hasNodeModulesAfterRestore = await dependenciesInstalled(container);
            onEvent?.({
                type: 'status',
                text: `node_modules after snapshot restore: ${hasNodeModulesAfterRestore ? 'present' : 'missing'}.`,
            });
            return container;
        })().catch((error) => {
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

function getInstallArgs(manager: PackageManager, hasPackageLock: boolean): string[] {
    if (manager === 'npm') {
        if (hasPackageLock) {
            return ['ci', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund'];
        }
        return ['install', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund'];
    }
    // yarn and pnpm don't have exact --ignore-scripts equivalent, but we can try
    if (manager === 'yarn') {
        return ['install', '--prefer-offline', '--ignore-scripts'];
    }
    if (manager === 'pnpm') {
        return ['install', '--prefer-offline', '--ignore-scripts'];
    }
    return ['install', '--prefer-offline'];
}

function buildWorkspaceMountTree(vfs: VFSStructure): FileSystemTree {
    const tree: Record<string, unknown> = {};
    const { files, directories } = collectWorkspaceEntries(vfs);

    const ensureDirectoryNode = (parts: string[]): Record<string, unknown> => {
        let cursor: Record<string, unknown> = tree;
        for (const part of parts) {
            const existing = cursor[part] as { directory?: Record<string, unknown> } | undefined;
            if (existing?.directory) {
                cursor = existing.directory;
                continue;
            }
            const next = { directory: {} as Record<string, unknown> };
            cursor[part] = next;
            cursor = next.directory;
        }
        return cursor;
    };

    for (const directoryPath of directories) {
        if (directoryPath === WORKSPACE_DIR) continue;
        const relativePath = directoryPath.replace(`${WORKSPACE_DIR}/`, '');
        if (!relativePath || relativePath === directoryPath) continue;
        const parts = relativePath.split('/').filter(Boolean);
        ensureDirectoryNode(parts);
    }

    for (const [filePath, contents] of files) {
        const relativePath = filePath.replace(`${WORKSPACE_DIR}/`, '');
        if (!relativePath || relativePath === filePath) continue;
        const parts = relativePath.split('/').filter(Boolean);
        const fileName = parts.pop();
        if (!fileName) continue;
        const parent = ensureDirectoryNode(parts);
        parent[fileName] = { file: { contents } };
    }

    return tree as FileSystemTree;
}

async function mountInitialWorkspaceIfNeeded(options: {
    container: WebContainer;
    state: WebContainerEntry;
    vfs: VFSStructure;
    workspaceId: string;
    onEvent: (event: TerminalStreamEvent) => void;
}): Promise<void> {
    const { container, state, vfs, workspaceId, onEvent } = options;
    if (state.snapshotRestored) return;
    if (state.initialWorkspaceMounted) return;

    // Never mount directly at /workspace during initialization; stage mount then merge files.
    const mountTree = buildWorkspaceMountTree(vfs);
    await ensureDirectory(container, INITIAL_MOUNT_STAGING_DIR);
    await container.mount(mountTree, { mountPoint: INITIAL_MOUNT_STAGING_DIR });
    const { files } = collectWorkspaceEntries(vfs);
    state.lastSyncedFiles = new Set(files.keys());
    state.initialWorkspaceMounted = true;
    onEvent({
        type: 'status',
        text: `No snapshot restore available. Mounted workspace to staging for ${workspaceId} and merging files.`,
    });
    await container.fs.rm(INITIAL_MOUNT_STAGING_DIR, { recursive: true, force: true });
}

async function ensureDependenciesReady(options: {
    container: WebContainer;
    state: WebContainerEntry;
    workspaceId: string;
    manager: PackageManager;
    vfs: VFSStructure;
    onEvent: (event: TerminalStreamEvent) => void;
    signal?: AbortSignal;
}): Promise<{ ok: true } | { ok: false; exitCode: number }> {
    const { container, state, workspaceId, manager, vfs, onEvent, signal } = options;
    const manifestHash = computeDependencyManifestHash(vfs);
    if (!manifestHash) return { ok: true };

    const hasPackageLock = workspaceHasPackageLock(vfs);
    const hasNodeModules = await dependenciesInstalled(container);
    onEvent({
        type: 'status',
        text: `Dependency check: node_modules is ${hasNodeModules ? 'present' : 'missing'}.`,
    });
    const manifestChanged =
        state.dependencyState?.manifestHash !== undefined &&
        state.dependencyState.manifestHash !== manifestHash;
    if (manifestChanged) {
        onEvent({
            type: 'status',
            text: 'Dependency check: package.json/package-lock.json changed since last install.',
        });
    }

    if (hasNodeModules && !manifestChanged) {
        if (!state.dependencyState) {
            state.dependencyState = { manifestHash, manager };
        }
        onEvent({
            type: 'status',
            text: 'Dependency install skipped: cached node_modules is valid.',
        });
        return { ok: true };
    }

    if (state.installPromise) {
        onEvent({
            type: 'status',
            text: 'Dependency install already in progress for this workspace. Waiting for completion...',
        });
        const exitCode = await state.installPromise;
        return exitCode === 0 ? { ok: true } : { ok: false, exitCode };
    }

    const installReason = !hasNodeModules
        ? 'Dependencies missing in WebContainer. Installing once for this workspace...'
        : 'Dependency manifests changed. Reinstalling dependencies...';

    state.installPromise = (async () => {
        await ensureDirectory(container, NPM_CACHE_DIR);
        await ensureDirectory(container, YARN_CACHE_DIR);
        await ensureDirectory(container, PNPM_STORE_DIR);

        if (manager === 'npm' && !hasPackageLock) {
            onEvent({
                type: 'status',
                text: 'package-lock.json not found. Falling back to npm install for this run.',
            });
        }

        onEvent({ type: 'status', text: installReason });
        let installResult = await runProcessWithStreaming({
            container,
            command: manager,
            args: getInstallArgs(manager, hasPackageLock),
            cwd: WORKSPACE_DIR,
            onEvent,
            signal,
            timeoutMs: MAX_INSTALL_MS,
            env: getInstallEnv(manager),
        });

        // If lockfile is stale/corrupt, fall back to npm install so preview can still boot.
        if (manager === 'npm' && hasPackageLock && installResult.exitCode !== 0) {
            onEvent({
                type: 'status',
                text: 'npm ci failed. Falling back to npm install for recovery.',
            });
            installResult = await runProcessWithStreaming({
                container,
                command: manager,
                args: getInstallArgs(manager, false),
                cwd: WORKSPACE_DIR,
                onEvent,
                signal,
                timeoutMs: MAX_INSTALL_MS,
                env: getInstallEnv(manager),
            });
        }

        if (installResult.exitCode === 0) {
            state.dependencyState = { manifestHash, manager };
            await persistWorkspaceSnapshot(container, state, workspaceId, onEvent);
        }

        return installResult.exitCode;
    })().finally(() => {
        state.installPromise = undefined;
    });

    const exitCode = await state.installPromise;
    return exitCode === 0 ? { ok: true } : { ok: false, exitCode };
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

function getRunEnv(isDev: boolean, port?: number): Record<string, string> | undefined {
    if (!isDev) return undefined;
    return {
        NEXT_DISABLE_TURBOPACK: '1',
        NEXT_DISABLE_SWC: '1',
        NEXT_TELEMETRY_DISABLED: '1',
        BROWSER: 'none',
        PORT: port ? String(port) : '3001',
        HOSTNAME: '0.0.0.0',
    };
}

function pickRandomPort(): number {
    const min = 41000;
    const max = 49000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ensureServerListener(
    container: WebContainer,
    state: WebContainerEntry,
    onEvent: (event: TerminalStreamEvent) => void
) {
    if (state.serverListenerAttached) return;
    container.on('server-ready', (port, url) => {
        onEvent({
            type: 'status',
            text: `Server ready on port ${port}. Open: ${url}`,
        });
    });
    state.serverListenerAttached = true;
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
    workspaceId?: string;
}): Promise<void> {
    const { command, vfs, onEvent, onExit, signal, workspaceId } = options;
    const resolvedWorkspaceId = workspaceId ?? 'default';
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

    const containerState = getContainerState(resolvedWorkspaceId);
    const container = await getWebContainer(resolvedWorkspaceId, onEvent);

    onEvent({ type: 'status', text: 'Booting sandboxed environment...' });
    if (containerState.snapshotRestored) {
        // Snapshot path: merge only changed files to avoid touching restored node_modules.
        await syncWorkspace(container, vfs, resolvedWorkspaceId);
        onEvent({
            type: 'status',
            text: 'Snapshot restore active. Merged workspace file changes without remounting root.',
        });
    } else {
        await mountInitialWorkspaceIfNeeded({
            container,
            state: containerState,
            vfs,
            workspaceId: resolvedWorkspaceId,
            onEvent,
        });
        await syncWorkspace(container, vfs, resolvedWorkspaceId);
        onEvent({
            type: 'status',
            text: 'Workspace synced in sandbox.',
        });
    }

    ensureServerListener(container, containerState, onEvent);

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
        const dependencyResult = await ensureDependenciesReady({
            container,
            state: containerState,
            workspaceId: resolvedWorkspaceId,
            manager: parsed.manager,
            vfs,
            onEvent,
            signal,
        });
        if (!dependencyResult.ok) {
            onExit({
                type: 'exit',
                exitCode: dependencyResult.exitCode,
                durationMs: Date.now() - startedAt,
            });
            return;
        }
    }

    const { command: spawnCommand, args } = getSpawnArgs(parsed);
    const runPort = devScript ? pickRandomPort() : undefined;
    if (runPort) {
        onEvent({
            type: 'status',
            text: `Starting dev server on port ${runPort}.`,
        });
    }

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
        env: getRunEnv(devScript, runPort),
    });

    const durationMs = Date.now() - startedAt;
    onExit({
        type: 'exit',
        exitCode: result.exitCode,
        durationMs,
    });
}

/**
 * Sync the latest workspace VFS into an existing WebContainer instance.
 * Used by preview to keep long-running dev servers in sync with editor changes.
 */
export async function syncWorkspaceToWebContainer(options: {
    vfs: VFSStructure;
    workspaceId?: string;
    onEvent?: (event: TerminalStreamEvent) => void;
}): Promise<void> {
    const { vfs, workspaceId, onEvent } = options;
    const resolvedWorkspaceId = workspaceId ?? 'default';
    const state = getContainerState(resolvedWorkspaceId);
    const container = await getWebContainer(resolvedWorkspaceId, onEvent);

    if (!state.snapshotRestored) {
        await mountInitialWorkspaceIfNeeded({
            container,
            state,
            vfs,
            workspaceId: resolvedWorkspaceId,
            onEvent: onEvent ?? (() => {}),
        });
    }

    await syncWorkspace(container, vfs, resolvedWorkspaceId);
}
