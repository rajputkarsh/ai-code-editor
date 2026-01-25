/**
 * Autosave Module (Phase 1.6)
 * 
 * This module provides enhanced autosave functionality with:
 * - Debounced saves to prevent excessive API calls
 * - Event-driven triggers for file changes, tab changes, and layout changes
 * - Non-blocking UI during saves
 * - Resilient error handling
 * - Last-known-good state tracking
 * 
 * Autosave Strategy (Phase 1.6):
 * - Trigger on: file edits, file create/rename/delete, tab changes, layout changes
 * - Debounce delay: 2 seconds (configurable)
 * - Never block typing or UI interactions
 * - Retry on transient failures
 * - Silent operation (no user prompts)
 */

import type { VFSStructure, EditorState } from '../types';

/**
 * Autosave configuration
 */
export interface AutosaveConfig {
  /** Debounce delay in milliseconds (default: 2000ms) */
  debounceMs: number;
  
  /** Maximum retry attempts on failure (default: 3) */
  maxRetries: number;
  
  /** Retry delay in milliseconds (default: 1000ms) */
  retryDelayMs: number;
  
  /** Enable verbose logging (default: false) */
  verbose: boolean;
}

/**
 * Default autosave configuration
 */
export const DEFAULT_AUTOSAVE_CONFIG: AutosaveConfig = {
  debounceMs: 2000,
  maxRetries: 3,
  retryDelayMs: 1000,
  verbose: false,
};

/**
 * Autosave event types
 * 
 * These events trigger autosave:
 * - FILE_CONTENT_CHANGED: File content was edited
 * - FILE_CREATED: New file was created
 * - FILE_RENAMED: File was renamed
 * - FILE_DELETED: File was deleted
 * - TAB_CHANGED: Active tab changed
 * - LAYOUT_CHANGED: Editor layout changed (split view toggled)
 */
export type AutosaveEventType =
  | 'FILE_CONTENT_CHANGED'
  | 'FILE_CREATED'
  | 'FILE_RENAMED'
  | 'FILE_DELETED'
  | 'TAB_CHANGED'
  | 'LAYOUT_CHANGED';

/**
 * Autosave event
 */
export interface AutosaveEvent {
  type: AutosaveEventType;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Autosave callback function
 * 
 * This function is called when autosave is triggered.
 * It should save the current workspace state to the server.
 * 
 * @param vfs - Current VFS structure
 * @param editorState - Current editor state
 * @returns Promise that resolves when save is complete
 */
export type AutosaveCallback = (
  vfs: VFSStructure,
  editorState?: EditorState
) => Promise<void>;

/**
 * Autosave manager
 * 
 * Manages autosave lifecycle:
 * - Debounces save requests
 * - Tracks save state (idle, pending, saving)
 * - Handles retries on failure
 * - Provides status information
 */
/**
 * Autosave state
 */
export type AutosaveState = 'idle' | 'pending' | 'saving' | 'synced';

export class AutosaveManager {
  private config: AutosaveConfig;
  private callback: AutosaveCallback;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isSaving = false;
  private isPending = false;
  private lastSaveTimestamp = 0;
  private retryCount = 0;
  private lastError: Error | null = null;
  private stateChangeCallback: ((state: AutosaveState) => void) | null = null;

  constructor(callback: AutosaveCallback, config: Partial<AutosaveConfig> = {}) {
    this.callback = callback;
    this.config = { ...DEFAULT_AUTOSAVE_CONFIG, ...config };
  }

  /**
   * Register a callback to be notified of state changes
   */
  onStateChange(callback: (state: AutosaveState) => void): void {
    this.stateChangeCallback = callback;
  }

  /**
   * Get current autosave state
   */
  getState(): AutosaveState {
    if (this.isSaving) return 'saving';
    if (this.isPending) return 'pending';
    if (this.lastSaveTimestamp > 0) return 'synced';
    return 'idle';
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.getState());
    }
  }

  /**
   * Trigger autosave
   * 
   * This method is called whenever an autosave event occurs.
   * It debounces the actual save operation.
   * 
   * @param event - Autosave event
   * @param vfs - Current VFS structure
   * @param editorState - Current editor state
   */
  trigger(event: AutosaveEvent, vfs: VFSStructure, editorState?: EditorState): void {
    if (this.config.verbose) {
      console.log('[Autosave] Triggered:', event.type);
    }

    // Mark as pending
    this.isPending = true;
    this.notifyStateChange();

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounced timer
    this.debounceTimer = setTimeout(() => {
      this.executeSave(vfs, editorState);
    }, this.config.debounceMs);
  }

  /**
   * Execute save operation
   * 
   * Internal method that performs the actual save.
   * Handles retries and error tracking.
   */
  private async executeSave(vfs: VFSStructure, editorState?: EditorState): Promise<void> {
    if (this.isSaving) {
      if (this.config.verbose) {
        console.log('[Autosave] Already saving, skipping...');
      }
      return;
    }

    this.isSaving = true;
    this.isPending = false;
    this.notifyStateChange();

    try {
      await this.callback(vfs, editorState);
      
      // Save successful
      this.lastSaveTimestamp = Date.now();
      this.retryCount = 0;
      this.lastError = null;
      this.notifyStateChange();

      if (this.config.verbose) {
        console.log('[Autosave] Save successful');
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error('Unknown error');
      
      console.error('[Autosave] Save failed:', error);

      // Retry logic
      if (this.retryCount < this.config.maxRetries) {
        this.retryCount++;
        
        if (this.config.verbose) {
          console.log(`[Autosave] Retrying (${this.retryCount}/${this.config.maxRetries})...`);
        }

        // Schedule retry
        setTimeout(() => {
          this.isSaving = false;
          this.executeSave(vfs, editorState);
        }, this.config.retryDelayMs);

        return;
      } else {
        console.error('[Autosave] Max retries reached, giving up');
      }
    } finally {
      this.isSaving = false;
      this.notifyStateChange();
    }
  }

  /**
   * Force immediate save
   * 
   * Bypasses debounce and saves immediately.
   * Useful for explicit save actions (e.g., Cmd+S).
   * 
   * @param vfs - Current VFS structure
   * @param editorState - Current editor state
   */
  async forceSave(vfs: VFSStructure, editorState?: EditorState): Promise<void> {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Wait for any ongoing save to complete
    while (this.isSaving) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Execute save immediately
    await this.executeSave(vfs, editorState);
  }

  /**
   * Get autosave status
   */
  getStatus() {
    return {
      isSaving: this.isSaving,
      isPending: this.isPending,
      lastSaveTimestamp: this.lastSaveTimestamp,
      lastError: this.lastError,
      retryCount: this.retryCount,
    };
  }

  /**
   * Cancel pending autosave
   */
  cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isPending = false;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cancel();
  }
}

/**
 * Create an autosave manager instance
 * 
 * @param callback - Function to call when autosave is triggered
 * @param config - Optional configuration overrides
 * @returns AutosaveManager instance
 */
export function createAutosaveManager(
  callback: AutosaveCallback,
  config?: Partial<AutosaveConfig>
): AutosaveManager {
  return new AutosaveManager(callback, config);
}

