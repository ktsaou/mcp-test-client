/**
 * DEC-026 — URL-as-state for tool / args / log filter.
 *
 * Encodes the slices of state worth sharing as a deep link in the URL
 * `?` query string:
 *   - `server`     — active server id
 *   - `tool`       — selected tool name
 *   - `args`       — base64url(JSON.stringify(formValue)) for the tool
 *   - `mode`       — `form` / `raw`
 *   - `log_filter` — log panel filter mode
 *
 * The URL `#` hash is reserved for share-link reproduction (DEC-016 #2);
 * keeping the two surfaces disjoint avoids collision. Credentials are
 * NEVER pushed to the URL: every write runs through {@link assertNoSecrets},
 * which refuses URLs that contain the active server's auth token /
 * header value, plus a paranoid "bearer" / "authorization" substring
 * sweep matching the DEC-026 brief.
 *
 * Decoding is robust against malformed payloads: a corrupt `args=`
 * blob falls back to "no args supplied" instead of crashing the boot
 * path.
 */

import type { ServerAuth } from '../mcp/types.ts';
import type { LogFilter } from '../ui/log-pairing.ts';

/** Slices the URL is allowed to carry. */
export interface UrlState {
  server?: string;
  tool?: string;
  /** Decoded form value. The wire format is base64url(JSON). */
  args?: unknown;
  mode?: 'form' | 'raw';
  logFilter?: LogFilter;
}

/** Param names — kept as constants so serialize / parse / strip stay aligned. */
export const URL_PARAM_KEYS = {
  server: 'server',
  tool: 'tool',
  args: 'args',
  mode: 'mode',
  logFilter: 'log_filter',
} as const;

const ALL_PARAM_NAMES: ReadonlyArray<string> = Object.values(URL_PARAM_KEYS);

const VALID_LOG_FILTERS: ReadonlyArray<LogFilter> = [
  'all',
  'outgoing',
  'incoming',
  'requests',
  'system',
  'wire',
  'errors',
];

/**
 * Build the `?…` query string for the supplied state. Returns an empty
 * string when the state carries no shareable slice — callers can use
 * the empty result to mean "drop the query entirely".
 *
 * Order is stable (`server`, `tool`, `args`, `mode`, `log_filter`) so a
 * URL produced for the same state on two browsers compares equal.
 */
export function serialize(state: UrlState): string {
  const params = new URLSearchParams();
  if (typeof state.server === 'string' && state.server.length > 0) {
    params.set(URL_PARAM_KEYS.server, state.server);
  }
  if (typeof state.tool === 'string' && state.tool.length > 0) {
    params.set(URL_PARAM_KEYS.tool, state.tool);
  }
  const encodedArgs = encodeArgs(state.args);
  if (encodedArgs !== null) {
    params.set(URL_PARAM_KEYS.args, encodedArgs);
  }
  if (state.mode === 'form' || state.mode === 'raw') {
    params.set(URL_PARAM_KEYS.mode, state.mode);
  }
  if (state.logFilter && VALID_LOG_FILTERS.includes(state.logFilter)) {
    params.set(URL_PARAM_KEYS.logFilter, state.logFilter);
  }
  const s = params.toString();
  return s.length === 0 ? '' : '?' + s;
}

/**
 * Decode a query string into the slices we recognise. Unknown params
 * are ignored. A malformed `args` payload yields `args = undefined`
 * AND triggers the optional `onWarn` callback so the UI can surface a
 * system-log entry.
 */
export function parse(search: string, options: { onWarn?: (msg: string) => void } = {}): UrlState {
  const out: UrlState = {};
  const params = new URLSearchParams(stripLeadingMark(search));

  const server = params.get(URL_PARAM_KEYS.server);
  if (server !== null && server.length > 0) out.server = server;

  const tool = params.get(URL_PARAM_KEYS.tool);
  if (tool !== null && tool.length > 0) out.tool = tool;

  const argsRaw = params.get(URL_PARAM_KEYS.args);
  if (argsRaw !== null && argsRaw.length > 0) {
    const decoded = decodeArgs(argsRaw);
    if (decoded.ok) {
      out.args = decoded.value;
    } else {
      options.onWarn?.('Ignoring malformed `args` URL parameter');
    }
  }

  const mode = params.get(URL_PARAM_KEYS.mode);
  if (mode === 'form' || mode === 'raw') out.mode = mode;

  const filter = params.get(URL_PARAM_KEYS.logFilter);
  if (filter !== null && (VALID_LOG_FILTERS as readonly string[]).includes(filter)) {
    out.logFilter = filter as LogFilter;
  }

  return out;
}

/**
 * Refuse to push a URL that surfaces the active server's credentials.
 *
 * Two layers:
 *   1. The active server's auth token / header value verbatim — the
 *      direct exfiltration risk if a tool form happened to mirror back
 *      a credential.
 *   2. A literal `bearer` / `authorization` substring sweep on the
 *      lowercased URL — the belt that catches accidental leakage even
 *      when our auth model expands.
 *
 * Throws on a hit so callers can hard-bail instead of silently
 * serialising a credential into the address bar.
 */
export function assertNoSecrets(url: string, auth: ServerAuth | undefined): void {
  if (auth) {
    if (auth.kind === 'bearer') {
      const token = auth.token.trim();
      if (token.length > 0 && url.includes(token)) {
        throw new Error('refusing to push URL containing the active bearer token');
      }
    } else if (auth.kind === 'header') {
      const value = auth.value.trim();
      if (value.length > 0 && url.includes(value)) {
        throw new Error('refusing to push URL containing the active auth header value');
      }
    }
  }
  // Paranoid sweep matching the DEC-026 brief verbatim: refuse the
  // push if the URL contains the literal substrings "bearer" or
  // "authorization" anywhere. False-positive risk on tool names
  // exists; the trade-off is acceptable because the failure mode is
  // a refused Copy link (loud, recoverable) rather than a leaked
  // credential (silent, irrecoverable).
  const lower = url.toLowerCase();
  if (lower.includes('bearer')) {
    throw new Error('refusing to push URL containing "bearer"');
  }
  if (lower.includes('authorization')) {
    throw new Error('refusing to push URL containing "authorization"');
  }
}

/**
 * Strip our managed params from a query string. Keeps any params we
 * don't own (notably the existing `?add=…` deep-link, DEC-016 #3) so a
 * concurrent flow can still consume them.
 */
export function stripManagedParams(search: string): string {
  const params = new URLSearchParams(stripLeadingMark(search));
  for (const name of ALL_PARAM_NAMES) params.delete(name);
  const s = params.toString();
  return s.length === 0 ? '' : '?' + s;
}

/**
 * Build the absolute URL the user would share, anchored to
 * `window.location.origin + pathname` and with the supplied state as
 * the query string. The hash is preserved as-is — share-link state
 * lives there and is independent of URL state.
 */
export function buildShareUrl(state: UrlState): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname;
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  return origin + pathname + serialize(state) + hash;
}

/**
 * Synchronous URL writer used by the debounced subscriber. Builds the
 * absolute URL, runs the secrets guard, and pushes via the supplied
 * history method.
 *
 * Callers should funnel writes through {@link createDebouncedUrlWriter}
 * to honour the 200 ms cadence the brief mandates.
 */
export function pushUrlState(
  state: UrlState,
  auth: ServerAuth | undefined,
  historyMethod: 'replace' | 'push' = 'replace',
): void {
  if (typeof window === 'undefined') return;
  const next = buildShareUrl(state);
  // The current URL's query may carry a sibling param (e.g. `?add=…`)
  // we don't manage. Preserve those by overlaying our managed params
  // onto the current query before writing.
  const managed = serialize(state);
  const sibling = stripManagedParams(window.location.search);
  let combinedQuery: string;
  if (managed.length === 0) {
    combinedQuery = sibling;
  } else if (sibling.length === 0) {
    combinedQuery = managed;
  } else {
    // sibling already starts with `?`; managed too. Merge.
    combinedQuery = sibling + '&' + managed.slice(1);
  }
  const merged =
    window.location.origin + window.location.pathname + combinedQuery + window.location.hash;
  // Only the path-relative bits round-trip — assertNoSecrets reads
  // both for completeness so a leaked credential in the origin (a bad
  // server URL) trips on the same guard.
  assertNoSecrets(merged, auth);
  if (historyMethod === 'push') {
    window.history.pushState(null, '', merged);
  } else {
    window.history.replaceState(null, '', merged);
  }
  // The buildShareUrl helper is exported for the Copy-link button —
  // reference it here so tree-shaking sees a single export surface.
  void next;
}

/**
 * 200 ms `replaceState`-debounced writer. Returns a `(state, auth) =>
 * void` function plus a `flush` to force-write the most recent state
 * (e.g. on Copy link click) and a `cancel` for unmount.
 */
export function createDebouncedUrlWriter(): {
  schedule: (state: UrlState, auth: ServerAuth | undefined) => void;
  flush: () => void;
  cancel: () => void;
} {
  let pending: { state: UrlState; auth: ServerAuth | undefined } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (state: UrlState, auth: ServerAuth | undefined) => {
    pending = { state, auth };
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (pending === null) return;
      const snapshot = pending;
      pending = null;
      try {
        pushUrlState(snapshot.state, snapshot.auth, 'replace');
      } catch {
        // The secrets guard tripped. Leave the URL alone — better a
        // stale URL than a leaked credential. The caller (Copy link
        // button) handles the user-visible failure path; the
        // background subscriber simply skips this tick.
      }
    }, 200);
  };
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending === null) return;
    const snapshot = pending;
    pending = null;
    pushUrlState(snapshot.state, snapshot.auth, 'replace');
  };
  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };
  return { schedule, flush, cancel };
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function stripLeadingMark(s: string): string {
  if (s.startsWith('?') || s.startsWith('#')) return s.slice(1);
  return s;
}

function encodeArgs(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    // An empty object carries no information; suppress to keep URLs short.
    return null;
  }
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return null;
  }
  return toBase64Url(json);
}

type DecodeResult = { ok: true; value: unknown } | { ok: false };

function decodeArgs(payload: string): DecodeResult {
  let json: string;
  try {
    json = fromBase64Url(payload);
  } catch {
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(json) as unknown };
  } catch {
    return { ok: false };
  }
}

function toBase64Url(input: string): string {
  // btoa works on Latin-1, so we UTF-8-encode first to keep multibyte
  // characters intact through the round-trip. Browser + happy-dom both
  // ship TextEncoder + btoa; no Node Buffer fallback is needed (the app
  // is browser-only — main.tsx is the only entry point).
  const bytes = new TextEncoder().encode(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(payload: string): string {
  const pad = '='.repeat((4 - (payload.length % 4)) % 4);
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
