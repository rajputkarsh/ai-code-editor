/**
 * Sandboxed terminal execution (server-side simulation).
 *
 * Sandbox strategy:
 * - Never touches the host filesystem or process environment.
 * - Operates only on the persisted workspace VFS snapshot.
 * - Whitelists commands and rejects chaining or shell operators.
 *
 * Execution limits:
 * - Hard max execution time.
 * - Max output lines and command length.
 *
 * Security trade-offs:
 * - This is a deterministic simulator, not a real shell.
 * - It prioritizes safety and predictability over fidelity.
 */

import type { VFSStructure, VFSNode } from '@/lib/workspace/types';
import type { TerminalStreamEvent } from './types';

const MAX_COMMAND_LENGTH = 200;
const MAX_OUTPUT_LINES = 200;
const MAX_EXECUTION_MS = 10_000;

const DISALLOWED_SHELL_PATTERN = /[;&|`$<>]/;

const ALLOWED_MANAGERS = ['npm', 'yarn', 'pnpm'] as const;
type PackageManager = (typeof ALLOWED_MANAGERS)[number];

type ParsedCommand =
    | {
          manager: PackageManager;
          action: 'install';
          raw: string;
      }
    | {
          manager: PackageManager;
          action: 'run';
          scriptName: string;
          raw: string;
      };

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

function findNodeByPath(vfs: VFSStructure, targetPath: string): VFSNode | null {
    const entries = Object.values(vfs.nodes);
    for (const node of entries) {
        if (node.type !== 'file') continue;
        const path = getNodePath(vfs.nodes, vfs.rootId, node.id);
        if (path === targetPath) {
            return node;
        }
    }
    return null;
}

function parseTerminalCommand(command: string): { parsed?: ParsedCommand; error?: string } {
    const trimmed = command.trim();
    if (!trimmed) return { error: 'Command cannot be empty.' };
    if (trimmed.length > MAX_COMMAND_LENGTH) {
        return { error: `Command exceeds ${MAX_COMMAND_LENGTH} characters.` };
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

    // npm supports implicit script via "npm run <script>", but yarn/pnpm allow direct scripts.
    return { parsed: { manager, action: 'run', scriptName: action, raw: trimmed } };
}

function loadPackageScripts(vfs: VFSStructure): { scripts?: Record<string, string>; error?: string } {
    const node = findNodeByPath(vfs, '/package.json');
    if (!node || !node.content) {
        return { error: 'package.json not found in workspace root.' };
    }

    try {
        const parsed = JSON.parse(node.content) as { scripts?: Record<string, string> };
        return { scripts: parsed.scripts ?? {} };
    } catch {
        return { error: 'package.json is not valid JSON.' };
    }
}

function pushLine(lines: TerminalStreamEvent[], event: TerminalStreamEvent, lineCount: { value: number }) {
    if (event.type === 'output' || event.type === 'status' || event.type === 'error') {
        lineCount.value += 1;
    }
    if (lineCount.value > MAX_OUTPUT_LINES) return;
    lines.push(event);
}

export async function* runSandboxedCommand(
    command: string,
    vfs: VFSStructure
): AsyncGenerator<TerminalStreamEvent> {
    const startTime = Date.now();
    const { parsed, error } = parseTerminalCommand(command);

    if (error || !parsed) {
        yield { type: 'error', text: error ?? 'Invalid command.' };
        yield { type: 'exit', exitCode: 1, durationMs: Date.now() - startTime };
        return;
    }

    const lineCount = { value: 0 };
    const events: TerminalStreamEvent[] = [];

    pushLine(events, { type: 'status', text: 'Sandboxed execution started.' }, lineCount);
    pushLine(events, { type: 'status', text: 'Workspace-scoped, no host access.' }, lineCount);

    const elapsed = () => Date.now() - startTime;

    const enforceTimeout = (): TerminalStreamEvent | null => {
        if (elapsed() > MAX_EXECUTION_MS) {
            return {
                type: 'error',
                text: `Execution timed out after ${MAX_EXECUTION_MS / 1000}s.`,
            };
        }
        return null;
    };

    const { scripts, error: scriptError } = loadPackageScripts(vfs);
    if (scriptError) {
        pushLine(events, { type: 'error', text: scriptError }, lineCount);
        for (const event of events) {
            yield event;
        }
        yield { type: 'exit', exitCode: 1, durationMs: elapsed() };
        return;
    }

    if (!scripts) {
        pushLine(events, { type: 'error', text: 'No scripts found in package.json.' }, lineCount);
        for (const event of events) {
            yield event;
        }
        yield { type: 'exit', exitCode: 1, durationMs: elapsed() };
        return;
    }

    if (parsed.action === 'install') {
        pushLine(events, { type: 'output', text: `${parsed.manager} install (sandboxed)` }, lineCount);
        pushLine(events, { type: 'output', text: 'Resolving packages...' }, lineCount);
        pushLine(events, { type: 'output', text: 'Installing dependencies (simulated, no network).' }, lineCount);
        pushLine(events, { type: 'output', text: 'Done in 1.2s.' }, lineCount);
    } else {
        const script = scripts[parsed.scriptName];
        if (!script) {
            pushLine(
                events,
                {
                    type: 'error',
                    text: `Script "${parsed.scriptName}" not found in package.json.`,
                },
                lineCount
            );
            for (const event of events) {
                yield event;
            }
            yield { type: 'exit', exitCode: 1, durationMs: elapsed() };
            return;
        }

        pushLine(events, { type: 'output', text: `> ${parsed.scriptName}` }, lineCount);
        pushLine(events, { type: 'output', text: `$ ${script}` }, lineCount);

        if (parsed.scriptName === 'dev' || parsed.scriptName === 'start') {
            pushLine(events, { type: 'status', text: 'Starting dev server (sandboxed)...' }, lineCount);
            pushLine(
                events,
                {
                    type: 'status',
                    text: 'Dev servers are auto-terminated to avoid long-running daemons.',
                },
                lineCount
            );
            pushLine(events, { type: 'output', text: 'Dev server stopped by policy.' }, lineCount);
        } else {
            pushLine(events, { type: 'output', text: 'Executing script...' }, lineCount);
            pushLine(events, { type: 'output', text: 'Script completed successfully.' }, lineCount);
        }
    }

    for (const event of events) {
        const timeoutEvent = enforceTimeout();
        if (timeoutEvent) {
            yield timeoutEvent;
            yield { type: 'exit', exitCode: 124, durationMs: elapsed() };
            return;
        }
        yield event;
        await delay(80);
    }

    const exitCode =
        parsed.action === 'run' && (parsed.scriptName === 'dev' || parsed.scriptName === 'start')
            ? 124
            : 0;

    yield { type: 'exit', exitCode, durationMs: elapsed() };
}

