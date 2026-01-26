/**
 * Workspace Serialization Utilities
 * 
 * Handles conversion between runtime Workspace objects and database-storable formats.
 * 
 * Key responsibilities:
 * - Serialize complex types (Date, VFSStructure) to JSON-compatible formats
 * - Deserialize database records back to runtime types
 * - Validate data integrity during conversion
 */

import { Workspace, SerializedWorkspace, VFSStructure, EditorState } from '../types';

function sanitizeJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '\\u0000');
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      acc[key] = sanitizeJsonValue(entryValue);
      return acc;
    }, {});
  }

  return value;
}

/**
 * Serialize a Workspace for database storage
 * 
 * Converts runtime types to JSON-serializable format:
 * - Date objects → ISO strings
 * - VFSStructure → JSON string
 * - EditorState → JSON string (if present)
 */
export function serializeWorkspace(workspace: Workspace, userId: string): SerializedWorkspace {
  const sanitizedVfs = sanitizeJsonValue(workspace.vfs);
  const sanitizedEditorState = workspace.editorState
    ? sanitizeJsonValue(workspace.editorState)
    : null;

  return {
    id: workspace.metadata.id,
    userId: userId,
    name: workspace.metadata.name,
    source: workspace.metadata.source,
    vfsData: JSON.stringify(sanitizedVfs),
    editorStateData: sanitizedEditorState ? JSON.stringify(sanitizedEditorState) : null,
    createdAt: workspace.metadata.createdAt.toISOString(),
    lastOpenedAt: workspace.metadata.lastOpenedAt.toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Deserialize a database record into a Workspace object
 * 
 * Converts stored JSON back to runtime types:
 * - ISO strings → Date objects
 * - JSON strings → VFSStructure and EditorState
 */
export function deserializeWorkspace(serialized: SerializedWorkspace): Workspace {
  let vfs: VFSStructure;
  let editorState: EditorState | undefined;

  try {
    vfs = JSON.parse(serialized.vfsData);
  } catch (error) {
    throw new Error(`Failed to parse VFS data: ${error}`);
  }

  if (serialized.editorStateData) {
    try {
      editorState = JSON.parse(serialized.editorStateData);
    } catch (error) {
      console.warn('Failed to parse editor state data, ignoring:', error);
      editorState = undefined;
    }
  }

  return {
    metadata: {
      id: serialized.id,
      name: serialized.name,
      source: serialized.source,
      createdAt: new Date(serialized.createdAt),
      lastOpenedAt: new Date(serialized.lastOpenedAt),
      userId: serialized.userId,
    },
    vfs,
    editorState,
  };
}

/**
 * Prepare VFS data for database storage (JSONB column)
 */
export function serializeVFS(vfs: VFSStructure): Record<string, unknown> {
  const sanitized = sanitizeJsonValue(vfs);
  return JSON.parse(JSON.stringify(sanitized)) as Record<string, unknown>;
}

/**
 * Prepare EditorState for database storage (JSONB column)
 */
export function serializeEditorState(editorState: EditorState): Record<string, unknown> {
  const sanitized = sanitizeJsonValue(editorState);
  return JSON.parse(JSON.stringify(sanitized)) as Record<string, unknown>;
}

