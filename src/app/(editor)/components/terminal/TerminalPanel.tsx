'use client';

/**
 * TerminalPanel
 *
 * Session-scoped terminal output. Commands are executed in a server-side sandbox
 * with strict limits (timeout, no daemons, workspace-only access).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Square, Sparkles, Trash2, Terminal as TerminalIcon, X } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useWorkspace } from '../../stores/workspace-provider';
import type { TerminalAssistKind, TerminalStreamEvent } from '@/lib/terminal/types';
import { requestTerminalAssist } from '@/lib/terminal/client';
import { runTerminalCommand } from '@/lib/terminal/webcontainer';

interface TerminalPanelProps {
    onClose: () => void;
}

type TerminalLine = {
    id: string;
    type: TerminalStreamEvent['type'];
    text: string;
    timestamp: number;
};

const quickCommands = [
    { label: 'npm install', command: 'npm install' },
    { label: 'npm run dev', command: 'npm run dev' },
    { label: 'npm run build', command: 'npm run build' },
] as const;

const formatExitLine = (exitCode: number, durationMs: number) =>
    `Process exited with code ${exitCode} after ${Math.max(durationMs, 0)}ms.`;

const getLineColor = (type: TerminalLine['type']) => {
    if (type === 'error') return 'text-red-400';
    if (type === 'status') return 'text-blue-300';
    if (type === 'exit') return 'text-yellow-300';
    return 'text-neutral-100';
};

export function TerminalPanel({ onClose }: TerminalPanelProps) {
    const [command, setCommand] = useState('');
    const [lines, setLines] = useState<TerminalLine[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isAssisting, setIsAssisting] = useState(false);
    const [lastCommand, setLastCommand] = useState<string | null>(null);
    const [assistResponse, setAssistResponse] = useState<{
        kind: TerminalAssistKind;
        response: string;
    } | null>(null);

    const { vfs, activeWorkspaceId } = useWorkspace();
    const outputRef = useRef<HTMLDivElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
    const toast = useToast();
    const [panelHeight, setPanelHeight] = useState(256);

    const MIN_HEIGHT = 160;
    const MAX_HEIGHT = 720;

    useEffect(() => {
        if (!outputRef.current) return;
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }, [lines]);

    const updateHeight = (clientY: number) => {
        if (!resizeStateRef.current) return;
        const delta = resizeStateRef.current.startY - clientY;
        const nextHeight = Math.min(
            MAX_HEIGHT,
            Math.max(MIN_HEIGHT, resizeStateRef.current.startHeight + delta)
        );
        setPanelHeight(nextHeight);
    };

    const stopResize = () => {
        if (!resizeStateRef.current) return;
        resizeStateRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => updateHeight(event.clientY);
        const handlePointerUp = () => stopResize();
        const handleMouseMove = (event: MouseEvent) => updateHeight(event.clientY);
        const handleMouseUp = () => stopResize();

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const combinedOutput = useMemo(
        () => lines.map((line) => line.text).join('\n'),
        [lines]
    );

    const appendLine = (line: TerminalLine) => {
        setLines((prev) => [...prev, line]);
    };

    const handleEvent = (event: TerminalStreamEvent) => {
        if (event.type === 'exit') {
            appendLine({
                id: crypto.randomUUID(),
                type: 'exit',
                text: formatExitLine(event.exitCode, event.durationMs),
                timestamp: Date.now(),
            });
            return;
        }

        appendLine({
            id: crypto.randomUUID(),
            type: event.type,
            text: event.text,
            timestamp: Date.now(),
        });
    };

    const handleRun = async () => {
        const trimmed = command.trim();
        if (!trimmed) {
            toast.warning('Enter a command to run.');
            return;
        }
        if (!vfs) {
            toast.error('Workspace is not ready yet.');
            return;
        }
        if (isRunning) {
            toast.info('A command is already running.');
            return;
        }

        setIsRunning(true);
        setAssistResponse(null);
        setLastCommand(trimmed);

        const controller = new AbortController();
        abortRef.current = controller;

        appendLine({
            id: crypto.randomUUID(),
            type: 'status',
            text: `$ ${trimmed}`,
            timestamp: Date.now(),
        });

        try {
            await runTerminalCommand({
                command: trimmed,
                vfs: vfs.getStructure(),
                onEvent: handleEvent,
                onExit: (event) => {
                    handleEvent(event);
                    setIsRunning(false);
                },
                signal: controller.signal,
                workspaceId: activeWorkspaceId ?? undefined,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Terminal execution failed.';

            appendLine({
                id: crypto.randomUUID(),
                type: 'error',
                text: controller.signal.aborted
                    ? 'Execution cancelled by user.'
                    : message,
                timestamp: Date.now(),
            });
            setIsRunning(false);
        } finally {
            abortRef.current = null;
        }
    };

    const handleStop = () => {
        abortRef.current?.abort();
    };

    const handleClear = () => {
        setLines([]);
        setAssistResponse(null);
    };

    const handleAssist = async (kind: TerminalAssistKind) => {
        if (!combinedOutput.trim()) {
            toast.warning('Run a command to generate output first.');
            return;
        }
        if (isAssisting) return;

        setIsAssisting(true);
        try {
            const response = await requestTerminalAssist({
                kind,
                output: combinedOutput,
                command: lastCommand ?? undefined,
            });
            setAssistResponse({ kind, response: response.response });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to fetch AI assistance.';
            toast.error(message);
        } finally {
            setIsAssisting(false);
        }
    };

    return (
        <div
            className="flex flex-col border-t border-neutral-800 bg-[#0f0f0f] flex-none"
            style={{ height: panelHeight }}
        >
            <div
                className="h-3 bg-neutral-800 cursor-row-resize hover:bg-neutral-700"
                onPointerDown={(event) => {
                    resizeStateRef.current = {
                        startY: event.clientY,
                        startHeight: panelHeight,
                    };
                    document.body.style.cursor = 'row-resize';
                    document.body.style.userSelect = 'none';
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onMouseDown={(event) => {
                    resizeStateRef.current = {
                        startY: event.clientY,
                        startHeight: panelHeight,
                    };
                    document.body.style.cursor = 'row-resize';
                    document.body.style.userSelect = 'none';
                }}
                style={{ touchAction: 'none' }}
                title="Drag to resize terminal"
            />
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 text-xs text-neutral-400">
                <div className="flex items-center gap-2">
                    <TerminalIcon className="w-3 h-3" />
                    <span className="font-semibold text-neutral-200">Terminal (Sandboxed)</span>
                    <span className="text-[11px] text-neutral-500">
                        10s timeout · workspace-only · no host access
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleAssist('explain')}
                        className="px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 disabled:opacity-50"
                        disabled={isAssisting}
                        title="Explain failure"
                    >
                        <Sparkles className="inline-block w-3 h-3 mr-1" />
                        Explain
                    </button>
                    <button
                        onClick={() => handleAssist('summarize')}
                        className="px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 disabled:opacity-50"
                        disabled={isAssisting}
                        title="Summarize output"
                    >
                        Summarize
                    </button>
                    <button
                        onClick={() => handleAssist('fix')}
                        className="px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 disabled:opacity-50"
                        disabled={isAssisting}
                        title="Suggest fixes"
                    >
                        Fix
                    </button>
                    <div className="w-px h-4 bg-neutral-700" />
                    <button
                        onClick={handleClear}
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
                        title="Clear output"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800"
                        title="Close terminal"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>

            <div ref={outputRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
                {lines.length === 0 ? (
                    <div className="text-neutral-500">
                        Run a script to see output here. Supported: npm / yarn / pnpm.
                    </div>
                ) : (
                    lines.map((line) => (
                        <div key={line.id} className={getLineColor(line.type)}>
                            {line.text}
                        </div>
                    ))
                )}
                {assistResponse && (
                    <div className="mt-3 border border-neutral-700 rounded bg-[#141414] p-3 text-neutral-200">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-2">
                            AI {assistResponse.kind}
                        </div>
                        <div className="whitespace-pre-wrap">{assistResponse.response}</div>
                    </div>
                )}
            </div>

            <div className="border-t border-neutral-800 p-3 space-y-2">
                <div className="flex items-center gap-2">
                    <input
                        value={command}
                        onChange={(event) => setCommand(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                void handleRun();
                            }
                        }}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-blue-600"
                        placeholder="npm run dev"
                        disabled={isRunning}
                    />
                    <button
                        onClick={() => void handleRun()}
                        className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-500 disabled:opacity-50"
                        disabled={isRunning}
                    >
                        <Play className="w-3 h-3 inline-block mr-1" />
                        Run
                    </button>
                    <button
                        onClick={handleStop}
                        className="px-3 py-1 rounded border border-neutral-700 text-neutral-200 text-xs hover:border-neutral-500 disabled:opacity-50"
                        disabled={!isRunning}
                    >
                        <Square className="w-3 h-3 inline-block mr-1" />
                        Stop
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-neutral-400">
                    {quickCommands.map((entry) => (
                        <button
                            key={entry.command}
                            onClick={() => setCommand(entry.command)}
                            className="px-2 py-1 rounded border border-neutral-800 hover:border-neutral-600 hover:text-neutral-200"
                            disabled={isRunning}
                        >
                            {entry.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

