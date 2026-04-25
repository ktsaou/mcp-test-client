/**
 * Persistence schema — versioned, namespaced. See specs/persistence.md.
 *
 * Every key the app stores in localStorage lives under the `mcptc:` prefix.
 * When the shape of *any* persisted value needs to change, bump
 * {@link CURRENT_SCHEMA_VERSION} and add a migration in `migrations.ts`.
 */

import type { ServerAuth, TransportKind } from '../mcp/types.ts';

/** Current schema version. Bump when adding a migration. */
export const CURRENT_SCHEMA_VERSION = 1;

/** All keys live under this prefix. */
export const STORAGE_PREFIX = 'mcptc:';

/** Known top-level key names (without the prefix). */
export const Keys = {
  /** Schema version integer. */
  version: 'version',
  /** Array of ServerEntry (see {@link ServerEntry}). */
  servers: 'servers',
  /** The id of the currently selected server, or null. */
  serversActive: 'servers.active',
  /** Theme preference — see {@link ThemePreference}. */
  theme: 'theme',
  /** Recent request/response records (capped at HISTORY_MAX). */
  history: 'history',
} as const;

export function prefixed(key: string): string {
  return STORAGE_PREFIX + key;
}

export function toolParamsKey(serverId: string, toolName: string): string {
  return prefixed(`tools.${serverId}.${toolName}`);
}

/**
 * DEC-018: per-tool form-state snapshot. Stores the current form
 * value, raw-editor text, mode, and lastResult so switching tools or
 * servers and coming back restores the user's in-progress work.
 */
export function toolStateKey(serverId: string, toolName: string): string {
  return prefixed(`tool-state.${serverId}.${toolName}`);
}

/**
 * DEC-018 auto-restore selection: per-server "last selected tool"
 * pointer. Lets us auto-re-select the tool the user was on when they
 * left this server, so flipping back picks up where they were.
 */
export function lastSelectionKey(serverId: string): string {
  return prefixed(`last-selection.${serverId}`);
}

export function cannedKey(serverId: string, toolName: string): string {
  return prefixed(`canned.${serverId}.${toolName}`);
}

export function uiKey(feature: string): string {
  return prefixed(`ui.${feature}`);
}

/** Theme preference persisted by the user. */
export type ThemePreference = 'system' | 'dark' | 'light';

/** Server entry — the shape stored under `mcptc:servers`. */
export interface ServerEntry {
  id: string;
  url: string;
  name: string;
  transport: TransportKind | 'auto';
  auth?: ServerAuth;
  tags?: string[];
  addedAt: number;
  lastUsed: number | null;
}

/** Maximum number of history entries retained. */
export const HISTORY_MAX = 100;

/** One record in the history buffer. */
export interface HistoryRecord {
  timestamp: number;
  serverId: string;
  request: unknown;
  response?: unknown;
  errorMessage?: string;
  /** Approx wire size of the response body in bytes (for UX cues). */
  responseBytes?: number;
}
