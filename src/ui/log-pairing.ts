/**
 * Pure log-traversal helpers used by the log panel.
 *
 *   - {@link pairById}          — for each entry, find its paired counterpart
 *                                 by JSON-RPC id (request ↔ response).
 *   - {@link applyFilter}       — filter entries by direction/kind selector.
 *   - {@link findRequest}       — prev/next request navigation; never lands on
 *                                 a response, notification, or system message.
 *   - {@link computeMetrics}    — bytes + duration for a wire response, paired
 *                                 with its request.
 *
 * No React, no DOM. Imported by both the live LogPanel and unit tests.
 */

import type { LogEntry } from '../state/log.tsx';
import { isRequest, isResponse, rpcId } from './log-headline.ts';

export type LogFilter = 'all' | 'outgoing' | 'incoming' | 'requests' | 'system' | 'wire' | 'errors';

/**
 * Build a Map<entryId → pairedEntryId>. The pair for a request is its
 * response; the pair for a response is the originating request. Notifications
 * have no pair.
 *
 * If an id collides (e.g. a server reuses ids across calls), the most recent
 * entry wins — that matches what the user is staring at on screen.
 */
export function pairById(entries: ReadonlyArray<LogEntry>): Map<number, number> {
  // First, index every wire entry by its JSON-RPC id.
  const lastByRpc = new Map<string | number, LogEntry[]>();
  for (const e of entries) {
    if (e.kind !== 'wire') continue;
    const id = rpcId(e.message);
    if (id === undefined) continue;
    const list = lastByRpc.get(id);
    if (list) list.push(e);
    else lastByRpc.set(id, [e]);
  }

  const pairs = new Map<number, number>();
  for (const [, group] of lastByRpc) {
    // Within a group, pair each request with the next response (or vice-
    // versa) in order. This handles ID reuse without cross-pairing.
    let i = 0;
    while (i < group.length) {
      const cur = group[i];
      if (!cur || cur.kind !== 'wire') {
        i++;
        continue;
      }
      // Find the next entry of opposite role.
      const wantResponse = isRequest(cur.message);
      let j = i + 1;
      while (j < group.length) {
        const peer = group[j];
        if (peer && peer.kind === 'wire') {
          const peerIsResponse = isResponse(peer.message);
          if (wantResponse ? peerIsResponse : isRequest(peer.message)) break;
        }
        j++;
      }
      if (j < group.length) {
        const peer = group[j];
        if (peer) {
          pairs.set(cur.id, peer.id);
          pairs.set(peer.id, cur.id);
          i = j + 1;
          continue;
        }
      }
      i++;
    }
  }
  return pairs;
}

/**
 * Apply the selected filter to an entry list. Order is preserved.
 *
 *   - `all`        — pass-through.
 *   - `outgoing`   — only outgoing wire entries.
 *   - `incoming`   — only incoming wire entries.
 *   - `requests`   — only wire entries whose JSON-RPC message is a request
 *                    (has both `method` and `id`).
 *   - `system`     — only system-level messages (info/warn/error).
 *   - `wire`       — every wire entry (both directions). DEC-025 palette.
 *   - `errors`     — system entries at error level. DEC-025 palette.
 */
export function applyFilter(entries: ReadonlyArray<LogEntry>, filter: LogFilter): LogEntry[] {
  if (filter === 'all') return [...entries];
  if (filter === 'system') return entries.filter((e) => e.kind === 'system');
  if (filter === 'outgoing') {
    return entries.filter((e) => e.kind === 'wire' && e.direction === 'outgoing');
  }
  if (filter === 'incoming') {
    return entries.filter((e) => e.kind === 'wire' && e.direction === 'incoming');
  }
  if (filter === 'wire') return entries.filter((e) => e.kind === 'wire');
  if (filter === 'errors') {
    return entries.filter((e) => e.kind === 'system' && e.level === 'error');
  }
  // requests-only
  return entries.filter((e) => e.kind === 'wire' && isRequest(e.message));
}

/**
 * Find the previous or next *outgoing request* relative to a starting index.
 * Skips responses, notifications, and system messages — exactly the entries a
 * user navigating the log with `j`/`k` wants to step over.
 *
 * Returns the new index, or `-1` if none found in that direction.
 *
 * If `fromIndex` is `-1`, scanning forward starts at index 0; scanning
 * backward starts at the last entry.
 */
export function findRequest(
  entries: ReadonlyArray<LogEntry>,
  fromIndex: number,
  direction: 'next' | 'prev',
): number {
  const step = direction === 'next' ? 1 : -1;
  let i: number;
  if (fromIndex === -1) {
    i = direction === 'next' ? 0 : entries.length - 1;
  } else {
    i = fromIndex + step;
  }
  while (i >= 0 && i < entries.length) {
    const e = entries[i];
    if (e && e.kind === 'wire' && e.direction === 'outgoing' && isRequest(e.message)) {
      return i;
    }
    i += step;
  }
  return -1;
}

/**
 * Bytes of the pretty-printed JSON form of `value` (DEC-009). Uses
 * `TextEncoder` so multi-byte characters count for what they really cost.
 */
export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value, null, 2)).byteLength;
}
