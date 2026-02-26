'use client';

export const CLIENT_AI_TASK_TYPES = ['chat', 'inline_completion', 'agent_mode'] as const;
export type ClientAITaskType = (typeof CLIENT_AI_TASK_TYPES)[number];

export const CLIENT_MODEL_IDS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;
export type ClientModelId = (typeof CLIENT_MODEL_IDS)[number];

const STORAGE_KEY = 'ai-platform-model-preferences-v1';

type PreferenceMap = Record<ClientAITaskType, ClientModelId>;

const DEFAULT_PREFERENCES: PreferenceMap = {
  chat: 'gemini-2.5-flash',
  inline_completion: 'gemini-2.5-flash',
  agent_mode: 'gemini-2.5-flash',
};

function isModelId(value: string): value is ClientModelId {
  return (CLIENT_MODEL_IDS as readonly string[]).includes(value);
}

function isTaskType(value: string): value is ClientAITaskType {
  return (CLIENT_AI_TASK_TYPES as readonly string[]).includes(value);
}

export function getClientModelPreferences(): PreferenceMap {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PREFERENCES };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_PREFERENCES };

  try {
    const parsed = JSON.parse(raw) as Partial<Record<string, string>>;
    const merged = { ...DEFAULT_PREFERENCES };

    Object.entries(parsed).forEach(([taskType, model]) => {
      if (isTaskType(taskType) && typeof model === 'string' && isModelId(model)) {
        merged[taskType] = model;
      }
    });

    return merged;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function getClientModelPreference(taskType: ClientAITaskType): ClientModelId {
  const all = getClientModelPreferences();
  return all[taskType];
}

export function setClientModelPreference(taskType: ClientAITaskType, model: ClientModelId): void {
  if (typeof window === 'undefined') return;
  const current = getClientModelPreferences();
  const next = { ...current, [taskType]: model };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent('ai-platform:model-preference-changed', {
      detail: { taskType, model, preferences: next },
    })
  );
}
