/**
 * Client helpers for the terminal experience.
 *
 * Separation of concerns:
 * - UI only triggers explicit user actions.
 * - Execution stays server-side inside the sandbox (no host access).
 * - AI assistance is read-only and never runs commands.
 */

import type {
    TerminalAssistRequest,
    TerminalAssistResponse,
    TerminalStreamEvent,
} from './types';

interface StreamTerminalExecutionOptions {
    command: string;
    onEvent: (event: TerminalStreamEvent) => void;
    onDone?: () => void;
    signal?: AbortSignal;
}

const TERMINAL_EXECUTE_ENDPOINT = '/api/terminal/execute';
const TERMINAL_ASSIST_ENDPOINT = '/api/terminal/assist';

function parseSseChunk(
    chunk: string,
    onEvent: (event: TerminalStreamEvent) => void,
    onDone?: () => void
): boolean {
    const lines = chunk.split('\n');
    for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.replace(/^data:\s?/, '').trim();
        if (!data) continue;
        if (data === '[DONE]') {
            onDone?.();
            return true;
        }
        const event = JSON.parse(data) as TerminalStreamEvent;
        onEvent(event);
    }
    return false;
}

export async function streamTerminalExecution({
    command,
    onEvent,
    onDone,
    signal,
}: StreamTerminalExecutionOptions): Promise<void> {
    const response = await fetch(TERMINAL_EXECUTE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
        signal,
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to start terminal command.');
    }

    if (!response.body) {
        throw new Error('Terminal stream is unavailable.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });

        let delimiterIndex = buffer.indexOf('\n\n');
        while (delimiterIndex !== -1) {
            const chunk = buffer.slice(0, delimiterIndex).trim();
            buffer = buffer.slice(delimiterIndex + 2);
            if (chunk) {
                const isDone = parseSseChunk(chunk, onEvent, onDone);
                if (isDone) return;
            }
            delimiterIndex = buffer.indexOf('\n\n');
        }
    }

    if (buffer.trim()) {
        parseSseChunk(buffer.trim(), onEvent, onDone);
    } else {
        onDone?.();
    }
}

export async function requestTerminalAssist(
    payload: TerminalAssistRequest
): Promise<TerminalAssistResponse> {
    const response = await fetch(TERMINAL_ASSIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to fetch AI assistance.');
    }

    return (await response.json()) as TerminalAssistResponse;
}

