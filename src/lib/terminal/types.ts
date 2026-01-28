export type TerminalStreamEvent =
    | { type: 'status'; text: string }
    | { type: 'output'; text: string }
    | { type: 'error'; text: string }
    | { type: 'exit'; exitCode: number; durationMs: number };

export type TerminalAssistKind = 'explain' | 'summarize' | 'fix';

export interface TerminalAssistRequest {
    kind: TerminalAssistKind;
    output: string;
    command?: string;
}

export interface TerminalAssistResponse {
    response: string;
}

export interface TerminalExecuteRequest {
    command: string;
}

