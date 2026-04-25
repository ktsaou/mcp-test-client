/**
 * DEC-018 — per-tool form-state persistence.
 *
 * Stores `{ formValue, rawText, mode, lastResult }` per
 * `(server-id, tool-name)` in `mcptc:tool-state.<server>.<tool>`.
 * Saves on every change (no "Save" button), debounced 200 ms so
 * fast typing doesn't hit storage on every keystroke. Snapshot
 * size is capped at 64 KB; oversize snapshots truncate the raw
 * editor and skip persistence.
 *
 * LRU: at most {@link MAX_SNAPSHOT_ENTRIES} entries across all
 * (server, tool) pairs. On overflow the least-recently-touched
 * snapshot is evicted.
 */
import { appStore } from './store-instance.ts';
import { lastSelectionKey, toolStateKey, prefixed, STORAGE_PREFIX } from '../persistence/schema.ts';

export interface ToolStateSnapshot {
  formValue: unknown;
  rawText: string;
  mode: 'form' | 'raw';
  lastResult: unknown;
  /** ms since epoch — used for LRU eviction. */
  touchedAt: number;
}

/** Per-tool snapshot size cap. */
export const MAX_SNAPSHOT_BYTES = 64 * 1024;

/** Max persisted snapshots across all (server, tool). */
export const MAX_SNAPSHOT_ENTRIES = 200;

export function readToolState(serverId: string, toolName: string): ToolStateSnapshot | null {
  const v = appStore.read<ToolStateSnapshot>(toolStateKey(serverId, toolName));
  return v ?? null;
}

export function writeToolState(
  serverId: string,
  toolName: string,
  snapshot: ToolStateSnapshot,
): void {
  // Cheap size check before serialising twice. JSON.stringify is fine
  // here — the formValue / lastResult are user-editable / response
  // payloads, not arbitrary objects.
  let serialized: string;
  try {
    serialized = JSON.stringify(snapshot);
  } catch {
    return;
  }
  if (serialized.length > MAX_SNAPSHOT_BYTES) {
    // Drop the heavy fields and try once more. lastResult is the
    // largest by far in practice (full tool response).
    const trimmed: ToolStateSnapshot = {
      ...snapshot,
      lastResult: null,
      rawText: snapshot.rawText.slice(0, 8 * 1024),
    };
    try {
      const trimmedSerialized = JSON.stringify(trimmed);
      if (trimmedSerialized.length > MAX_SNAPSHOT_BYTES) return;
      // Persist trimmed version.
      appStore.write(toolStateKey(serverId, toolName), trimmed);
    } catch {
      return;
    }
  } else {
    appStore.write(toolStateKey(serverId, toolName), snapshot);
  }
  evictIfNeeded();
}

/**
 * LRU sweep across the `mcptc:tool-state.*` keyspace. Cheap because
 * it only reads `touchedAt` per entry, not the full snapshot.
 */
function evictIfNeeded(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const ls = window.localStorage;
  const matches: Array<{ key: string; touchedAt: number }> = [];
  const prefix = prefixed('tool-state.');
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const raw = ls.getItem(key);
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const touchedAt =
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as { touchedAt?: unknown }).touchedAt === 'number'
        ? (parsed as { touchedAt: number }).touchedAt
        : 0;
    matches.push({ key, touchedAt });
  }
  if (matches.length <= MAX_SNAPSHOT_ENTRIES) return;
  matches.sort((a, b) => a.touchedAt - b.touchedAt);
  const evict = matches.slice(0, matches.length - MAX_SNAPSHOT_ENTRIES);
  for (const { key } of evict) {
    try {
      ls.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export function readLastSelection(serverId: string): string | null {
  return appStore.read<string>(lastSelectionKey(serverId)) ?? null;
}

export function writeLastSelection(serverId: string, toolName: string | null): void {
  if (toolName === null) {
    // Clear by writing-then-removing. The store doesn't expose remove,
    // so we write null and treat null as "no selection". Cheap.
    appStore.write(lastSelectionKey(serverId), null);
    return;
  }
  appStore.write(lastSelectionKey(serverId), toolName);
}

// Re-export for tests / debug consumers.
export { STORAGE_PREFIX, toolStateKey, lastSelectionKey };
